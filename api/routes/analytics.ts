import express from 'express';
import { query, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取统计数据
router.get('/stats', authenticateToken, [
  query('dateRange').optional().isArray(),
  query('platform').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { dateRange, platform } = req.query;

    // 获取用户的任务数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);
    
    // 获取用户的发布记录
    const { data: publishRecords } = await DatabaseService.getUserPublishRecords(userId);
    
    // 获取用户的账号数据
    const { data: accounts } = await DatabaseService.getUserAccounts(userId);

    // 基础统计
    const totalVideos = tasks?.length || 0;
    const totalDownloads = tasks?.filter(t => t.type === 'download').length || 0;
    const totalPublishes = publishRecords?.length || 0;
    
    // 计算成功率
    const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
    const successRate = totalVideos > 0 ? Math.round((completedTasks / totalVideos) * 100) : 0;

    // 平台统计
    const platformStats = [];
    const platformData: Record<string, any> = {};

    // 统计各平台数据
    publishRecords?.forEach(record => {
      const platform = record.platform;
      if (!platformData[platform]) {
        platformData[platform] = {
          platform,
          videos: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0
        };
      }
      
      platformData[platform].videos++;
      // 这里应该获取实际的播放量、点赞等数据
      // 现在使用模拟数据
      platformData[platform].views += Math.floor(Math.random() * 1000) + 100;
      platformData[platform].likes += Math.floor(Math.random() * 100) + 10;
      platformData[platform].comments += Math.floor(Math.random() * 50) + 5;
      platformData[platform].shares += Math.floor(Math.random() * 30) + 3;
    });

    Object.values(platformData).forEach(stat => {
      platformStats.push(stat);
    });

    // 每日统计（最近7天）
    const dailyStats = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTasks = tasks?.filter(t => 
        new Date(t.created_at).toISOString().split('T')[0] === dateStr
      ) || [];
      
      const dayPublishes = publishRecords?.filter(p => 
        new Date(p.created_at).toISOString().split('T')[0] === dateStr
      ) || [];
      
      dailyStats.push({
        date: dateStr,
        downloads: dayTasks.filter(t => t.type === 'download').length,
        processes: dayTasks.filter(t => t.type === 'process').length,
        publishes: dayPublishes.length
      });
    }

    // 最近任务
    const recentTasks = tasks?.slice(0, 10).map(task => ({
      id: task.id,
      title: task.title,
      platform: task.platform || 'unknown',
      status: task.status,
      createdAt: task.created_at
    })) || [];

    const stats = {
      totalVideos,
      totalDownloads,
      totalPublishes,
      successRate,
      platformStats,
      dailyStats,
      recentTasks
    };

    res.json(responseUtils.success(stats, 'Analytics stats retrieved successfully'));

  } catch (error) {
    console.error('Get analytics stats error:', error);
    res.status(500).json(responseUtils.error('Failed to get analytics stats', 'STATS_ERROR'));
  }
});

// 获取趋势数据
router.get('/trends', authenticateToken, [
  query('dateRange').optional().isArray(),
  query('platform').optional().isString(),
  query('metric').optional().isIn(['downloads', 'processes', 'publishes', 'success_rate'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { dateRange, platform, metric = 'downloads' } = req.query;

    // 获取用户的任务数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);
    
    // 获取用户的发布记录
    const { data: publishRecords } = await DatabaseService.getUserPublishRecords(userId);

    // 生成趋势数据（最近30天）
    const trends = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTasks = tasks?.filter(t => 
        new Date(t.created_at).toISOString().split('T')[0] === dateStr
      ) || [];
      
      const dayPublishes = publishRecords?.filter(p => 
        new Date(p.created_at).toISOString().split('T')[0] === dateStr
      ) || [];
      
      let value = 0;
      switch (metric) {
        case 'downloads':
          value = dayTasks.filter(t => t.type === 'download').length;
          break;
        case 'processes':
          value = dayTasks.filter(t => t.type === 'process').length;
          break;
        case 'publishes':
          value = dayPublishes.length;
          break;
        case 'success_rate':
          const completed = dayTasks.filter(t => t.status === 'completed').length;
          const total = dayTasks.length;
          value = total > 0 ? Math.round((completed / total) * 100) : 0;
          break;
      }
      
      trends.push({
        date: dateStr,
        value
      });
    }

    res.json(responseUtils.success(trends, 'Trends data retrieved successfully'));

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json(responseUtils.error('Failed to get trends', 'TRENDS_ERROR'));
  }
});

