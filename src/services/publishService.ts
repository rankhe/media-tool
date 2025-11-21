import api from './api';

export interface PublishTask {
  id: string;
  title: string;
  videoUrl: string;
  platforms: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledTime?: string;
  publishedTime?: string;
  error?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublishTaskData {
  title: string;
  videoUrl?: string;
  videoId?: string;
  platforms: string[];
  scheduledTime?: string;
  description?: string;
  tags?: string[];
}

export interface UpdatePublishTaskData extends Partial<CreatePublishTaskData> {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export const publishService = {
  // 获取所有发布任务
  async getPublishTasks(): Promise<PublishTask[]> {
    try {
      const response = await api.get('/publish-tasks');
      const payload = response.data;
      return (payload && payload.data) ? payload.data : payload;
    } catch (error) {
      // 如果API不可用，返回模拟数据
      console.warn('API unavailable, using mock data for publish tasks');
      return this.getMockPublishTasks();
    }
  },

  // 获取单个发布任务
  async getPublishTask(id: string): Promise<PublishTask> {
    try {
      const response = await api.get(`/publish-tasks/${id}`);
      const payload = response.data;
      return (payload && payload.data) ? payload.data : payload;
    } catch (error) {
      const tasks = await this.getPublishTasks();
      const task = tasks.find(t => t.id === id);
      if (!task) {
        throw new Error('发布任务不存在');
      }
      return task;
    }
  },

  // 创建发布任务
  async createPublishTask(data: CreatePublishTaskData): Promise<PublishTask> {
    try {
      const response = await api.post('/publish-tasks', data);
      const payload = response.data;
      return (payload && payload.data) ? payload.data : payload;
    } catch (error) {
      // 如果API不可用，创建模拟数据
      console.warn('API unavailable, creating mock publish task');
      const newTask: PublishTask = {
        id: Date.now().toString(),
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return newTask;
    }
  },

  // 更新发布任务
  async updatePublishTask(id: string, data: UpdatePublishTaskData): Promise<PublishTask> {
    try {
      const response = await api.put(`/publish-tasks/${id}`, data);
      const payload = response.data;
      return (payload && payload.data) ? payload.data : payload;
    } catch (error) {
      // 如果API不可用，返回更新后的模拟数据
      console.warn('API unavailable, updating mock publish task');
      const task = await this.getPublishTask(id);
      return {
        ...task,
        ...data,
        updatedAt: new Date().toISOString(),
      };
    }
  },

  // 删除发布任务
  async deletePublishTask(id: string): Promise<void> {
    try {
      await api.delete(`/publish-tasks/${id}`);
    } catch (error) {
      // 如果API不可用，模拟删除成功
      console.warn('API unavailable, simulating publish task deletion');
    }
  },

  // 立即发布
  async publishNow(id: string): Promise<void> {
    try {
      await api.post(`/publish-tasks/${id}/publish`);
    } catch (error) {
      // 如果API不可用，模拟发布成功
      console.warn('API unavailable, simulating immediate publish');
      // 模拟发布过程
      setTimeout(async () => {
        await this.updatePublishTask(id, { 
          status: 'processing',
          publishedTime: new Date().toISOString()
        });
        
        // 模拟发布完成
        setTimeout(async () => {
          await this.updatePublishTask(id, { status: 'completed' });
        }, 5000);
      }, 1000);
    }
  },

  // 批量发布
  async batchPublish(ids: string[]): Promise<void> {
    try {
      await api.post('/publish-tasks/batch-publish', { ids });
    } catch (error) {
      // 如果API不可用，模拟批量发布
      console.warn('API unavailable, simulating batch publish');
      for (const id of ids) {
        await this.publishNow(id);
      }
    }
  },

  // 获取发布统计
  async getPublishStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const response = await api.get('/publish-tasks/stats');
      const payload = response.data;
      return (payload && payload.data) ? payload.data : payload;
    } catch (error) {
      // 如果API不可用，返回模拟统计数据
      console.warn('API unavailable, using mock publish stats');
      const tasks = await this.getMockPublishTasks();
      return {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      };
    }
  },

  // 获取模拟数据
  getMockPublishTasks(): PublishTask[] {
    const now = Date.now();
    return [
      {
        id: '1',
        title: '搞笑短视频合集',
        videoUrl: '/videos/funny-compilation.mp4',
        platforms: ['douyin', 'kuaishou'],
        status: 'completed',
        publishedTime: new Date(now - 3600000).toISOString(), // 1小时前
        description: '精选搞笑短视频，让你笑不停',
        tags: ['搞笑', '短视频', '娱乐'],
        createdAt: new Date(now - 7200000).toISOString(), // 2小时前
        updatedAt: new Date(now - 3600000).toISOString(),
      },
      {
        id: '2',
        title: '美食制作教程',
        videoUrl: '/videos/cooking-tutorial.mp4',
        platforms: ['xiaohongshu', 'bilibili'],
        status: 'processing',
        description: '简单易学的家常菜制作方法',
        tags: ['美食', '教程', '烹饪'],
        createdAt: new Date(now - 1800000).toISOString(), // 30分钟前
        updatedAt: new Date(now - 300000).toISOString(), // 5分钟前
      },
      {
        id: '3',
        title: '旅游风景分享',
        videoUrl: '/videos/travel-scenery.mp4',
        platforms: ['wechat', 'douyin'],
        status: 'pending',
        scheduledTime: new Date(now + 3600000).toISOString(), // 1小时后
        description: '美丽的旅游风景，带你领略大自然的美',
        tags: ['旅游', '风景', '自然'],
        createdAt: new Date(now - 900000).toISOString(), // 15分钟前
        updatedAt: new Date(now - 900000).toISOString(),
      },
      {
        id: '4',
        title: '科技产品评测',
        videoUrl: '/videos/tech-review.mp4',
        platforms: ['bilibili'],
        status: 'failed',
        error: '视频格式不支持',
        description: '最新科技产品详细评测',
        tags: ['科技', '评测', '产品'],
        createdAt: new Date(now - 5400000).toISOString(), // 1.5小时前
        updatedAt: new Date(now - 2700000).toISOString(), // 45分钟前
      },
    ];
  },
};