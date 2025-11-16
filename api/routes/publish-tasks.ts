import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { getVideoPublishQueue } from '../config/redis.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取发布任务列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: tasks, error } = await DatabaseService.getPublishTasks(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish tasks', 'DATABASE_ERROR'));
    }

    res.json(responseUtils.success(tasks || [], 'Publish tasks retrieved successfully'));

  } catch (error) {
    console.error('Get publish tasks error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch publish tasks', 'FETCH_ERROR'));
  }
});

// 创建发布任务
router.post('/', authenticateToken, [
  body('title').isString().isLength({ min: 1, max: 200 }),
  body('videoUrl').isString().isURL(),
  body('platforms').isArray({ min: 1 }),
  body('platforms.*').isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  body('scheduledTime').optional().isISO8601(),
  body('description').optional().isString().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('tags.*').isString().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { title, videoUrl, platforms, scheduledTime, description, tags } = req.body;

    // 创建发布任务
    const { data: task, error } = await DatabaseService.createPublishTask({
      user_id: userId,
      title,
      video_url: videoUrl,
      platforms,
      status: scheduledTime ? 'pending' : 'processing',
      scheduled_time: scheduledTime || null,
      description: description || '',
      tags: tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create publish task', 'CREATE_ERROR'));
    }

    // 如果不是定时发布，立即添加到发布队列
    if (!scheduledTime) {
      const videoPublishQueue = getVideoPublishQueue();
      if (videoPublishQueue) {
        await videoPublishQueue.add('publish', {
          taskId: task.id,
          title,
          videoUrl,
          platforms,
          description,
          tags
        });
      } else {
        console.log('⚠️  Redis not available, skipping queue processing');
      }
    }

    res.json(responseUtils.success(task, 'Publish task created successfully'));

  } catch (error) {
    console.error('Create publish task error:', error);
    res.status(500).json(responseUtils.error('Failed to create publish task', 'CREATE_ERROR'));
  }
});

// 获取单个发布任务
router.get('/:id', authenticateToken, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const taskId = req.params.id;

    const { data: task, error } = await DatabaseService.getPublishTaskById(taskId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish task', 'DATABASE_ERROR'));
    }

    if (!task || task.user_id !== userId) {
      return res.status(404).json(responseUtils.error('Publish task not found', 'NOT_FOUND'));
    }

    res.json(responseUtils.success(task, 'Publish task retrieved successfully'));

  } catch (error) {
    console.error('Get publish task error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch publish task', 'FETCH_ERROR'));
  }
});

// 更新发布任务
router.put('/:id', authenticateToken, [
  param('id').isUUID(),
  body('title').optional().isString().isLength({ min: 1, max: 200 }),
  body('videoUrl').optional().isString().isURL(),
  body('platforms').optional().isArray({ min: 1 }),
  body('platforms.*').optional().isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  body('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
  body('scheduledTime').optional().isISO8601(),
  body('description').optional().isString().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const taskId = req.params.id;
    const { title, videoUrl, platforms, status, scheduledTime, description, tags } = req.body;

    // 验证任务所有权
    const { data: existingTask, error: fetchError } = await DatabaseService.getPublishTaskById(taskId);
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish task', 'DATABASE_ERROR'));
    }

    if (!existingTask || existingTask.user_id !== userId) {
      return res.status(404).json(responseUtils.error('Publish task not found', 'NOT_FOUND'));
    }

    // 只能更新待处理状态的任务
    if (!['pending'].includes(existingTask.status)) {
      return res.status(400).json(responseUtils.error('Cannot update task in current status', 'INVALID_STATUS'));
    }

    // 更新任务
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (videoUrl !== undefined) updateData.video_url = videoUrl;
    if (platforms !== undefined) updateData.platforms = platforms;
    if (status !== undefined) updateData.status = status;
    if (scheduledTime !== undefined) updateData.scheduled_time = scheduledTime;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;

    const { data: updatedTask, error } = await DatabaseService.updatePublishTask(taskId, updateData);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to update publish task', 'UPDATE_ERROR'));
    }

    res.json(responseUtils.success(updatedTask, 'Publish task updated successfully'));

  } catch (error) {
    console.error('Update publish task error:', error);
    res.status(500).json(responseUtils.error('Failed to update publish task', 'UPDATE_ERROR'));
  }
});

