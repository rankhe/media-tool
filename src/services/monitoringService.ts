import api from './api';

export interface Platform {
  id: number;
  platform_name: string;
  platform_label: string;
  api_base_url: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_active: boolean;
  rate_limit_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MonitoringUser {
  id: number;
  user_id: number;
  platform: string;
  platform_label: string;
  target_user_id: string;
  target_username?: string;
  target_display_name?: string;
  target_avatar_url?: string;
  target_follower_count: number;
  target_verified: boolean;
  target_bio?: string;
  category?: string;
  monitoring_status: 'active' | 'paused' | 'stopped';
  check_frequency_minutes: number;
  last_check_at?: string;
  last_post_id?: string;
  last_post_content?: string;
  post_count: number;
  error_count: number;
  error_message?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitoredPost {
  id: number;
  monitoring_user_id: number;
  platform: string;
  platform_label: string;
  post_id: string;
  post_url?: string;
  post_type: 'text' | 'image' | 'video' | 'mixed';
  post_content: string;
  post_images: string[];
  post_videos: string[];
  post_metadata: Record<string, any>;
  published_at: string;
  is_new: boolean;
  notification_sent: boolean;
  notification_sent_at?: string;
  notification_error?: string;
  created_at: string;
  target_username?: string;
  target_display_name?: string;
}

export interface WebhookConfig {
  id: number;
  user_id: number;
  webhook_name: string;
  webhook_type: 'feishu' | 'wechat_work' | 'dingtalk' | 'custom';
  webhook_url: string;
  webhook_secret?: string;
  webhook_headers?: Record<string, string>;
  message_template?: string;
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_sent_at?: string;
  last_error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface MonitoringStats {
  id: number;
  user_id: number;
  platform: string;
  platform_label: string;
  date: string;
  total_checks: number;
  new_posts_found: number;
  notifications_sent: number;
  errors_count: number;
  monitored_users_count: number;
  total_posts_detected: number;
  created_at: string;
  updated_at: string;
}

export interface SchedulerStatus {
  isActive: boolean;
  lastCheck: string;
  nextCheck: string;
}

const monitoringService = {
  // Platform management
  getPlatforms: async () => {
    try {
      const response = await api.get('/monitoring/platforms');
      return response.data;
    } catch (error) {
      console.error('Error fetching platforms:', error);
      throw new Error('获取平台配置失败，请检查网络连接');
    }
  },

  updatePlatform: async (platformName: string, config: Partial<Platform>) => {
    const response = await api.put(`/monitoring/platforms/${platformName}`, config);
    return response.data;
  },

  // Monitoring users management
  getMonitoringUsers: async (params?: { platform?: string; status?: string }) => {
    try {
      const response = await api.get('/monitoring/users', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching monitoring users:', error);
      throw new Error('获取监控用户失败，请检查网络连接');
    }
  },

  addMonitoringUser: async (userData: {
    platform: string;
    target_user_id: string;
    target_username?: string;
    category?: string;
    check_frequency_minutes?: number;
  }) => {
    const response = await api.post('/monitoring/users', userData);
    return response.data;
  },

  updateMonitoringUser: async (id: number, updates: Partial<MonitoringUser>) => {
    const response = await api.put(`/monitoring/users/${id}`, updates);
    return response.data;
  },

  deleteMonitoringUser: async (id: number) => {
    const response = await api.delete(`/monitoring/users/${id}`);
    return response.data;
  },

  // Monitored posts
  getMonitoredPosts: async (params?: {
    platform?: string;
    is_new?: boolean;
    limit?: number;
    offset?: number;
    monitoring_user_id?: number;
    start_date?: string;
    end_date?: string;
    q?: string;
  }) => {
    const response = await api.get('/monitoring/posts', { params });
    return response.data;
  },

  // Webhook configurations
  getWebhookConfigs: async () => {
    const response = await api.get('/monitoring/webhooks');
    return response.data;
  },

  createWebhookConfig: async (webhookData: {
    webhook_name: string;
    webhook_type: 'feishu' | 'wechat_work' | 'dingtalk' | 'custom';
    webhook_url: string;
    webhook_secret?: string;
    webhook_headers?: Record<string, string>;
    message_template?: string;
  }) => {
    const response = await api.post('/monitoring/webhooks', webhookData);
    return response.data;
  },

  testWebhook: async (id: number) => {
    const response = await api.post(`/monitoring/webhooks/${id}/test`);
    return response.data;
  },

  // Fetch posts by days
  fetchUserPostsByDays: async (userId: number, daysBack: number) => {
    const response = await api.post(`/monitoring/users/${userId}/fetch-posts`, { days_back: daysBack });
    return response.data;
  },

  // Statistics
  getMonitoringStats: async (params?: {
    platform?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/monitoring/stats', { params });
    return response.data;
  },

  // Admin operations
  runManualCheck: async () => {
    const response = await api.post('/monitoring-admin/check-now');
    return response.data;
  },

  getSchedulerStatus: async () => {
    const response = await api.get('/monitoring-admin/scheduler-status');
    return response.data;
  },

  startScheduler: async () => {
    const response = await api.post('/monitoring-admin/scheduler/start');
    return response.data;
  },

  stopScheduler: async () => {
    const response = await api.post('/monitoring-admin/scheduler/stop');
    return response.data;
  },

  publishToZhihu: async (payload: {
    type: 'idea' | 'article';
    title?: string;
    content: string;
    images?: string[];
    source_url?: string;
  }) => {
    const response = await api.post('/zhihu/publish', payload);
    return response.data;
  },

  setZhihuConfig: async (data: { cookie_string?: string; cookies_json_file?: File }) => {
    const form = new FormData();
    if (data.cookie_string) form.append('cookie_string', data.cookie_string);
    if (data.cookies_json_file) form.append('cookies_json', data.cookies_json_file);
    const response = await api.post('/zhihu/config', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  getZhihuConfigStatus: async () => {
    const response = await api.get('/zhihu/config/status');
    return response.data;
  },
};

export default monitoringService;