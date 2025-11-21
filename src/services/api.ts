import axios from 'axios';
import { useStore } from '../store';

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 401) {
      localStorage.removeItem('token');
      try { useStore.getState().setUser(null); } catch {}
      if (window.location.pathname !== '/login') window.location.href = '/login';
    } else if (status === 403) {
      const err = data?.error;
      const isTokenInvalid = typeof err === 'string' 
        ? /invalid|expired/i.test(err)
        : /invalid|expired/i.test(String(err?.message || '')) || /TOKEN/i.test(String(err?.code || ''));
      if (isTokenInvalid) {
        localStorage.removeItem('token');
        try { useStore.getState().setUser(null); } catch {}
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData: { email: string; password: string; name: string }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

// 账号管理API
export const accountAPI = {
  getAccounts: async () => {
    const response = await api.get('/accounts');
    return response.data;
  },

  bindAccount: async (platform: string, authData: any) => {
    const response = await api.post('/accounts/bind', { platform, ...authData });
    return response.data;
  },

  unbindAccount: async (accountId: string) => {
    const response = await api.delete(`/accounts/${accountId}`);
    return response.data;
  },

  refreshAccount: async (accountId: string) => {
    const response = await api.post(`/accounts/${accountId}/refresh`);
    return response.data;
  },
};

// 视频发现API
export const videoAPI = {
  discoverVideos: async (params: {
    platform?: string;
    keyword?: string;
    category?: string;
    limit?: number;
    page?: number;
  }) => {
    const response = await api.get('/videos/discover', { params });
    return response.data;
  },

  searchVideos: async (query: string, platform?: string) => {
    const response = await api.get('/videos/search', { 
      params: { q: query, platform } 
    });
    return response.data;
  },

  getVideoInfo: async (platform: string, videoId: string) => {
    const response = await api.get(`/videos/${platform}/${videoId}`);
    return response.data;
  },

  getTrendingVideos: async (platform?: string, limit = 20) => {
    const response = await api.get('/videos/trending', { 
      params: { platform, limit } 
    });
    return response.data;
  },

  clearDiscoveryCache: async () => {
    const response = await api.delete('/videos/cache');
    return response.data;
  },
};

// 任务管理API
export const taskAPI = {
  getTasks: async (params?: { status?: string; limit?: number; page?: number }) => {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  getTask: async (taskId: string) => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
  },

  createTask: async (taskData: {
    task_type: 'download' | 'process' | 'publish' | 'batch';
    source_config: any;
    target_config?: any;
    processing_config?: any;
  }) => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  updateTask: async (taskId: string, updates: any) => {
    const response = await api.put(`/tasks/${taskId}`, updates);
    return response.data;
  },

  cancelTask: async (taskId: string) => {
    const response = await api.post(`/tasks/${taskId}/cancel`);
    return response.data;
  },

  deleteTask: async (taskId: string) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
  },
};

// 视频处理API
export const videoProcessingAPI = {
  downloadVideo: async (url: string, options?: any) => {
    const response = await api.post('/videos/download', { url, options });
    return response.data;
  },

  processVideo: async (videoId: string, processingConfig: any) => {
    const response = await api.post(`/videos/${videoId}/process`, processingConfig);
    return response.data;
  },

  uploadVideo: async (formData: FormData) => {
    const response = await api.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getVideoUrl: async (videoId: string) => {
    const response = await api.get(`/videos/${videoId}/url`);
    return response.data;
  },
};

// 发布管理API
export const publishAPI = {
  publishVideo: async (publishData: {
    video_id: string;
    account_id: string;
    platform: string;
    title: string;
    description?: string;
    tags?: string[];
    cover_image?: string;
    scheduled_at?: string;
  }) => {
    const response = await api.post('/publish', publishData);
    return response.data;
  },

  schedulePublish: async (scheduleData: any) => {
    const response = await api.post('/publish/schedule', scheduleData);
    return response.data;
  },

  getPublishHistory: async (params?: { limit?: number; page?: number }) => {
    const response = await api.get('/publish/history', { params });
    return response.data;
  },

  cancelPublish: async (publishId: string) => {
    const response = await api.post(`/publish/${publishId}/cancel`);
    return response.data;
  },
};

// 统计API
export const statsAPI = {
  getDashboardStats: async () => {
    const response = await api.get('/stats/dashboard');
    return response.data;
  },

  getTaskStats: async (timeRange?: string) => {
    const response = await api.get('/stats/tasks', { params: { time_range: timeRange } });
    return response.data;
  },

  getPlatformStats: async () => {
    const response = await api.get('/stats/platforms');
    return response.data;
  },
};

// 微信公众号热门API
export const wechatAPI = {
  explodes: async (limit?: number) => {
    const response = await api.get('/wechat/explodes', { params: { limit } });
    return response.data;
  },

  qualityAccounts: async (limit?: number) => {
    const response = await api.get('/wechat/quality-accounts', { params: { limit } });
    return response.data;
  },

  hotArticles: async (limit?: number) => {
    const response = await api.get('/wechat/hot-articles', { params: { limit } });
    return response.data;
  },

  overview: async () => {
    const response = await api.get('/wechat/overview');
    return response.data;
  },
};

// 微信公众号公开API（无鉴权）
export const wechatPublicAPI = {
  explodes: async (limit?: number) => {
    const response = await api.get('/wechat-public/explodes', { params: { limit } });
    return response.data;
  },

  qualityAccounts: async (limit?: number) => {
    const response = await api.get('/wechat-public/quality-accounts', { params: { limit } });
    return response.data;
  },

  hotArticles: async (limit?: number) => {
    const response = await api.get('/wechat-public/hot-articles', { params: { limit } });
    return response.data;
  },

  overview: async () => {
    const response = await api.get('/wechat-public/overview');
    return response.data;
  },
};

export default api;