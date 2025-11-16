import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { getVideoPublishQueue } from '../config/redis.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 发布视频
router.post('/', authenticateToken, [
  body('video_id').isUUID(),
  body('account_id').isUUID(),
  body('platform').isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  body('title').isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('scheduled_at').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { video_id, account_id, platform, title, description, tags, scheduled_at } = req.body;

    // 验证账号所有权
    const { data: account } = await DatabaseService.getAccountById(account_id);
    if (!account || account.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Account not found or access denied', 'ACCESS_DENIED'));
    }

    // 验证视频所有权
    const { data: video } = await DatabaseService.getVideoById(video_id);
    if (!video || video.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Video not found or access denied', 'ACCESS_DENIED'));
    }

    // 创建发布记录
    const { data: publishRecord, error } = await DatabaseService.createPublishRecord({
      task_id: video.task_id,
      account_id,
      platform,
      title,
      description: description || '',
      tags: tags || [],
      status: scheduled_at ? 'scheduled' : 'pending',
      publish_config: {
        video_id,
        scheduled_at,
        metadata: {
          original_title: video.title,
          duration: video.duration,
          file_size: video.file_size
        }
      },
      scheduled_at: scheduled_at || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create publish record', 'DATABASE_ERROR'));
    }

    // 如果不是定时发布，立即添加到发布队列
    if (!scheduled_at) {
      const videoPublishQueue = getVideoPublishQueue();
      if (videoPublishQueue) {
        await videoPublishQueue.add('publish', {
          publishId: publishRecord.id,
          videoId: video_id,
          accountId: account_id,
          platform,
          title,
          description,
          tags
        });
      } else {
        console.log('⚠️  Redis not available, skipping queue processing');
      }
    }

    res.json(responseUtils.success(publishRecord, 'Video publish request created successfully'));

  } catch (error) {
    console.error('Publish video error:', error);
    res.status(500).json(responseUtils.error('Failed to publish video', 'PUBLISH_ERROR'));
  }
});

// 定时发布
router.post('/schedule', authenticateToken, [
  body('publish_id').isUUID(),
  body('scheduled_at').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { publish_id, scheduled_at } = req.body;

    // 验证发布记录所有权
    const { data: publishRecord } = await DatabaseService.getPublishRecordById(publish_id);
    if (!publishRecord || publishRecord.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Publish record not found or access denied', 'ACCESS_DENIED'));
    }

    // 更新发布时间
    const { error } = await DatabaseService.updatePublishRecord(publish_id, {
      scheduled_at,
      status: 'scheduled',
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to schedule publish', 'SCHEDULE_ERROR'));
    }

    // 添加到定时任务队列（这里需要使用定时任务调度器）
    // 暂时返回成功
    res.json(responseUtils.success(null, 'Video scheduled for publish successfully'));

  } catch (error) {
    console.error('Schedule publish error:', error);
    res.status(500).json(responseUtils.error('Failed to schedule publish', 'SCHEDULE_ERROR'));
  }
});

// 获取发布历史
router.get('/history', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { limit = 50, page = 1 } = req.query;

    const { data: publishRecords, error } = await DatabaseService.getUserPublishRecords(userId, Number(limit));
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch publish history', 'DATABASE_ERROR'));
    }

    // 分页处理
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedRecords = publishRecords?.slice(startIndex, endIndex) || [];

    res.json(responseUtils.success({
      records: paginatedRecords,
      pagination: {
        total: publishRecords?.length || 0,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil((publishRecords?.length || 0) / Number(limit))
      }
    }, 'Publish history retrieved successfully'));

  } catch (error) {
    console.error('Get publish history error:', error);
    res.status(500).json(responseUtils.error('Failed to get publish history', 'HISTORY_ERROR'));
  }
});

// 取消发布
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const publishId = req.params.id;

    // 验证发布记录所有权
    const { data: publishRecord } = await DatabaseService.getPublishRecordById(publishId);
    if (!publishRecord || publishRecord.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Publish record not found or access denied', 'ACCESS_DENIED'));
    }

    // 只能取消待发布或已计划的发布
    if (!['pending', 'scheduled'].includes(publishRecord.status)) {
      return res.status(400).json(responseUtils.error('Publish cannot be cancelled', 'INVALID_STATUS'));
    }

    const { error } = await DatabaseService.updatePublishRecord(publishId, {
      status: 'cancelled',
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to cancel publish', 'CANCEL_ERROR'));
    }

    res.json(responseUtils.success(null, 'Publish cancelled successfully'));

  } catch (error) {
    console.error('Cancel publish error:', error);
    res.status(500).json(responseUtils.error('Failed to cancel publish', 'CANCEL_ERROR'));
  }
});



export default router;