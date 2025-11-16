-- 修复用户ID类型问题，支持大数字用户ID

-- 修改 monitoring_users 表的 target_user_id 字段类型为 TEXT 以支持更长的用户ID
ALTER TABLE monitoring_users 
ALTER COLUMN target_user_id TYPE TEXT;

-- 修改 monitored_posts 表的 post_id 字段类型为 TEXT
ALTER TABLE monitored_posts 
ALTER COLUMN post_id TYPE TEXT;

-- 修改 monitoring_users 表的 last_post_id 字段类型为 TEXT
ALTER TABLE monitoring_users 
ALTER COLUMN last_post_id TYPE TEXT;

-- 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_monitoring_users_target_user_id ON monitoring_users(target_user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_post_id ON monitored_posts(post_id);