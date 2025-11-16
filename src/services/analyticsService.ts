import api from './api';

export interface StatsParams {
  dateRange?: string[];
  platform?: string;
}

export interface StatsData {
  totalVideos: number;
  totalDownloads: number;
  totalPublishes: number;
  successRate: number;
  platformStats: Array<{
    platform: string;
    videos: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  dailyStats: Array<{
    date: string;
    downloads: number;
    processes: number;
    publishes: number;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    createdAt: string;
  }>;
}

export const analyticsService = {
  // 获取统计数据
  async getStats(params?: StatsParams): Promise<StatsData> {
    try {
      const response = await api.get('/analytics/stats', { params });
      return response.data;
    } catch (error) {
      // 如果API不可用，返回模拟数据
      console.warn('API unavailable, using mock analytics data');
      return this.getMockStats();
    }
  },

  // 获取趋势数据
  async getTrends(params?: StatsParams): Promise<any> {
    try {
      const response = await api.get('/analytics/trends', { params });
      return response.data;
    } catch (error) {
      // 如果API不可用，返回模拟趋势数据
      console.warn('API unavailable, using mock trends data');
      return this.getMockTrends();
    }
  },

  // 获取平台对比数据
  async getPlatformComparison(params?: StatsParams): Promise<any> {
    try {
      const response = await api.get('/analytics/platform-comparison', { params });
      return response.data;
    } catch (error) {
      // 如果API不可用，返回模拟对比数据
      console.warn('API unavailable, using mock platform comparison');
      return this.getMockPlatformComparison();
    }
  },

  // 获取任务统计
  async getTaskStats(params?: StatsParams): Promise<any> {
    try {
      const response = await api.get('/analytics/task-stats', { params });
      return response.data;
    } catch (error) {
      // 如果API不可用，返回模拟任务统计
      console.warn('API unavailable, using mock task stats');
      return this.getMockTaskStats();
    }
  },

  // 获取性能指标
  async getPerformanceMetrics(params?: StatsParams): Promise<any> {
    try {
      const response = await api.get('/analytics/performance', { params });
      return response.data;
    } catch (error) {
      // 如果API不可用，返回模拟性能指标
      console.warn('API unavailable, using mock performance metrics');
      return this.getMockPerformanceMetrics();
    }
  },

  // 导出报告
  async exportReport(format: 'pdf' | 'excel' | 'csv', params?: StatsParams): Promise<Blob> {
    try {
      const response = await api.get('/analytics/export', {
        params: { format, ...params },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      // 如果API不可用，创建模拟报告文件
      console.warn('API unavailable, creating mock report');
      const mockContent = '日期,平台,下载数,处理数,发布数,成功率\n' +
        '2024-01-01,抖音,10,8,7,87.5\n' +
        '2024-01-01,快手,8,7,6,85.7\n' +
        '2024-01-02,抖音,12,10,9,90.0\n' +
        '2024-01-02,快手,9,8,7,87.5\n';
      
      return new Blob([mockContent], { type: 'text/csv' });
    }
  },

  // 获取模拟统计数据
  getMockStats(): StatsData {
    const now = new Date();
    const dailyStats = [];
    
    // 生成最近7天的数据
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dailyStats.push({
        date: date.toISOString().split('T')[0],
        downloads: Math.floor(Math.random() * 20) + 10,
        processes: Math.floor(Math.random() * 15) + 8,
        publishes: Math.floor(Math.random() * 12) + 5,
      });
    }

    return {
      totalVideos: 156,
      totalDownloads: 234,
      totalPublishes: 189,
      successRate: 87.5,
      platformStats: [
        {
          platform: 'douyin',
          videos: 45,
          views: 12500,
          likes: 890,
          comments: 234,
          shares: 156,
        },
        {
          platform: 'kuaishou',
          videos: 38,
          views: 9800,
          likes: 678,
          comments: 189,
          shares: 123,
        },
        {
          platform: 'xiaohongshu',
          videos: 32,
          views: 7200,
          likes: 456,
          comments: 167,
          shares: 89,
        },
        {
          platform: 'bilibili',
          videos: 28,
          views: 15600,
          likes: 1234,
          comments: 345,
          shares: 234,
        },
        {
          platform: 'wechat',
          videos: 13,
          views: 3400,
          likes: 234,
          comments: 78,
          shares: 45,
        },
      ],
      dailyStats,
      recentTasks: [
        {
          id: '1',
          title: '搞笑短视频合集',
          platform: 'douyin',
          status: 'completed',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          title: '美食制作教程',
          platform: 'kuaishou',
          status: 'processing',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          title: '旅游风景分享',
          platform: 'xiaohongshu',
          status: 'pending',
          createdAt: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: '4',
          title: '科技产品评测',
          platform: 'bilibili',
          status: 'failed',
          createdAt: new Date(Date.now() - 14400000).toISOString(),
        },
      ],
    };
  },

  // 获取模拟趋势数据
  getMockTrends() {
    const now = new Date();
    const trends = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split('T')[0],
        downloads: Math.floor(Math.random() * 30) + 15,
        processes: Math.floor(Math.random() * 25) + 10,
        publishes: Math.floor(Math.random() * 20) + 8,
        successRate: Math.random() * 20 + 75,
      });
    }
    
