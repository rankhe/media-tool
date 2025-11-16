-- Social Media Monitoring Module Database Schema (UTF-8 Compatible)

-- Monitoring Platforms Configuration
CREATE TABLE IF NOT EXISTS social_monitoring_platforms (
    id SERIAL PRIMARY KEY,
    platform_name VARCHAR(50) NOT NULL UNIQUE, -- weibo, x_twitter
    platform_label VARCHAR(100) NOT NULL,
    api_base_url VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    access_token VARCHAR(500),
    refresh_token VARCHAR(500),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    rate_limit_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring Users List
CREATE TABLE IF NOT EXISTS monitoring_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    platform VARCHAR(50) NOT NULL REFERENCES social_monitoring_platforms(platform_name),
    target_user_id VARCHAR(200) NOT NULL, -- Target user ID on platform
    target_username VARCHAR(200), -- Target username
    target_display_name VARCHAR(200), -- Target display name
    target_avatar_url TEXT,
    target_follower_count INTEGER DEFAULT 0,
    target_verified BOOLEAN DEFAULT false,
    target_bio TEXT,
    category VARCHAR(100), -- Monitoring category: entertainment, tech, news etc
    monitoring_status VARCHAR(50) DEFAULT 'active', -- active, paused, stopped
    check_frequency_minutes INTEGER DEFAULT 30, -- Check frequency (minutes)
    last_check_at TIMESTAMP WITH TIME ZONE,
    last_post_id VARCHAR(500), -- Last post ID
    last_post_content TEXT, -- Last post content
    post_count INTEGER DEFAULT 0, -- Total detected posts
    error_count INTEGER DEFAULT 0, -- Consecutive error count
    error_message TEXT, -- Last error message
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_platform_user UNIQUE(user_id, platform, target_user_id)
);

-- Monitored Posts/Content
CREATE TABLE IF NOT EXISTS monitored_posts (
    id SERIAL PRIMARY KEY,
    monitoring_user_id INTEGER NOT NULL REFERENCES monitoring_users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    post_id VARCHAR(500) NOT NULL, -- Post ID on platform
    post_url TEXT, -- Post link
    post_type VARCHAR(50), -- text, image, video, mixed
    post_content TEXT, -- Post content
    post_images JSONB DEFAULT '[]', -- Image URLs
    post_videos JSONB DEFAULT '[]', -- Video URLs
    post_metadata JSONB DEFAULT '{}', -- Other metadata: likes, shares etc
    published_at TIMESTAMP WITH TIME ZONE, -- Publication time
    is_new BOOLEAN DEFAULT true, -- Whether newly detected post
    notification_sent BOOLEAN DEFAULT false, -- Whether notification sent
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_platform_post UNIQUE(platform, post_id)
);

-- Webhook Configuration
CREATE TABLE IF NOT EXISTS webhook_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    webhook_name VARCHAR(200) NOT NULL,
    webhook_type VARCHAR(50) NOT NULL, -- feishu, wechat_work, dingtalk, custom
    webhook_url TEXT NOT NULL,
    webhook_secret VARCHAR(500), -- For signature verification
    webhook_headers JSONB DEFAULT '{}', -- Custom headers
    message_template TEXT, -- Custom message template
    is_active BOOLEAN DEFAULT true,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    last_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring Rules Configuration
CREATE TABLE IF NOT EXISTS monitoring_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(100) NOT NULL, -- keyword_filter, engagement_threshold, content_type
    rule_config JSONB NOT NULL, -- Rule configuration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring Statistics
CREATE TABLE IF NOT EXISTS monitoring_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    platform VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    total_checks INTEGER DEFAULT 0,
    new_posts_found INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_platform_date UNIQUE(user_id, platform, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_users_user_id ON monitoring_users(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_users_platform ON monitoring_users(platform);
CREATE INDEX IF NOT EXISTS idx_monitoring_users_status ON monitoring_users(monitoring_status);
CREATE INDEX IF NOT EXISTS idx_monitoring_users_last_check ON monitoring_users(last_check_at);

CREATE INDEX IF NOT EXISTS idx_monitored_posts_monitoring_user_id ON monitored_posts(monitoring_user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_platform ON monitored_posts(platform);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_published_at ON monitored_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_is_new ON monitored_posts(is_new);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_notification_sent ON monitored_posts(notification_sent);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_type ON webhook_configs(webhook_type);

CREATE INDEX IF NOT EXISTS idx_monitoring_stats_user_id ON monitoring_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_stats_platform ON monitoring_stats(platform);
CREATE INDEX IF NOT EXISTS idx_monitoring_stats_date ON monitoring_stats(date);

-- Initialize platform data
INSERT INTO social_monitoring_platforms (platform_name, platform_label, api_base_url) VALUES
('weibo', 'Weibo', 'https://m.weibo.cn/api'),
('x_twitter', 'X (Twitter)', 'https://api.twitter.com/2')
ON CONFLICT (platform_name) DO NOTHING;

-- Create update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER update_monitoring_platforms_updated_at BEFORE UPDATE ON social_monitoring_platforms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_users_updated_at BEFORE UPDATE ON monitoring_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON webhook_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_rules_updated_at BEFORE UPDATE ON monitoring_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_stats_updated_at BEFORE UPDATE ON monitoring_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (based on local PostgreSQL user system)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;