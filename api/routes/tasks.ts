import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { getVideoDownloadQueue, getVideoProcessQueue, getVideoPublishQueue } from '../config/redis.js';
import { authenticateToken } from './auth.js';
import { taskProcessor } from '../services/taskProcessor.js';

const router = express.Router();

// 获取用户任务列表
router.get('/', authenticateToken, [
  query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { status, limit = 50, page = 1 } = req.query;

    let { data: tasks, error } = await DatabaseService.getUserTasks(userId, Number(limit));
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch tasks', 'DATABASE_ERROR'));
    }

    // 根据状态筛选
    if (status) {
      tasks = tasks?.filter(task => task.status === status) || [];
    }

    // 分页处理
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedTasks = tasks?.slice(startIndex, endIndex) || [];

    res.json(responseUtils.success({
      tasks: paginatedTasks,
      pagination: {
        total: tasks?.length || 0,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil((tasks?.length || 0) / Number(limit))
      }
    }, 'Tasks retrieved successfully'));

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch tasks', 'FETCH_ERROR'));
  }
});

// 创建新任务
router.post('/', authenticateToken, [
  body('task_type').isIn(['download', 'process', 'publish', 'batch']),
  body('source_config').isObject(),
  body('target_config').optional().isObject(),
  body('processing_config').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { task_type, source_config, target_config, processing_config } = req.body;

    // 检查用户任务配额
    const { data: user } = await DatabaseService.getUserById(userId);
    if (!user) {
      return res.status(404).json(responseUtils.error('User not found', 'USER_NOT_FOUND'));
    }

    // 检查今日任务数量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayTasks } = await DatabaseService.getUserTasksToday(userId, today.toISOString());
    
    if (todayTasks && todayTasks.length >= user.max_daily_tasks) {
      return res.status(429).json(responseUtils.error(
        `Daily task limit reached (${user.max_daily_tasks} tasks)`, 
        'TASK_LIMIT_EXCEEDED'
      ));
    }

    // 创建任务
    const { data: task, error } = await DatabaseService.createTask({
      user_id: userId,
      task_type,
      status: 'pending',
      source_config,
      target_config: target_config || {},
      processing_config: processing_config || {},
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create task', 'DATABASE_ERROR'));
    }

    // 根据任务类型添加到相应的队列
    try {
      switch (task_type) {
        case 'download':
          await taskProcessor.addDownloadTask({ 
            taskId: task.id, 
            source_config, 
            target_config,
            processing_config 
          });
          break;
        case 'process':
          await taskProcessor.addProcessTask({ 
            taskId: task.id, 
            processing_config 
          });
          break;
        case 'publish':
          await taskProcessor.addPublishTask({ 
            taskId: task.id, 
            target_config 
          });
          break;
        case 'batch':
          // 批量任务需要特殊处理
          await taskProcessor.addDownloadTask({ 
            taskId: task.id, 
            source_config, 
            processing_config, 
            target_config 
          });
          break;
        default:
          console.log(`⚠️  Unknown task type: ${task_type}`);
      }
    } catch (error) {
      console.error('Failed to add task to queue:', error);
      // 即使添加到队列失败，任务仍然创建成功，只是不会自动执行
    }

    // 更新用户使用计数
    await DatabaseService.updateUserUsage(userId, user.usage_count + 1);

    res.json(responseUtils.success(task, 'Task created successfully'));

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json(responseUtils.error('Failed to create task', 'CREATE_ERROR'));
  }
});

// 获取任务详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;

    const { data: task, error } = await DatabaseService.getTaskById(taskId);
    if (error || !task) {
      return res.status(404).json(responseUtils.error('Task not found', 'TASK_NOT_FOUND'));
    }

    // 验证任务所有权
    if (task.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 'ACCESS_DENIED'));
    }

    res.json(responseUtils.success(task, 'Task retrieved successfully'));

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json(responseUtils.error('Failed to get task', 'FETCH_ERROR'));
  }
});

// 取消任务
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;

    const { data: task, error } = await DatabaseService.getTaskById(taskId);
    if (error || !task) {
      return res.status(404).json(responseUtils.error('Task not found', 'TASK_NOT_FOUND'));
    }

    // 验证任务所有权
    if (task.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 'ACCESS_DENIED'));
    }

    // 只能取消待处理和运行中的任务
    if (!['pending', 'running'].includes(task.status)) {
      return res.status(400).json(responseUtils.error('Task cannot be cancelled', 'INVALID_STATUS'));
    }

    const { error: updateError } = await DatabaseService.updateTaskStatus(taskId, 'cancelled', 100, 'Cancelled by user');
    if (updateError) {
      return res.status(500).json(responseUtils.error('Failed to cancel task', 'CANCEL_ERROR'));
    }

    res.json(responseUtils.success(null, 'Task cancelled successfully'));

  } catch (error) {
    console.error('Cancel task error:', error);
    res.status(500).json(responseUtils.error('Failed to cancel task', 'CANCEL_ERROR'));
  }
});

// 删除任务
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;

    const { data: task, error } = await DatabaseService.getTaskById(taskId);
    if (error || !task) {
      return res.status(404).json(responseUtils.error('Task not found', 'TASK_NOT_FOUND'));
    }

    // 验证任务所有权
    if (task.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 'ACCESS_DENIED'));
    }

    // 只能删除已完成、失败或已取消的任务
    if (!['completed', 'failed', 'cancelled'].includes(task.status)) {
      return res.status(400).json(responseUtils.error('Task cannot be deleted', 'INVALID_STATUS'));
    }

    const { error: deleteError } = await DatabaseService.deleteTask(taskId);
    if (deleteError) {
      return res.status(500).json(responseUtils.error('Failed to delete task', 'DELETE_ERROR'));
    }

    res.json(responseUtils.success(null, 'Task deleted successfully'));

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json(responseUtils.error('Failed to delete task', 'DELETE_ERROR'));
  }
});



export default router;