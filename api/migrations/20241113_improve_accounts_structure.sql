-- 优化accounts表结构，解决字段设计不合理问题

-- 1. 添加缺失的字段
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(255),
ADD COLUMN IF NOT EXISTS cookies TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- 2. 更新现有数据，将username复制到nickname（如果nickname为空）
UPDATE accounts 
SET nickname = username 
WHERE nickname IS NULL OR nickname = '';

-- 3. 将is_active迁移到status字段
UPDATE accounts 
SET status = CASE 
    WHEN is_active = true THEN 'active'
    WHEN is_active = false THEN 'inactive'
    ELSE 'active'
END;

-- 4. 将access_token迁移到cookies字段（如果cookies为空）
UPDATE accounts 
SET cookies = access_token 
WHERE cookies IS NULL AND access_token IS NOT NULL;

-- 5. 设置默认值和约束
ALTER TABLE accounts 
ALTER COLUMN nickname SET DEFAULT '',
ALTER COLUMN status SET DEFAULT 'active',
ALTER COLUMN status SET NOT NULL;

-- 6. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_nickname ON accounts(nickname);

-- 7. 添加字段注释
COMMENT ON COLUMN accounts.nickname IS '显示昵称，可修改';
COMMENT ON COLUMN accounts.cookies IS '登录cookies或访问令牌';
COMMENT ON COLUMN accounts.status IS '账号状态：active/inactive/expired';
COMMENT ON COLUMN accounts.last_login IS '最后登录时间';
COMMENT ON COLUMN accounts.username IS '平台用户名，通常不可修改';
COMMENT ON COLUMN accounts.platform_user_id IS '平台用户ID，用于API调用';

-- 8. 迁移account_info中的数据（如果有的话）
-- 将account_info中的有用信息提取到独立字段
UPDATE accounts 
SET nickname = COALESCE(account_info->>'nickname', nickname),
    last_login = COALESCE((account_info->>'last_login')::timestamp, last_login)
WHERE account_info IS NOT NULL;

-- 9. 更新触发器，确保updated_at字段正常工作
-- 触发器已在init_postgres.sql中创建，这里不需要重复创建

-- 10. 验证数据完整性
-- 检查是否有异常数据
SELECT 
    status,
    COUNT(*) as count,
    'status should be active/inactive/expired' as check_info
FROM accounts 
WHERE status NOT IN ('active', 'inactive', 'expired')
GROUP BY status;