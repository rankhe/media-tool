import pool from '../../config/postgres.js';

// PostgreSQL 数据库服务
export class PostgreSQLService {
  // 用户相关操作
  static async getUserByEmail(email: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting user by email:', error);
      return { data: null, error };
    }
  }

  static async getUserById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting user by id:', error);
      return { data: null, error };
    }
  }

  static async createUser(userData: any) {
    try {
      const { name, email, password_hash, plan = 'free', usage_count = 0, max_daily_tasks = 10 } = userData;
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, plan, usage_count, max_daily_tasks) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [name, email, password_hash, plan, usage_count, max_daily_tasks]
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating user:', error);
      return { data: null, error };
    }
  }

  // 账号相关操作
  static async getUserAccounts(userId: string) {
    try {
      console.log('PostgreSQL getUserAccounts for userId:', userId);
      const result = await pool.query(
        'SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      console.log('PostgreSQL getUserAccounts result:', result.rows);
      
      // 将数据库字段映射到前端需要的字段结构
      const mappedAccounts = result.rows.map(account => ({
        id: account.id.toString(),
        platform: account.platform,
        username: account.username,
        nickname: account.nickname || account.username, // 使用nickname字段，如果没有则用username
        platform_user_id: account.platform_user_id,
        status: account.status || (account.is_active ? 'active' : 'inactive'), // 优先使用status字段
        is_active: account.is_active,
        lastLogin: account.last_login || account.updated_at, // 使用专门的last_login字段
        cookies: account.cookies || '', // 使用专门的cookies字段
        settings: account.account_info || {}, // 将account_info映射到settings
        account_info: account.account_info,
        created_at: account.created_at,
        updated_at: account.updated_at
      }));
      
      return { data: mappedAccounts, error: null };
    } catch (error) {
      console.error('Error getting user accounts:', error);
      return { data: [], error };
    }
  }

  static async getAccountById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM accounts WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting account by id:', error);
      return { data: null, error };
    }
  }

  static async getAccountByPlatformId(userId: string, platform: string, platformUserId: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM accounts WHERE user_id = $1 AND platform = $2 AND platform_user_id = $3',
        [userId, platform, platformUserId]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting account by platform id:', error);
      return { data: null, error };
    }
  }

  static async createAccount(accountData: any) {
    try {
      const { 
        user_id, 
        platform, 
        platform_user_id, 
        username, 
        nickname,
        cookies,
        status = 'active',
        is_active = true, 
        account_info = {} 
      } = accountData;
      
      console.log('PostgreSQL createAccount input:', { 
        user_id, 
        platform, 
        platform_user_id, 
        username, 
        nickname,
        cookies,
        status,
        is_active, 
        account_info 
      });
      
      const result = await pool.query(
        `INSERT INTO accounts (user_id, platform, platform_user_id, username, nickname, cookies, status, is_active, account_info) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          user_id, 
          platform, 
          platform_user_id, 
          username, 
          nickname || username, // 如果没有nickname就用username
          cookies || '', // cookies默认为空字符串
          status || 'active', // 默认状态为active
          is_active, 
          JSON.stringify(account_info)
        ]
      );
      
      console.log('PostgreSQL createAccount result:', result.rows[0]);
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating account:', error);
      return { data: null, error };
    }
  }

  static async updateAccount(id: string, accountData: any) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      // Map frontend fields to database fields - 适配新的表结构
      const fieldMapping: Record<string, string> = {
        'platform': 'platform',
        'username': 'username', 
        'platform_user_id': 'platform_user_id',
        'nickname': 'nickname', // nickname映射到nickname字段
        'cookies': 'cookies', // cookies映射到cookies字段
        'status': 'status', // status映射到status字段
        'settings': 'account_info', // settings映射到account_info字段
        'is_active': 'is_active',
        'account_info': 'account_info',
        'lastLogin': 'last_login' // lastLogin映射到last_login字段
      };

      Object.keys(accountData).forEach(key => {
        const dbField = fieldMapping[key];
        if (dbField) {
          if (key === 'status') {
            fields.push(`${dbField} = $${paramCount}`);
            values.push(accountData[key] === 'active');
          } else if (key === 'settings' || key === 'account_info') {
            fields.push(`${dbField} = $${paramCount}`);
            values.push(JSON.stringify(accountData[key]));
          } else {
            fields.push(`${dbField} = $${paramCount}`);
            values.push(accountData[key]);
          }
          paramCount++;
        }
      });

      if (fields.length === 0) {
        // If no valid fields to update, just return the current account
        const currentAccount = await this.getAccountById(id);
        return currentAccount;
      }

      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      values.push(id);

      const result = await pool.query(
        `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error updating account:', error);
      return { data: null, error };
    }
  }

  static async deleteAccount(id: string) {
    try {
      await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
      return { error: null };
    } catch (error) {
      console.error('Error deleting account:', error);
      return { error };
    }
  }

  // 任务相关操作
  static async getUserTasks(userId: string, limit = 50) {
    try {
      const result = await pool.query(
        'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      return { data: result.rows, error: null };
    } catch (error) {
      console.error('Error getting user tasks:', error);
      return { data: [], error };
    }
  }

  static async getUserTasksToday(userId: string, today: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM tasks WHERE user_id = $1 AND created_at >= $2 ORDER BY created_at DESC',
        [userId, today]
      );
      return { data: result.rows, error: null };
    } catch (error) {
      console.error('Error getting user tasks today:', error);
      return { data: [], error };
    }
  }

  static async getTaskById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM tasks WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting task by id:', error);
      return { data: null, error };
    }
  }

  static async createTask(taskData: any) {
    try {
      const { user_id, task_type, source_config = {}, status = 'pending', progress = 0 } = taskData;
      const result = await pool.query(
        `INSERT INTO tasks (user_id, task_type, source_config, status, progress) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [user_id, task_type, JSON.stringify(source_config), status, progress]
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating task:', error);
      return { data: null, error };
    }
  }

  static async updateTaskStatus(taskId: string, status: string, progress?: number, errorMessage?: string) {
    try {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (progress !== undefined) updateData.progress = progress;
      if (errorMessage) updateData.error_message = errorMessage;
      if (status === 'completed') updateData.completed_at = new Date().toISOString();
      if (status === 'running' && !progress) updateData.started_at = new Date().toISOString();

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      });

      values.push(taskId);

      const result = await pool.query(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error updating task status:', error);
      return { data: null, error };
    }
  }

  static async deleteTask(id: string) {
    try {
      await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return { error: null };
    } catch (error) {
      console.error('Error deleting task:', error);
      return { error };
    }
  }

  static async updateUserUsage(userId: string, usageCount: number) {
    try {
      await pool.query(
        'UPDATE users SET usage_count = $1, updated_at = $2 WHERE id = $3',
        [usageCount, new Date().toISOString(), userId]
      );
      return { error: null };
    } catch (error) {
      console.error('Error updating user usage:', error);
      return { error };
    }
  }

  // 视频相关操作
  static async createVideo(videoData: any) {
    try {
      const { task_id, platform, platform_video_id, title, description, thumbnail_url, video_url, duration, views = 0, likes = 0, comments = 0 } = videoData;
      const result = await pool.query(
        `INSERT INTO videos (task_id, platform, platform_video_id, title, description, thumbnail_url, video_url, duration, views, likes, comments) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [task_id, platform, platform_video_id, title, description, thumbnail_url, video_url, duration, views, likes, comments]
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating video:', error);
      return { data: null, error };
    }
  }

  static async getVideoByPlatformId(platform: string, platformVideoId: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM videos WHERE platform = $1 AND platform_video_id = $2',
        [platform, platformVideoId]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting video by platform id:', error);
      return { data: null, error };
    }
  }

  static async getVideoById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM videos WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting video by id:', error);
      return { data: null, error };
    }
  }

  // 发布记录相关操作
  static async createPublishRecord(recordData: any) {
    try {
      const { task_id, account_id, platform, title, description, video_url, status = 'pending' } = recordData;
      const result = await pool.query(
        `INSERT INTO publish_records (task_id, account_id, platform, title, description, video_url, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [task_id, account_id, platform, title, description, video_url, status]
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating publish record:', error);
      return { data: null, error };
    }
  }

  static async getUserPublishRecords(userId: string, limit = 100) {
    try {
      const result = await pool.query(
        `SELECT pr.*, a.username as account_username 
         FROM publish_records pr 
         JOIN accounts a ON pr.account_id = a.id 
         WHERE pr.user_id = $1 
         ORDER BY pr.created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      return { data: result.rows, error: null };
    } catch (error) {
      console.error('Error getting user publish records:', error);
      return { data: [], error };
    }
  }

  static async getPublishRecordById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM publish_records WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting publish record by id:', error);
      return { data: null, error };
    }
  }

  static async updatePublishRecord(id: string, recordData: any) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(recordData).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(recordData[key]);
        paramCount++;
      });

      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      values.push(id);

      const result = await pool.query(
        `UPDATE publish_records SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error updating publish record:', error);
      return { data: null, error };
    }
  }

  static async updatePublishRecordStatus(recordId: string, status: string, platformPostId?: string, errorMessage?: string) {
    try {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (platformPostId) updateData.platform_post_id = platformPostId;
      if (errorMessage) updateData.error_message = errorMessage;
      if (status === 'published') updateData.published_at = new Date().toISOString();

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      });

      values.push(recordId);

      const result = await pool.query(
        `UPDATE publish_records SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error updating publish record status:', error);
      return { data: null, error };
    }
  }

  // 发布任务相关操作
  static async getPublishTasks(userId: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM publish_tasks WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return { data: result.rows, error: null };
    } catch (error) {
      console.error('Error getting publish tasks:', error);
      return { data: [], error };
    }
  }

  static async getPublishTaskById(id: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM publish_tasks WHERE id = $1',
        [id]
      );
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      console.error('Error getting publish task by id:', error);
      return { data: null, error };
    }
  }

  static async createPublishTask(taskData: any) {
    try {
      const { user_id, title, video_url, platforms = [], status = 'pending' } = taskData;
      const result = await pool.query(
        `INSERT INTO publish_tasks (user_id, title, video_url, platforms, status) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [user_id, title, video_url, JSON.stringify(platforms), status]
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error creating publish task:', error);
      return { data: null, error };
    }
  }

  static async updatePublishTask(id: string, taskData: any) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(taskData).forEach(key => {
        if (key === 'platforms') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(taskData[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(taskData[key]);
        }
        paramCount++;
      });

      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      values.push(id);

      const result = await pool.query(
        `UPDATE publish_tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      return { data: result.rows[0], error: null };
    } catch (error) {
      console.error('Error updating publish task:', error);
      return { data: null, error };
    }
  }

  static async deletePublishTask(id: string) {
    try {
      await pool.query('DELETE FROM publish_tasks WHERE id = $1', [id]);
      return { error: null };
    } catch (error) {
      console.error('Error deleting publish task:', error);
      return { error };
    }
  }

  // 用户设置相关操作
  static async getUserSettings(userId: string) {
    try {
      const result = await pool.query(
        'SELECT settings FROM user_settings WHERE user_id = $1',
        [userId]
      );
      return { data: result.rows[0]?.settings || null, error: null };
    } catch (error) {
      console.error('Error getting user settings:', error);
      return { data: null, error };
    }
  }

  static async createUserSettings(userId: string, settings: any) {
    try {
      const result = await pool.query(
        'INSERT INTO user_settings (user_id, settings) VALUES ($1, $2) RETURNING settings',
        [userId, JSON.stringify(settings)]
      );
      return { data: result.rows[0]?.settings || null, error: null };
    } catch (error) {
      console.error('Error creating user settings:', error);
      return { data: null, error };
    }
  }

  static async updateUserSettings(userId: string, settings: any) {
    try {
      const result = await pool.query(
        'UPDATE user_settings SET settings = $1, updated_at = $2 WHERE user_id = $3 RETURNING settings',
        [JSON.stringify(settings), new Date().toISOString(), userId]
      );
      return { data: result.rows[0]?.settings || null, error: null };
    } catch (error) {
      console.error('Error updating user settings:', error);
      return { data: null, error };
    }
  }

  // 统计数据
  static async getUserStats(userId: string) {
    try {
      // 获取任务统计
      const taskStatsResult = await pool.query(
        'SELECT status, COUNT(*) as count FROM tasks WHERE user_id = $1 GROUP BY status',
        [userId]
      );
      
      // 获取视频统计
      const videoStatsResult = await pool.query(
        'SELECT COUNT(*) as count FROM videos WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1)',
        [userId]
      );
      
      // 获取发布统计
      const publishStatsResult = await pool.query(
        'SELECT status, COUNT(*) as count FROM publish_records WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1) GROUP BY status',
        [userId]
      );

      const taskStats = taskStatsResult.rows;
      const totalTasks = taskStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);
      const completedTasks = taskStats.find(stat => stat.status === 'completed')?.count || 0;
      
      const totalVideos = parseInt(videoStatsResult.rows[0]?.count || 0);
      
      const publishStats = publishStatsResult.rows;
      const totalPublishes = publishStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);
      const successfulPublishes = publishStats.find(stat => stat.status === 'published')?.count || 0;
      const successRate = totalPublishes > 0 ? Math.round((successfulPublishes / totalPublishes) * 100) : 0;

      return {
        totalTasks,
        completedTasks: parseInt(completedTasks),
        totalVideos,
        totalPublishes,
        successfulPublishes: parseInt(successfulPublishes),
        successRate
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalTasks: 0,
        completedTasks: 0,
        totalVideos: 0,
        totalPublishes: 0,
        successfulPublishes: 0,
        successRate: 0
      };
    }
  }
}