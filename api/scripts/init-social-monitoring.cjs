const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'media_tool',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '123456',
});

async function initSocialMonitoring() {
  console.log('🔄 Initializing social monitoring tables...');
  
  try {
    const client = await pool.connect();
    
    // 创建监控平台配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_monitoring_platforms (
        id SERIAL PRIMARY KEY,
        platform_name VARCHAR(50) NOT NULL UNIQUE,
        platform_label VARCHAR(100),
        api_base_url VARCHAR(500),
        api_key VARCHAR(500),
        access_token VARCHAR(500),
        api_secret VARCHAR(500),
        additional_config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Social monitoring platforms table created');
    
    // 创建监控用户列表
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitoring_users (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        platform VARCHAR(50) NOT NULL,
        target_user_id VARCHAR(200) NOT NULL,
        target_username VARCHAR(200),
        monitoring_status VARCHAR(50) DEFAULT 'active',
        check_frequency_minutes INTEGER DEFAULT 30,
        last_check_at TIMESTAMP WITH TIME ZONE,
        last_post_id VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform, target_user_id)
      )
    `);
    console.log('✅ Monitoring users table created');
    
    // 创建监控到的帖子表
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitored_posts (
        id SERIAL PRIMARY KEY,
        monitoring_user_id INTEGER REFERENCES monitoring_users(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        post_id VARCHAR(500) NOT NULL,
        user_id VARCHAR(200) NOT NULL,
        username VARCHAR(200),
        post_content TEXT,
        post_type VARCHAR(50),
        media_urls JSONB DEFAULT '[]',
        post_url VARCHAR(1000),
        published_at TIMESTAMP WITH TIME ZONE,
        raw_data JSONB DEFAULT '{}',
        is_notified BOOLEAN DEFAULT false,
        notification_sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, post_id)
      )
    `);
    console.log('✅ Monitored posts table created');
    
    // 创建Webhook配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        webhook_type VARCHAR(50) NOT NULL, -- feishu, wechat_work
        webhook_name VARCHAR(200) NOT NULL,
        webhook_url TEXT NOT NULL,
        webhook_secret VARCHAR(500),
        message_template TEXT,
        is_active BOOLEAN DEFAULT true,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_success_at TIMESTAMP WITH TIME ZONE,
        last_failure_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Webhook configs table created');
    
    // 创建监控规则表
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitoring_rules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        rule_name VARCHAR(200) NOT NULL,
        platform VARCHAR(50),
        keywords JSONB DEFAULT '[]',
        exclude_keywords JSONB DEFAULT '[]',
        min_content_length INTEGER DEFAULT 0,
        max_content_length INTEGER,
        content_types JSONB DEFAULT '["text", "image", "video"]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Monitoring rules table created');
    
    // 创建监控统计表
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitoring_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        platform VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        total_checks INTEGER DEFAULT 0,
        new_posts_found INTEGER DEFAULT 0,
        notifications_sent INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform, date)
      )
    `);
    console.log('✅ Monitoring stats table created');
    
    // 插入默认平台配置
    const platformResult = await client.query(`
      INSERT INTO social_monitoring_platforms (platform_name, platform_label, api_base_url, is_active)
      VALUES 
        ('weibo', '微博', 'https://api.weibo.com/2/', false),
        ('x_twitter', 'X (Twitter)', 'https://api.twitter.com/2/', false)
      ON CONFLICT (platform_name) DO NOTHING
      RETURNING *
    `);
    
    if (platformResult.rows.length > 0) {
      console.log('✅ Default platforms inserted:', platformResult.rows.map(r => r.platform_name));
    }
    
    // 创建索引优化查询性能
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_users_user_platform ON monitoring_users(user_id, platform);
      CREATE INDEX IF NOT EXISTS idx_monitoring_users_status ON monitoring_users(monitoring_status);
      CREATE INDEX IF NOT EXISTS idx_monitoring_users_last_check ON monitoring_users(last_check_at);
      CREATE INDEX IF NOT EXISTS idx_monitored_posts_platform_post ON monitored_posts(platform, post_id);
      CREATE INDEX IF NOT EXISTS idx_monitored_posts_user_notified ON monitored_posts(monitoring_user_id, notification_sent_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_active ON webhook_configs(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_monitoring_rules_user_active ON monitoring_rules(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_monitoring_stats_user_platform_date ON monitoring_stats(user_id, platform, date);
    `);
    console.log('✅ Database indexes created');
    
    client.release();
    
    console.log('\n✅ Social monitoring tables initialized successfully!');
    console.log('🎉 You can now start monitoring social media users!');
    
  } catch (error) {
    console.error('❌ Social monitoring initialization failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

initSocialMonitoring();