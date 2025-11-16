import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { platformService, PlatformPost } from './platformService';
import { webhookService } from './webhookService';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'media_tool',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export class MonitoringService {
  
  async checkAllUsers(): Promise<void> {
    try {
      logger.info('Starting social media monitoring check for all users');
      
      // Get all active monitoring users
      const result = await pool.query(`
        SELECT mu.*, smp.platform_label, smp.api_key, smp.access_token
        FROM monitoring_users mu
        JOIN social_monitoring_platforms smp ON mu.platform = smp.platform_name
        WHERE mu.monitoring_status = 'active' 
          AND mu.is_active = true 
          AND smp.is_active = true
          AND (mu.last_check_at IS NULL OR mu.last_check_at <= NOW() - INTERVAL '1 minute' * mu.check_frequency_minutes)
      `);
      
      const monitoringUsers = result.rows;
      logger.info(`Found ${monitoringUsers.length} users to check`);
      
      // Process each user
      for (const user of monitoringUsers) {
        try {
          await this.checkUser(user);
        } catch (error) {
          logger.error(`Error checking user ${user.id}:`, error);
          await this.updateUserError(user.id, error.message);
        }
      }
      
      logger.info('Social media monitoring check completed');
    } catch (error) {
      logger.error('Error during social media monitoring check:', error);
    }
  }
  
  private async checkUser(user: any): Promise<void> {
    logger.info(`Checking user: ${user.target_display_name} (${user.target_user_id}) on ${user.platform}`);
    
    try {
      // Get latest posts from platform
      const posts = await platformService.getUserPosts(user.platform, user.target_user_id, user.last_post_id);
      
      if (posts.length === 0) {
        logger.info(`No new posts found for user: ${user.target_display_name}`);
        await this.updateUserLastCheck(user.id, user.last_post_id);
        return;
      }
      
      logger.info(`Found ${posts.length} new posts for user: ${user.target_display_name}`);
      
      // Process each new post
      for (const post of posts) {
        await this.processNewPost(user, post);
      }
      
      // Update user's last check and post info
      const latestPost = posts[0]; // Most recent post
      await this.updateUserLastCheck(user.id, latestPost.postId, latestPost.content);
      
    } catch (error) {
      logger.error(`Error checking posts for user ${user.target_display_name}:`, error);
      throw error;
    }
  }
  
  private async processNewPost(user: any, post: PlatformPost): Promise<void> {
    try {
      // Check if post already exists
      const existingPost = await pool.query(
        'SELECT id FROM monitored_posts WHERE platform = $1 AND post_id = $2',
        [user.platform, post.postId]
      );
      
      if (existingPost.rows.length > 0) {
        logger.info(`Post already exists: ${post.postId}`);
        return;
      }
      
      // Insert new post
      const insertResult = await pool.query(`
        INSERT INTO monitored_posts (
          monitoring_user_id, platform, post_id, post_url, post_type,
          post_content, post_images, post_videos, post_metadata,
          published_at, is_new, notification_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false)
        RETURNING id
      `, [
        user.id,
        user.platform,
        post.postId,
        post.postUrl,
        post.postType,
        post.content,
        JSON.stringify(post.images),
        JSON.stringify(post.videos),
        JSON.stringify(post.metadata),
        post.publishedAt
      ]);
      
      const postId = insertResult.rows[0].id;
      logger.info(`New post inserted: ${post.postId} for user ${user.target_display_name}`);
      
      // Send notifications
      await this.sendPostNotifications(user, post, postId);
      
      // Update statistics
      await this.updateStatistics(user.user_id, user.platform, 'new_posts_found');
      
    } catch (error) {
      logger.error(`Error processing new post for user ${user.target_display_name}:`, error);
      throw error;
    }
  }
  
  private async sendPostNotifications(user: any, post: PlatformPost, postDbId: number): Promise<void> {
    try {
      // Get active webhook configurations for this user
      const webhookConfigs = await pool.query(
        'SELECT * FROM webhook_configs WHERE user_id = $1 AND is_active = true',
        [user.user_id]
      );
      
      if (webhookConfigs.rows.length === 0) {
        logger.info(`No active webhook configurations found for user ${user.user_id}`);
        return;
      }
      
      const postData = {
        platform: user.platform,
        platform_label: user.platform_label,
        target_username: user.target_username,
        target_display_name: user.target_display_name,
        post_id: post.postId,
        post_url: post.postUrl,
        post_type: post.postType,
        post_content: post.content,
        post_images: post.images,
        post_videos: post.videos,
        published_at: post.publishedAt,
        metadata: post.metadata
      };
      
      // Send notifications to all configured webhooks
      for (const webhookConfig of webhookConfigs.rows) {
        try {
          await webhookService.sendNotification(webhookConfig, postData);
          
          // Update notification status
          await pool.query(
            'UPDATE monitored_posts SET notification_sent = true, notification_sent_at = NOW() WHERE id = $1',
            [postDbId]
          );
          
          // Update webhook statistics
          await pool.query(
            'UPDATE webhook_configs SET success_count = success_count + 1, last_sent_at = NOW() WHERE id = $1',
            [webhookConfig.id]
          );
          
          // Update statistics
          await this.updateStatistics(user.user_id, user.platform, 'notifications_sent');
          
          logger.info(`Notification sent successfully via ${webhookConfig.webhook_type}`);
          
        } catch (error) {
          logger.error(`Failed to send notification via ${webhookConfig.webhook_type}:`, error);
          
          // Update webhook error statistics
          await pool.query(
            'UPDATE webhook_configs SET failure_count = failure_count + 1, last_error_message = $1 WHERE id = $2',
            [error.message, webhookConfig.id]
          );
          
          // Update notification error
          await pool.query(
            'UPDATE monitored_posts SET notification_error = $1 WHERE id = $2',
            [error.message, postDbId]
          );
        }
      }
      
    } catch (error) {
      logger.error(`Error sending post notifications:`, error);
      throw error;
    }
  }
  
  private async updateUserLastCheck(userId: number, lastPostId?: string, lastPostContent?: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE monitoring_users SET last_check_at = NOW(), last_post_id = $1, last_post_content = $2, error_count = 0, error_message = NULL WHERE id = $3',
        [lastPostId, lastPostContent, userId]
      );
    } catch (error) {
      logger.error(`Error updating user last check:`, error);
    }
  }
  
  private async updateUserError(userId: number, errorMessage: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE monitoring_users SET error_count = error_count + 1, error_message = $1 WHERE id = $2',
        [errorMessage, userId]
      );
      
      // If too many consecutive errors, pause monitoring
      const result = await pool.query(
        'SELECT error_count FROM monitoring_users WHERE id = $1',
        [userId]
      );
      
      if (result.rows[0].error_count >= 5) {
        await pool.query(
          'UPDATE monitoring_users SET monitoring_status = $1 WHERE id = $2',
          ['paused', userId]
        );
        logger.warn(`Monitoring paused for user ${userId} due to excessive errors`);
      }
      
      // Update statistics
      const userResult = await pool.query('SELECT user_id, platform FROM monitoring_users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        await this.updateStatistics(userResult.rows[0].user_id, userResult.rows[0].platform, 'errors_count');
      }
      
    } catch (error) {
      logger.error(`Error updating user error:`, error);
    }
  }
  
  private async updateStatistics(userId: number, platform: string, statType: 'total_checks' | 'new_posts_found' | 'notifications_sent' | 'errors_count'): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await pool.query(`
        INSERT INTO monitoring_stats (user_id, platform, date, ${statType})
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (user_id, platform, date)
        DO UPDATE SET ${statType} = monitoring_stats.${statType} + 1, updated_at = NOW()
      `, [userId, platform, today]);
      
    } catch (error) {
      logger.error(`Error updating statistics:`, error);
    }
  }
  
  async fetchUserPostsByDays(userId: number, monitoringUserId: number, daysBack: number): Promise<any> {
    try {
      logger.info(`Fetching posts for user ${monitoringUserId} from last ${daysBack} days`);
      
      // Get monitoring user details
      const userResult = await pool.query(
        'SELECT mu.*, smp.platform_label FROM monitoring_users mu JOIN social_monitoring_platforms smp ON mu.platform = smp.platform_name WHERE mu.id = $1 AND mu.user_id = $2',
        [monitoringUserId, userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('Monitoring user not found');
      }
      
      const monitoringUser = userResult.rows[0];
      
      // Fetch posts from platform
      const posts = await platformService.getUserPosts(
        monitoringUser.platform,
        monitoringUser.target_user_id,
        undefined, // sincePostId
        daysBack
      );
      
      logger.info(`Fetched ${posts.length} posts for user ${monitoringUser.target_username}`);
      
      // Process and store posts
      let newPostsCount = 0;
      for (const post of posts) {
        try {
          // Check if post already exists
          const existingPost = await pool.query(
            'SELECT id FROM monitored_posts WHERE platform = $1 AND post_id = $2',
            [monitoringUser.platform, post.postId]
          );
          
          if (existingPost.rows.length === 0) {
            // Insert new post
            await pool.query(`
              INSERT INTO monitored_posts (
                monitoring_user_id, platform, post_id, post_url, post_type,
                post_content, post_images, post_videos, post_metadata,
                published_at, is_new, notification_sent
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false)
            `, [
              monitoringUser.id,
              monitoringUser.platform,
              post.postId,
              post.postUrl,
              post.postType,
              post.content,
              JSON.stringify(post.images),
              JSON.stringify(post.videos),
              JSON.stringify(post.metadata),
              post.publishedAt
            ]);
            
            newPostsCount++;
            logger.info(`New post inserted: ${post.postId} for user ${monitoringUser.target_username}`);
          }
        } catch (error) {
          logger.error(`Error processing post ${post.postId}:`, error);
        }
      }
      
      // Update user's last check time
      await pool.query(
        'UPDATE monitoring_users SET last_check_at = NOW() WHERE id = $1',
        [monitoringUserId]
      );
      
      // Update statistics
      if (newPostsCount > 0) {
        await this.updateStatistics(userId, monitoringUser.platform, 'new_posts_found');
      }
      
      logger.info(`Successfully processed ${newPostsCount} new posts for user ${monitoringUser.target_username}`);
      
      return {
        success: true,
        data: {
          userId: monitoringUserId,
          username: monitoringUser.target_username,
          platform: monitoringUser.platform,
          totalPosts: posts.length,
          newPosts: newPostsCount,
          posts: posts
        }
      };
      
    } catch (error) {
      logger.error(`Error fetching posts by days for user ${monitoringUserId}:`, error);
      throw error;
    }
  }

  async getMonitoringStats(userId: number, platform?: string, startDate?: string, endDate?: string): Promise<any> {
    try {
      let query = `
        SELECT 
          ms.*,
          smp.platform_label,
          COUNT(mu.id) as monitored_users_count,
          SUM(mu.post_count) as total_posts_detected
        FROM monitoring_stats ms
        JOIN social_monitoring_platforms smp ON ms.platform = smp.platform_name
        LEFT JOIN monitoring_users mu ON ms.user_id = mu.user_id AND ms.platform = mu.platform
        WHERE ms.user_id = $1
      `;
      const params: any[] = [userId];
      
      if (platform) {
        query += ' AND ms.platform = $' + (params.length + 1);
        params.push(platform);
      }
      
      if (startDate) {
        query += ' AND ms.date >= $' + (params.length + 1);
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND ms.date <= $' + (params.length + 1);
        params.push(endDate);
      }
      
      query += ' GROUP BY ms.id, smp.platform_label ORDER BY ms.date DESC';
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching monitoring stats:`, error);
      throw error;
    }
  }
}

export const monitoringService = new MonitoringService();