// 删除发布任务
router.delete('/:id', authenticateToken, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const taskId = req.params.id;

    // 验证任务所有权
    const { data: task, error: fetchError } = await DatabaseService.getPublishTaskById(taskId);
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish task', 'DATABASE_ERROR'));
    }

    if (!task || task.user_id !== userId) {
      return res.status(404).json(responseUtils.error('Publish task not found', 'NOT_FOUND'));
    }

    // 只能删除待处理状态的任务
    if (!['pending', 'failed'].includes(task.status)) {
      return res.status(400).json(responseUtils.error('Cannot delete task in current status', 'INVALID_STATUS'));
    }

    const { error } = await DatabaseService.deletePublishTask(taskId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to delete publish task', 'DELETE_ERROR'));
    }

    res.json(responseUtils.success(null, 'Publish task deleted successfully'));

  } catch (error) {
    console.error('Delete publish task error:', error);
    res.status(500).json(responseUtils.error('Failed to delete publish task', 'DELETE_ERROR'));
  }
});

// 立即发布任务
router.post('/:id/publish', authenticateToken, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const taskId = req.params.id;

    // 验证任务所有权
    const { data: task, error: fetchError } = await DatabaseService.getPublishTaskById(taskId);
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish task', 'DATABASE_ERROR'));
    }

    if (!task || task.user_id !== userId) {
      return res.status(404).json(responseUtils.error('Publish task not found', 'NOT_FOUND'));
    }

    // 只能发布待处理状态的任务
    if (task.status !== 'pending') {
      return res.status(400).json(responseUtils.error('Cannot publish task in current status', 'INVALID_STATUS'));
    }

    // 更新任务状态为处理中
    const { error: updateError } = await DatabaseService.updatePublishTask(taskId, {
      status: 'processing',
      updated_at: new Date().toISOString()
    });

    if (updateError) {
      return res.status(500).json(responseUtils.error('Failed to update task status', 'UPDATE_ERROR'));
    }

    // 添加到发布队列
    const videoPublishQueue = getVideoPublishQueue();
    if (videoPublishQueue) {
      await videoPublishQueue.add('publish', {
        taskId: task.id,
        title: task.title,
        videoUrl: task.video_url,
        platforms: task.platforms,
        description: task.description,
        tags: task.tags
      });
    } else {
      console.log('⚠️  Redis not available, skipping queue processing');
    }

    res.json(responseUtils.success(null, 'Publish task started successfully'));

  } catch (error) {
    console.error('Publish now error:', error);
    res.status(500).json(responseUtils.error('Failed to start publish task', 'PUBLISH_ERROR'));
  }
});

// 批量发布任务
router.post('/batch-publish', authenticateToken, [
  body('ids').isArray({ min: 1 }),
  body('ids.*').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { ids } = req.body;

    // 验证任务所有权和状态
    const tasks = [];
    for (const taskId of ids) {
      const { data: task, error } = await DatabaseService.getPublishTaskById(taskId);
      if (error) {
        return res.status(500).json(responseUtils.error(`Failed to fetch task ${taskId}`, 'DATABASE_ERROR'));
      }

      if (!task || task.user_id !== userId) {
        return res.status(404).json(responseUtils.error(`Task ${taskId} not found`, 'NOT_FOUND'));
      }

      if (task.status !== 'pending') {
        return res.status(400).json(responseUtils.error(`Task ${taskId} cannot be published in current status`, 'INVALID_STATUS'));
      }

      tasks.push(task);
    }

    // 批量更新任务状态
    const videoPublishQueue = getVideoPublishQueue();
    for (const task of tasks) {
      // 更新任务状态为处理中
      await DatabaseService.updatePublishTask(task.id, {
        status: 'processing',
        updated_at: new Date().toISOString()
      });

      // 添加到发布队列
      if (videoPublishQueue) {
        await videoPublishQueue.add('publish', {
          taskId: task.id,
          title: task.title,
          videoUrl: task.video_url,
          platforms: task.platforms,
          description: task.description,
          tags: task.tags
        });
      }
    }

    res.json(responseUtils.success(null, 'Batch publish tasks started successfully'));

  } catch (error) {
    console.error('Batch publish error:', error);
    res.status(500).json(responseUtils.error('Failed to start batch publish tasks', 'BATCH_PUBLISH_ERROR'));
  }
});

// 获取发布统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: tasks, error } = await DatabaseService.getPublishTasks(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish tasks', 'DATABASE_ERROR'));
    }

    const stats = {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      processing: tasks?.filter(t => t.status === 'processing').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      failed: tasks?.filter(t => t.status === 'failed').length || 0,
    };

    res.json(responseUtils.success(stats, 'Publish stats retrieved successfully'));

  } catch (error) {
    console.error('Get publish stats error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch publish stats', 'STATS_ERROR'));
  }
});

export default router;