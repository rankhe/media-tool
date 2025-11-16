import express from 'express';
import { query, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取仪表盘统计数据
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await DatabaseService.getUserStats(userId);
    
    res.json(responseUtils.success(stats, 'Dashboard stats retrieved successfully'));

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json(responseUtils.error('Failed to get dashboard stats', 'STATS_ERROR'));
  }
});

// 获取任务统计数据
router.get('/tasks', authenticateToken, [
  query('time_range').optional().isIn(['day', 'week', 'month', 'year'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { time_range = 'week' } = req.query;

    // 根据时间范围计算日期
    const now = new Date();
    let startDate: Date;
    
    switch (time_range) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 获取用户的任务数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);
    
    // 筛选指定时间范围内的任务
    const filteredTasks = tasks?.filter(task => 
      new Date(task.created_at) >= startDate
    ) || [];

    // 统计任务状态
    const taskStats = {
      total: filteredTasks.length,
      pending: filteredTasks.filter(task => task.status === 'pending').length,
      running: filteredTasks.filter(task => task.status === 'running').length,
      completed: filteredTasks.filter(task => task.status === 'completed').length,
      failed: filteredTasks.filter(task => task.status === 'failed').length,
      cancelled: filteredTasks.filter(task => task.status === 'cancelled').length,
      success_rate: filteredTasks.length > 0 
        ? Math.round((filteredTasks.filter(task => task.status === 'completed').length / filteredTasks.length) * 100)
        : 0
    };

    // 按日期分组统计
    const dailyStats = filteredTasks.reduce((acc: any, task) => {
      const date = new Date(task.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, completed: 0, failed: 0 };
      }
      acc[date].total++;
      if (task.status === 'completed') acc[date].completed++;
      if (task.status === 'failed') acc[date].failed++;
      return acc;
    }, {});

    res.json(responseUtils.success({
      task_stats: taskStats,
      daily_stats: dailyStats,
      time_range: time_range,
      start_date: startDate.toISOString(),
      end_date: now.toISOString()
    }, 'Task stats retrieved successfully'));

  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json(responseUtils.error('Failed to get task stats', 'STATS_ERROR'));
  }
});

// 获取平台统计数据
router.get('/platforms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 获取用户的发布记录
    const { data: publishRecords } = await DatabaseService.getUserPublishRecords(userId);
    
    // 按平台统计
    const platformStats = publishRecords?.reduce((acc: any, record) => {
      const platform = record.platform;
      if (!acc[platform]) {
        acc[platform] = {
          total_publishes: 0,
          successful_publishes: 0,
          failed_publishes: 0,
          success_rate: 0
        };
      }
      
      acc[platform].total_publishes++;
      if (record.status === 'published') {
        acc[platform].successful_publishes++;
      } else if (record.status === 'failed') {
        acc[platform].failed_publishes++;
      }
      
      return acc;
    }, {});

    // 计算成功率
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      stats.success_rate = stats.total_publishes > 0 
        ? Math.round((stats.successful_publishes / stats.total_publishes) * 100)
        : 0;
    });

    // 获取用户的账号数据
    const { data: accounts } = await DatabaseService.getUserAccounts(userId);
    
    // 账号统计
    const accountStats = accounts?.reduce((acc: any, account) => {
      const platform = account.platform;
      if (!acc[platform]) {
        acc[platform] = {
          total_accounts: 0,
          active_accounts: 0,
          inactive_accounts: 0
        };
      }
      
      acc[platform].total_accounts++;
      if (account.is_active) {
        acc[platform].active_accounts++;
      } else {
        acc[platform].inactive_accounts++;
      }
      
      return acc;
    }, {});

    res.json(responseUtils.success({
      platform_stats: platformStats,
      account_stats: accountStats,
      total_platforms: Object.keys(platformStats).length,
      total_accounts: accounts?.length || 0
    }, 'Platform stats retrieved successfully'));

  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json(responseUtils.error('Failed to get platform stats', 'STATS_ERROR'));
  }
});



export default router;