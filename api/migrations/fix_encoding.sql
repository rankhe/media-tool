-- 修复数据库中文编码问题

-- 确保数据库使用 UTF8 编码
UPDATE pg_database SET encoding = pg_char_to_encoding('UTF8') WHERE datname = 'media_tool';

-- 更新客户端编码设置
SET client_encoding = 'UTF8';
SET server_encoding = 'UTF8';

-- 修复已存在的乱码数据（如果存在）
-- 注意：这只会修复后续插入的数据，已存在的乱码可能需要手动修复

-- 添加编码检查函数
CREATE OR REPLACE FUNCTION check_encoding(text) RETURNS text AS $$
BEGIN
  RETURN convert_from(convert_to($1, 'UTF8'), 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- 创建触发器确保新插入的数据编码正确
CREATE OR REPLACE FUNCTION ensure_utf8_encoding() RETURNS TRIGGER AS $$
BEGIN
  -- 确保字符串字段使用 UTF8 编码
  IF TG_TABLE_NAME = 'monitoring_users' THEN
    NEW.target_username := check_encoding(NEW.target_username);
    NEW.target_display_name := check_encoding(NEW.target_display_name);
    NEW.target_bio := check_encoding(NEW.target_bio);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 monitoring_users 表创建触发器
DROP TRIGGER IF EXISTS ensure_monitoring_users_encoding ON monitoring_users;
CREATE TRIGGER ensure_monitoring_users_encoding
  BEFORE INSERT OR UPDATE ON monitoring_users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_utf8_encoding();

-- 为 monitored_posts 表创建触发器
DROP TRIGGER IF EXISTS ensure_monitored_posts_encoding ON monitored_posts;
CREATE TRIGGER ensure_monitored_posts_encoding
  BEFORE INSERT OR UPDATE ON monitored_posts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_utf8_encoding();