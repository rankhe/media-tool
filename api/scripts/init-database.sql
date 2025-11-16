-- 创建数据库
CREATE DATABASE media_tool;

-- 连接到数据库
\c media_tool;

-- 创建测试用户（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'media_user') THEN
        CREATE USER media_user WITH PASSWORD 'media_password';
    END IF;
END
$$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE media_tool TO media_user;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建表结构（简化版）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    usage_count INTEGER DEFAULT 0,
    max_daily_tasks INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试用户
INSERT INTO users (name, email, password_hash, plan, usage_count, max_daily_tasks) 
VALUES ('测试用户', 'test@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', 'free', 0, 10)
ON CONFLICT (email) DO NOTHING;

-- 显示结果
SELECT 'Database setup completed!' as status;
SELECT 'Test user created:' as info, email FROM users WHERE email = 'test@example.com';