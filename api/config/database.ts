import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { PostgreSQLService } from '../src/services/postgresqlService.js';

// 创建Supabase客户端
let supabase: any = null;
let usePostgreSQL = false;

// 检查是否配置了 PostgreSQL
if (process.env.POSTGRES_HOST && process.env.POSTGRES_DB) {
  usePostgreSQL = true;
  console.log('✅ Using PostgreSQL database');
} else if (env.supabase.url && env.supabase.serviceKey) {
  supabase = createClient(
    env.supabase.url,
    env.supabase.serviceKey
  );
  console.log('✅ Using Supabase database');
} else {
  console.warn('⚠️ No database configuration found, using mock data');
}

// 数据库操作工具类

export class DatabaseService {
  // 用户相关操作
  static async getUserByEmail(email: string) {
    if (usePostgreSQL) {
      return await PostgreSQLService.getUserByEmail(email);
    }
    
    if (!supabase) {
      // 模拟模式下，只允许test@example.com用户存在，其他邮箱返回null
      if (email === 'test@example.com') {
        return { 
          data: { 
            id: '1', 
            email, 
            name: 'Test User', 
            plan: 'free',
            usage_count: 0,
            max_daily_tasks: 10,
            password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', // password: test123
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, 
          error: null 
        };
      }
      return { data: null, error: null };
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    return { data, error };
  }

  static async getUserById(id: string) {
    if (!supabase) {
      return { 
        data: { 
          id, 
          email: 'test@example.com', 
          name: 'Test User', 
          plan: 'free',
          usage_count: 0,
          max_daily_tasks: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  static async createUser(userData: any) {
    if (usePostgreSQL) {
      return await PostgreSQLService.createUser(userData);
    }
    
    if (!supabase) {
      // 模拟模式下创建新用户
      const newUser = { 
        ...userData, 
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 模拟存储用户（在实际应用中应该存储在内存或文件中）
      console.log('Mock user created:', newUser.email);
      return { 
        data: newUser, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    return { data, error };
  }

  // 账号相关操作
  static async getUserAccounts(userId: string) {
    if (usePostgreSQL) {
      return await PostgreSQLService.getUserAccounts(userId);
    }
    
    if (!supabase) {
      return { 
        data: [
          {
            id: '1',
            user_id: userId,
            platform: 'douyin',
            platform_user_id: 'douyin_123',
            username: '测试抖音号',
            is_active: true,
            account_info: { followers: 1000, following: 100 },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  static async getAccountById(id: string) {
    if (usePostgreSQL) {
      return await PostgreSQLService.getAccountById(id);
    }
    
    if (!supabase) {
      return { 
        data: { 
          id, 
          user_id: '1',
          platform: 'douyin',
          platform_user_id: 'douyin_123',
          username: '测试抖音号',
          is_active: true,
          account_info: { followers: 1000, following: 100 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  static async getAccountByPlatformId(userId: string, platform: string, platformUserId: string) {
    if (!supabase) {
      return { data: null, error: { message: 'Not found' } };
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)
      .single();
    
    return { data, error };
  }

  static async createAccount(accountData: any) {
    if (usePostgreSQL) {
      return await PostgreSQLService.createAccount(accountData);
    }
    
    if (!supabase) {
      return { 
        data: { 
          ...accountData, 
          id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .insert(accountData)
      .select()
      .single();
    
    return { data, error };
  }

  static async updateAccount(id: string, accountData: any) {
    if (usePostgreSQL) {
      return await PostgreSQLService.updateAccount(id, accountData);
    }
    
    if (!supabase) {
      return { 
        data: { ...accountData }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .update(accountData)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }

  static async deleteAccount(id: string) {
    if (usePostgreSQL) {
      return await PostgreSQLService.deleteAccount(id);
    }
    
    if (!supabase) {
      return { error: null };
    }
    
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    
    return { error };
  }

  // 任务相关操作
  static async getUserTasks(userId: string, limit = 50) {
    if (!supabase) {
      return { 
        data: [
          {
            id: '1',
            user_id: userId,
            task_type: 'download',
            status: 'completed',
            source_config: { url: 'https://example.com/video1.mp4' },
            progress: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return { data, error };
  }

  static async getUserTasksToday(userId: string, today: string) {
    if (!supabase) {
      return { data: [], error: null };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', today)
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  static async getTaskById(id: string) {
    if (!supabase) {
      return { 
        data: { 
          id, 
          user_id: '1',
          task_type: 'download',
          status: 'completed',
          source_config: { url: 'https://example.com/video1.mp4' },
          progress: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  static async createTask(taskData: any) {
    if (!supabase) {
      return { 
        data: { 
          ...taskData, 
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();
    
    return { data, error };
  }

  static async updateTaskStatus(taskId: string, status: string, progress?: number, errorMessage?: string) {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };
    
    if (progress !== undefined) updateData.progress = progress;
    if (errorMessage) updateData.error_message = errorMessage;
    if (status === 'completed') updateData.completed_at = new Date().toISOString();
    if (status === 'running' && !progress) updateData.started_at = new Date().toISOString();
    
    if (!supabase) {
      return { 
        data: { 
          id: taskId, 
          status,
          progress: progress || 0,
          error_message: errorMessage,
          started_at: status === 'running' ? new Date().toISOString() : undefined,
          completed_at: status === 'completed' ? new Date().toISOString() : undefined
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();
    
    return { data, error };
  }

  static async deleteTask(id: string) {
    if (!supabase) {
      return { error: null };
    }
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    return { error };
  }

  static async updateUserUsage(userId: string, usageCount: number) {
    if (!supabase) {
      return { error: null };
    }
    
    const { error } = await supabase
      .from('users')
      .update({ usage_count: usageCount, updated_at: new Date().toISOString() })
      .eq('id', userId);
    
    return { error };
  }

  // 视频相关操作
  static async createVideo(videoData: any) {
    if (!supabase) {
      return { 
        data: { 
          ...videoData, 
          id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();
    
    return { data, error };
  }

  static async getVideoByPlatformId(platform: string, platformVideoId: string) {
    if (!supabase) {
      return { data: null, error: { message: 'Not found' } };
    }
    
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('platform', platform)
      .eq('platform_video_id', platformVideoId)
      .single();
    
    return { data, error };
  }

  static async getVideoById(id: string) {
    if (!supabase) {
      return { 
        data: { 
          id, 
          task_id: '1',
          platform: 'douyin',
          platform_video_id: 'video_123',
          title: '测试视频',
          description: '这是一个测试视频',
          thumbnail_url: 'https://via.placeholder.com/320x180',
          video_url: 'https://example.com/video.mp4',
          duration: 60,
          views: 1000,
          likes: 100,
          comments: 10,
          created_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  // 发布记录相关操作
  static async createPublishRecord(recordData: any) {
    if (!supabase) {
      return { 
        data: { 
          ...recordData, 
          id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_records')
      .insert(recordData)
      .select()
      .single();
    
    return { data, error };
  }

  static async getUserPublishRecords(userId: string, limit = 100) {
    if (!supabase) {
      return { 
        data: [
          {
            id: '1',
            task_id: '1',
            account_id: '1',
            platform: 'douyin',
            title: '发布的视频',
            status: 'published',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return { data, error };
  }

  static async getPublishRecordById(id: string) {
    if (!supabase) {
      return { 
        data: { 
          id, 
          task_id: '1',
          account_id: '1',
          platform: 'douyin',
          title: '发布的视频',
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_records')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  static async updatePublishRecord(id: string, recordData: any) {
    if (!supabase) {
      return { 
        data: { ...recordData }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_records')
      .update(recordData)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }

  static async updatePublishRecordStatus(recordId: string, status: string, platformPostId?: string, errorMessage?: string) {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };
    
    if (platformPostId) updateData.platform_post_id = platformPostId;
    if (errorMessage) updateData.error_message = errorMessage;
    if (status === 'published') updateData.published_at = new Date().toISOString();
    
    if (!supabase) {
      return { 
        data: { 
          id: recordId, 
          status,
          platform_post_id: platformPostId,
          error_message: errorMessage,
          published_at: status === 'published' ? new Date().toISOString() : undefined
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_records')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single();
    
    return { data, error };
  }

  // 统计数据
  static async getUserStats(userId: string) {
    if (!supabase) {
      return {
        totalTasks: 10,
        completedTasks: 8,
        totalVideos: 15,
        totalPublishes: 12,
        successfulPublishes: 10,
        successRate: 83
      };
    }
    
    const { data: taskStats } = await supabase
      .from('tasks')
      .select('status', { count: 'exact' })
      .eq('user_id', userId);

    const { data: videoStats } = await supabase
      .from('videos')
      .select('id', { count: 'exact' })
      .eq('task_id', userId);

    const { data: publishStats } = await supabase
      .from('publish_records')
      .select('status', { count: 'exact' })
      .eq('task_id', userId);

    return {
      totalTasks: taskStats?.length || 0,
      completedTasks: taskStats?.filter((t: any) => t.status === 'completed').length || 0,
      totalVideos: videoStats?.length || 0,
      totalPublishes: publishStats?.length || 0,
      successfulPublishes: publishStats?.filter((p: any) => p.status === 'published').length || 0,
      successRate: publishStats?.length > 0 
        ? Math.round((publishStats?.filter((p: any) => p.status === 'published').length / publishStats?.length) * 100)
        : 0
    };
  }

  // 用户设置相关操作
  static async getUserSettings(userId: string) {
    if (!supabase) {
      return { data: null, error: null };
    }
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return { data: data?.settings || null, error };
  }

  static async createUserSettings(userId: string, settings: any) {
    if (!supabase) {
      return { data: settings, error: null };
    }
    
    const { data, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        settings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return { data: data?.settings || null, error };
  }

  static async updateUserSettings(userId: string, settings: any) {
    if (!supabase) {
      return { data: settings, error: null };
    }
    
    const { data, error } = await supabase
      .from('user_settings')
      .update({
        settings,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data: data?.settings || null, error };
  }

  // 发布任务相关操作
  static async getPublishTasks(userId: string) {
    if (!supabase) {
      return { 
        data: [
          {
            id: '1',
            user_id: userId,
            title: '测试发布任务',
            video_url: 'https://example.com/video.mp4',
            platforms: ['douyin', 'kuaishou'],
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  static async getPublishTaskById(id: string) {
    if (!supabase) {
      return { 
        data: { 
          id, 
          user_id: '1',
          title: '测试发布任务',
          video_url: 'https://example.com/video.mp4',
          platforms: ['douyin', 'kuaishou'],
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  }

  static async createPublishTask(taskData: any) {
    if (!supabase) {
      return { 
        data: { 
          ...taskData, 
          id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_tasks')
      .insert(taskData)
      .select()
      .single();
    
    return { data, error };
  }

  static async updatePublishTask(id: string, taskData: any) {
    if (!supabase) {
      return { 
        data: { ...taskData }, 
        error: null 
      };
    }
    
    const { data, error } = await supabase
      .from('publish_tasks')
      .update(taskData)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }

  static async deletePublishTask(id: string) {
    if (!supabase) {
      return { error: null };
    }
    
    const { error } = await supabase
      .from('publish_tasks')
      .delete()
      .eq('id', id);
    
    return { error };
  }
}