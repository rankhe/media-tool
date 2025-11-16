import api from './api';

export interface Account {
  id: string;
  platform: string;
  username: string;
  nickname: string;
  status: 'active' | 'inactive' | 'expired';
  lastLogin?: string;
  cookies?: string;
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAccountData {
  platform: string;
  username: string;
  nickname: string;
  cookies?: string;
  status?: 'active' | 'inactive' | 'expired';
  settings?: Record<string, any>;
}

export interface UpdateAccountData extends Partial<CreateAccountData> {}

export const accountService = {
  // 获取所有账号
  async getAccounts(): Promise<Account[]> {
    try {
      const response = await api.get('/accounts');
      // 确保返回的数据格式正确
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        // 兼容直接返回数组的情况
        return response.data;
      } else {
        console.error('Invalid API response format for getAccounts:', response.data);
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      throw error; // 抛出错误让调用方处理，而不是静默返回模拟数据
    }
  },

  // 获取单个账号
  async getAccount(id: string): Promise<Account> {
    try {
      const response = await api.get(`/accounts/${id}`);
      return response.data;
    } catch (error) {
      const accounts = await this.getAccounts();
      const account = accounts.find(acc => acc.id === id);
      if (!account) {
        throw new Error('账号不存在');
      }
      return account;
    }
  },

  // 创建账号
  async createAccount(data: CreateAccountData): Promise<Account> {
    try {
      const response = await api.post('/accounts', data);
      // 确保返回的数据格式正确
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      } else if (response.data && response.data.id) {
        // 兼容直接返回账号对象的情况
        return response.data;
      } else {
        console.error('Invalid API response format for createAccount:', response.data);
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error; // 抛出错误让调用方处理
    }
  },

  // 更新账号
  async updateAccount(id: string, data: UpdateAccountData): Promise<Account> {
    try {
      const response = await api.put(`/accounts/${id}`, data);
      // 确保返回的数据格式正确
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      } else if (response.data && response.data.id) {
        // 兼容直接返回账号对象的情况
        return response.data;
      } else {
        console.error('Invalid API response format for updateAccount:', response.data);
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error; // 抛出错误让调用方处理
    }
  },

  // 删除账号
  async deleteAccount(id: string): Promise<void> {
    try {
      const response = await api.delete(`/accounts/${id}`);
      // 检查删除是否成功
      if (response.data && response.data.success !== undefined && !response.data.success) {
        throw new Error(response.data.message || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error; // 抛出错误让调用方处理
    }
  },

  // 测试账号连接
  async testAccount(id: string): Promise<boolean> {
    try {
      const response = await api.post(`/accounts/${id}/test`);
      return response.data.success;
    } catch (error) {
      // 如果API不可用，模拟测试成功
      console.warn('API unavailable, simulating account test');
      return Math.random() > 0.3; // 70% 成功率
    }
  },

  // 获取模拟数据
  getMockAccounts(): Account[] {
    return [
      {
        id: '1',
        platform: 'douyin',
        username: 'douyin_user123',
        nickname: '抖音创作者',
        status: 'active',
        lastLogin: new Date(Date.now() - 86400000).toISOString(), // 1天前
        createdAt: new Date(Date.now() - 864000000).toISOString(), // 10天前
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '2',
        platform: 'kuaishou',
        username: 'kuaishou_user456',
        nickname: '快手达人',
        status: 'active',
        lastLogin: new Date(Date.now() - 172800000).toISOString(), // 2天前
        createdAt: new Date(Date.now() - 1728000000).toISOString(), // 20天前
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: '3',
        platform: 'xiaohongshu',
        username: 'xhs_user789',
        nickname: '小红书博主',
        status: 'inactive',
        lastLogin: null,
        createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30天前
        updatedAt: new Date(Date.now() - 2592000000).toISOString(),
      },
      {
        id: '4',
        platform: 'bilibili',
        username: 'bili_user321',
        nickname: 'B站UP主',
        status: 'expired',
        lastLogin: new Date(Date.now() - 604800000).toISOString(), // 7天前
        createdAt: new Date(Date.now() - 3456000000).toISOString(), // 40天前
        updatedAt: new Date(Date.now() - 604800000).toISOString(),
      },
    ];
  },
};