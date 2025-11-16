import { Router } from 'express';
import pool from '../config/postgres.js';

const router = Router();

/**
 * 执行数据库迁移来优化accounts表结构
 */
router.post('/api/migrate/accounts', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始优化accounts表结构...');
    
    // 1. 添加缺失的字段
    await client.query(`
      ALTER TABLE accounts 
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(255),
      ADD COLUMN IF NOT EXISTS cookies TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
    `);
    
    console.log('✅ 添加缺失字段完成');
    
    // 2. 更新现有数据，将username复制到nickname（如果nickname为空）
    const updateNicknameResult = await client.query(`
      UPDATE accounts 
      SET nickname = username 
      WHERE nickname IS NULL OR nickname = '';
    `);
    
    console.log(`✅ 更新nickname数据完成，影响${updateNicknameResult.rowCount}行`);
    
    // 3. 将is_active迁移到status字段
    const updateStatusResult = await client.query(`
      UPDATE accounts 
      SET status = CASE 
          WHEN is_active = true THEN 'active'
          WHEN is_active = false THEN 'inactive'
          ELSE 'active'
      END;
    `);
    
    console.log(`✅ 更新status数据完成，影响${updateStatusResult.rowCount}行`);
    
    // 4. cookies字段保持为空，因为数据库中没有access_token字段需要迁移
    const updateCookiesResult = { rowCount: 0 }; // 没有数据需要迁移
    
    console.log('✅ cookies字段保持为空，无需迁移数据');
    
    // 5. 设置默认值和约束
    await client.query(`
      ALTER TABLE accounts 
      ALTER COLUMN nickname SET DEFAULT '',
      ALTER COLUMN status SET DEFAULT 'active',
      ALTER COLUMN status SET NOT NULL;
    `);
    
    console.log('✅ 设置默认值和约束完成');
    
    // 6. 创建索引优化查询
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
      CREATE INDEX IF NOT EXISTS idx_accounts_nickname ON accounts(nickname);
    `);
    
    console.log('✅ 创建索引完成');
    
    // 7. 添加字段注释
    await client.query(`
      COMMENT ON COLUMN accounts.nickname IS '显示昵称，可修改';
      COMMENT ON COLUMN accounts.cookies IS '登录cookies或访问令牌';
      COMMENT ON COLUMN accounts.status IS '账号状态：active/inactive/expired';
      COMMENT ON COLUMN accounts.last_login IS '最后登录时间';
      COMMENT ON COLUMN accounts.username IS '平台用户名，通常不可修改';
      COMMENT ON COLUMN accounts.platform_user_id IS '平台用户ID，用于API调用';
    `);
    
    console.log('✅ 添加字段注释完成');
    
    // 8. 迁移account_info中的数据（如果有的话）
    const updateAccountInfoResult = await client.query(`
      UPDATE accounts 
      SET nickname = COALESCE(account_info->>'nickname', nickname),
          last_login = COALESCE((account_info->>'last_login')::timestamp, last_login)
      WHERE account_info IS NOT NULL;
    `);
    
    console.log(`✅ 迁移account_info数据完成，影响${updateAccountInfoResult.rowCount}行`);
    
    // 9. 验证数据完整性
    const validationResult = await client.query(`
      SELECT 
          status,
          COUNT(*) as count
      FROM accounts 
      WHERE status NOT IN ('active', 'inactive', 'expired')
      GROUP BY status;
    `);
    
    if (validationResult.rows.length > 0) {
      console.log('⚠️  发现异常状态数据:', validationResult.rows);
    } else {
      console.log('✅ 数据验证通过');
    }
    
    await client.query('COMMIT');
    
    console.log('🎉 accounts表结构优化完成！');
    
    res.json({
      success: true,
      message: 'accounts表结构优化完成',
      details: {
        nicknameUpdated: updateNicknameResult.rowCount,
        statusUpdated: updateStatusResult.rowCount,
        cookiesUpdated: updateCookiesResult.rowCount,
        accountInfoMigrated: updateAccountInfoResult.rowCount,
        validationIssues: validationResult.rows.length
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库迁移失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库迁移失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  } finally {
    client.release();
  }
});

/**
 * 获取accounts表结构信息
 */
router.get('/api/migrate/accounts/info', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        description
      FROM information_schema.columns
      LEFT JOIN pg_description ON 
        pg_description.objoid = (SELECT oid FROM pg_class WHERE relname = 'accounts')
        AND pg_description.objsubid = ordinal_position
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position;
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取表结构信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取表结构信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;