// 获取平台对比数据
router.get('/platform-comparison', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取用户的发布记录
    const { data: publishRecords } = await DatabaseService.getUserPublishRecords(userId);
    
    // 获取用户的账号数据
    const { data: accounts } = await DatabaseService.getUserAccounts(userId);

    // 平台对比数据
    const platformComparison = [];
    const platformData: Record<string, any> = {};

    // 统计各平台数据
    publishRecords?.forEach(record => {
      const platform = record.platform;
      if (!platformData[platform]) {
        platformData[platform] = {
          platform,
          downloads: 0,
          processes: 0,
          publishes: 0,
          avgViews: 0,
          avgLikes: 0,
          successRate: 0
        };
      }
      
      platformData[platform].publishes++;
      // 使用模拟数据填充其他指标
      platformData[platform].downloads += Math.floor(Math.random() * 5) + 1;
      platformData[platform].processes += Math.floor(Math.random() * 3) + 1;
      platformData[platform].avgViews += Math.floor(Math.random() * 500) + 100;
      platformData[platform].avgLikes += Math.floor(Math.random() * 50) + 10;
    });

    // 计算平均数据和成功率
    Object.values(platformData).forEach(data => {
      if (data.publishes > 0) {
        data.avgViews = Math.round(data.avgViews / data.publishes);
        data.avgLikes = Math.round(data.avgLikes / data.publishes);
        data.successRate = Math.floor(Math.random() * 20) + 75; // 75-95%
      }
      platformComparison.push(data);
    });

    res.json(responseUtils.success(platformComparison, 'Platform comparison data retrieved successfully'));

  } catch (error) {
    console.error('Get platform comparison error:', error);
    res.status(500).json(responseUtils.error('Failed to get platform comparison', 'COMPARISON_ERROR'));
  }
});

// 获取任务统计
router.get('/task-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取用户的任务数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);

    // 任务统计
    const taskStats = {
      totalTasks: tasks?.length || 0,
      completedTasks: tasks?.filter(t => t.status === 'completed').length || 0,
      failedTasks: tasks?.filter(t => t.status === 'failed').length || 0,
      processingTasks: tasks?.filter(t => t.status === 'processing').length || 0,
      avgProcessingTime: 12.5, // 模拟平均处理时间
      taskTypes: {
        download: tasks?.filter(t => t.type === 'download').length || 0,
        process: tasks?.filter(t => t.type === 'process').length || 0,
        publish: tasks?.filter(t => t.type === 'publish').length || 0,
      },
      hourlyDistribution: [] as Array<{ hour: number; tasks: number }>
    };

    // 生成小时分布数据
    for (let hour = 0; hour < 24; hour++) {
      taskStats.hourlyDistribution.push({
        hour,
        tasks: Math.floor(Math.random() * 30) + 1
      });
    }

    res.json(responseUtils.success(taskStats, 'Task stats retrieved successfully'));

  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json(responseUtils.error('Failed to get task stats', 'STATS_ERROR'));
  }
});

// 获取性能指标
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取用户的任务数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);

    // 性能指标（模拟数据）
    const performanceMetrics = {
      avgDownloadSpeed: '2.5MB/s',
      avgProcessingTime: '12.5分钟',
      avgPublishTime: '3.2分钟',
      systemUptime: '99.8%',
      errorRate: tasks && tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'failed').length / tasks.length) * 100) : 0,
      queueLength: Math.floor(Math.random() * 20) + 1,
      activeWorkers: Math.floor(Math.random() * 5) + 1,
      memoryUsage: '68%',
      cpuUsage: '45%',
      diskUsage: '78%',
    };

    res.json(responseUtils.success(performanceMetrics, 'Performance metrics retrieved successfully'));

  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json(responseUtils.error('Failed to get performance metrics', 'PERFORMANCE_ERROR'));
  }
});

// 导出报告
router.get('/export', authenticateToken, [
  query('format').isIn(['pdf', 'excel', 'csv']),
  query('dateRange').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { format, dateRange } = req.query;

    // 获取统计数据
    const { data: tasks } = await DatabaseService.getUserTasks(userId, 1000);
    const { data: publishRecords } = await DatabaseService.getUserPublishRecords(userId);

    // 生成CSV格式的报告数据
    const csvData = [
      ['日期', '平台', '下载数', '处理数', '发布数', '成功率'],
      ...Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTasks = tasks?.filter(t => 
          new Date(t.created_at).toISOString().split('T')[0] === dateStr
        ) || [];
        
        const dayPublishes = publishRecords?.filter(p => 
          new Date(p.created_at).toISOString().split('T')[0] === dateStr
        ) || [];
        
        const downloads = dayTasks.filter(t => t.type === 'download').length;
        const processes = dayTasks.filter(t => t.type === 'process').length;
        const publishes = dayPublishes.length;
        const completed = dayTasks.filter(t => t.status === 'completed').length;
        const successRate = dayTasks.length > 0 ? Math.round((completed / dayTasks.length) * 100) : 0;
        
        return [dateStr, 'all', downloads, processes, publishes, successRate];
      })
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error('Export analytics report error:', error);
    res.status(500).json(responseUtils.error('Failed to export analytics report', 'EXPORT_ERROR'));
  }
});

export default router;