    return trends;
  },

  // 获取模拟平台对比数据
  getMockPlatformComparison() {
    return [
      {
        platform: 'douyin',
        downloads: 89,
        processes: 76,
        publishes: 68,
        avgViews: 1250,
        avgLikes: 89,
        successRate: 89.5,
      },
      {
        platform: 'kuaishou',
        downloads: 67,
        processes: 58,
        publishes: 52,
        avgViews: 980,
        avgLikes: 67,
        successRate: 86.2,
      },
      {
        platform: 'xiaohongshu',
        downloads: 45,
        processes: 41,
        publishes: 37,
        avgViews: 720,
        avgLikes: 45,
        successRate: 90.3,
      },
      {
        platform: 'bilibili',
        downloads: 34,
        processes: 31,
        publishes: 28,
        avgViews: 1560,
        avgLikes: 123,
        successRate: 87.1,
      },
      {
        platform: 'wechat',
        downloads: 23,
        processes: 21,
        publishes: 19,
        avgViews: 340,
        avgLikes: 23,
        successRate: 82.6,
      },
    ];
  },

  // 获取模拟任务统计
  getMockTaskStats() {
    return {
      totalTasks: 234,
      completedTasks: 189,
      failedTasks: 28,
      processingTasks: 17,
      avgProcessingTime: 12.5, // 分钟
      taskTypes: {
        download: 89,
        process: 76,
        publish: 69,
      },
      hourlyDistribution: [
        { hour: 0, tasks: 5 },
        { hour: 1, tasks: 3 },
        { hour: 2, tasks: 2 },
        { hour: 3, tasks: 1 },
        { hour: 4, tasks: 2 },
        { hour: 5, tasks: 4 },
        { hour: 6, tasks: 8 },
        { hour: 7, tasks: 12 },
        { hour: 8, tasks: 15 },
        { hour: 9, tasks: 18 },
        { hour: 10, tasks: 22 },
        { hour: 11, tasks: 19 },
        { hour: 12, tasks: 16 },
        { hour: 13, tasks: 14 },
        { hour: 14, tasks: 17 },
        { hour: 15, tasks: 20 },
        { hour: 16, tasks: 18 },
        { hour: 17, tasks: 15 },
        { hour: 18, tasks: 12 },
        { hour: 19, tasks: 10 },
        { hour: 20, tasks: 8 },
        { hour: 21, tasks: 6 },
        { hour: 22, tasks: 4 },
        { hour: 23, tasks: 3 },
      ],
    };
  },

  // 获取模拟性能指标
  getMockPerformanceMetrics() {
    return {
      avgDownloadSpeed: '2.5MB/s',
      avgProcessingTime: '12.5分钟',
      avgPublishTime: '3.2分钟',
      systemUptime: '99.8%',
      errorRate: '2.1%',
      queueLength: 7,
      activeWorkers: 4,
      memoryUsage: '68%',
      cpuUsage: '45%',
      diskUsage: '78%',
    };
  },
};