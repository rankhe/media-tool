import express from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'media_tool',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Get monitoring platforms
router.get('/platforms', authenticateToken, async (req, res) => {
  try {
    logger.info('Fetching monitoring platforms');
    const result = await pool.query(
      'SELECT * FROM social_monitoring_platforms WHERE is_active = true ORDER BY platform_name'
    );
    
    logger.info(`Found ${result.rows.length} active platforms`);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching monitoring platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring platforms',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update platform configuration
router.put('/platforms/:platformName', authenticateToken, async (req, res) => {
  const { platformName } = req.params;
  const { api_key, api_secret, access_token, refresh_token, is_active } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE social_monitoring_platforms 
       SET api_key = $1, api_secret = $2, access_token = $3, refresh_token = $4, is_active = $5, updated_at = NOW()
       WHERE platform_name = $6
       RETURNING *`,
      [api_key, api_secret, access_token, refresh_token, is_active, platformName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Platform not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating platform configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update platform configuration'
    });
  }
});

// Get monitoring users
router.get('/users', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { platform, status } = req.query;
  
  try {
    logger.info(`Fetching monitoring users for userId: ${userId}, platform: ${platform}, status: ${status}`);
    
    let query = `
      SELECT mu.*, smp.platform_label 
      FROM monitoring_users mu
      JOIN social_monitoring_platforms smp ON mu.platform = smp.platform_name
      WHERE mu.user_id = $1
    `;
    const params = [userId];
    
    if (platform) {
      query += ' AND mu.platform = $' + (params.length + 1);
      params.push(platform);
    }
    
    if (status) {
      query += ' AND mu.monitoring_status = $' + (params.length + 1);
      params.push(status);
    }
    
    query += ' ORDER BY mu.created_at DESC';
    
    const result = await pool.query(query, params);
    
    logger.info(`Found ${result.rows.length} monitoring users`);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching monitoring users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring users',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add monitoring user
router.post('/users', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { 
    platform, 
    target_user_id, 
    target_username, 
    category, 
    check_frequency_minutes = 30 
  } = req.body;
  
  try {
    // First, get the target user info from the platform
    const { PlatformService } = await import('../services/socialMonitoring/platformService');
    const platformService = new PlatformService();
    
    let userInfo;
    try {
      userInfo = await platformService.getUserInfo(platform, target_user_id);
      logger.info(`Successfully validated user ${target_user_id} on platform ${platform}`);
    } catch (platformError) {
      logger.warn(`Platform validation failed for user ${target_user_id} on ${platform}:`, platformError);
      
      // For Weibo platform, we can still add the user even if validation fails
      // This allows the system to work without API credentials
      if (platform === 'weibo') {
        logger.info(`Allowing user addition for Weibo without validation: ${target_user_id}`);
        userInfo = {
          userId: target_user_id,
          username: target_username || `weibo_user_${target_user_id.slice(-6)}`,
          displayName: target_username || `微博用户_${target_user_id.slice(-4)}`,
          avatarUrl: '',
          followerCount: 0,
          verified: false,
          bio: ''
        };
      } else {
        // For other platforms, require successful validation
        logger.error(`Platform validation required for ${platform}, cannot add user ${target_user_id}`);
        return res.status(400).json({
          success: false,
          error: `无法验证用户：${platformError instanceof Error ? platformError.message : '平台验证失败'}。请检查平台配置或用户ID是否正确。`
        });
      }
    }
    
    // Ensure userInfo is not null
    if (!userInfo) {
      logger.warn(`No user info returned for ${target_user_id}, creating basic info`);
      userInfo = {
        userId: target_user_id,
        username: target_username || target_user_id,
        displayName: target_username || target_user_id,
        avatarUrl: '',
        followerCount: 0,
        verified: false,
        bio: ''
      };
    }
    
    const result = await pool.query(
      `INSERT INTO monitoring_users (
        user_id, platform, target_user_id, target_username, target_display_name,
        target_avatar_url, target_follower_count, target_verified, target_bio,
        category, check_frequency_minutes, monitoring_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING *`,
      [
        userId, platform, target_user_id, userInfo.username || target_username,
        userInfo.displayName, userInfo.avatarUrl, userInfo.followerCount,
        userInfo.verified, userInfo.bio, category, check_frequency_minutes
      ]
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error adding monitoring user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add monitoring user'
    });
  }
});

// Update monitoring user
router.put('/users/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { category, check_frequency_minutes, monitoring_status } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE monitoring_users 
       SET category = $1, check_frequency_minutes = $2, monitoring_status = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [category, check_frequency_minutes, monitoring_status, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Monitoring user not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating monitoring user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update monitoring user'
    });
  }
});

// Delete monitoring user
router.delete('/users/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM monitoring_users WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Monitoring user not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Monitoring user deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting monitoring user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete monitoring user'
    });
  }
});

// Get monitored posts
router.get('/posts', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { platform, is_new, limit = 50, offset = 0, monitoring_user_id, start_date, end_date, q } = req.query;
  
  try {
    let query = `
      SELECT mp.*, mu.target_username, mu.target_display_name, smp.platform_label
      FROM monitored_posts mp
      JOIN monitoring_users mu ON mp.monitoring_user_id = mu.id
      JOIN social_monitoring_platforms smp ON mp.platform = smp.platform_name
      WHERE mu.user_id = $1
    `;
    const params: any[] = [userId];
    
    if (platform) {
      query += ' AND mp.platform = $' + (params.length + 1);
      params.push(platform);
    }

    if (monitoring_user_id) {
      query += ' AND mp.monitoring_user_id = $' + (params.length + 1);
      params.push(parseInt(monitoring_user_id as string));
    }
    
    if (is_new !== undefined) {
      query += ' AND mp.is_new = $' + (params.length + 1);
      params.push(is_new === 'true');
    }

    if (start_date) {
      query += ' AND mp.published_at >= $' + (params.length + 1);
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND mp.published_at <= $' + (params.length + 1);
      params.push(end_date);
    }

    if (q) {
      query += ' AND mp.post_content ILIKE $' + (params.length + 1);
      params.push('%' + q + '%');
    }
    
    query += ' ORDER BY mp.published_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching monitored posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitored posts'
    });
  }
});

// Get webhook configurations
router.get('/webhooks', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const result = await pool.query(
      'SELECT * FROM webhook_configs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching webhook configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhook configurations'
    });
  }
});

// Create webhook configuration
router.post('/webhooks', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    webhook_name,
    webhook_type,
    webhook_url,
    webhook_secret,
    webhook_headers,
    message_template
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO webhook_configs (
        user_id, webhook_name, webhook_type, webhook_url, webhook_secret,
        webhook_headers, message_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [userId, webhook_name, webhook_type, webhook_url, webhook_secret, webhook_headers, message_template]
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating webhook configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create webhook configuration'
    });
  }
});

// Test webhook
router.post('/webhooks/:id/test', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  
  try {
    const webhookResult = await pool.query(
      'SELECT * FROM webhook_configs WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Webhook configuration not found'
      });
    }
    
    const webhookService = require('../services/socialMonitoring/webhookService');
    const testResult = await webhookService.testWebhook(webhookResult.rows[0]);
    
    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    logger.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test webhook'
    });
  }
});


// Get monitoring statistics
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { platform, start_date, end_date } = req.query;
  
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
    const params = [userId];
    
    if (platform) {
      query += ' AND ms.platform = $' + (params.length + 1);
      params.push(platform);
    }
    
    if (start_date) {
      query += ' AND ms.date >= $' + (params.length + 1);
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND ms.date <= $' + (params.length + 1);
      params.push(end_date);
    }
    
    query += ' GROUP BY ms.id, smp.platform_label ORDER BY ms.date DESC';
    
    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching monitoring statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring statistics'
    });
  }
});

// Fetch user posts by days
router.post('/users/:id/fetch-posts', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { days_back = 7 } = req.body; // Default to 7 days
  
  try {
    logger.info(`Manual post fetch requested for user ${id}, days: ${days_back}`);
    
    // Import monitoring service
    const { monitoringService } = await import('../services/socialMonitoring/monitoringService');
    
    const result = await monitoringService.fetchUserPostsByDays(
      parseInt(userId as string),
      parseInt(id),
      days_back
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error fetching posts by days for user ${id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user posts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Lookup user info from platform API
router.get('/users/lookup/:platform/:userId', authenticateToken, async (req, res) => {
  const { platform, userId } = req.params;
  
  try {
    logger.info(`Looking up user info for platform: ${platform}, userId: ${userId}`);
    
    // Import platform service
    const { PlatformService } = await import('../services/socialMonitoring/platformService');
    const platformService = new PlatformService();
    
    const userInfo = await platformService.getUserInfo(platform, userId);
    
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        error: 'User not found or platform API error'
      });
    }
    
    res.json({
      success: true,
      data: userInfo
    });
  } catch (error) {
    logger.error(`Error looking up user ${userId} on ${platform}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to lookup user'
    });
  }
});

export default router;