const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'media_tool',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '123456',
});

async function initDatabase() {
  console.log('🔄 Initializing PostgreSQL database...');
  
  try {
    const client = await pool.connect();
    
    // 创建用户表
    await client.query(`
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
      )
    `);
    console.log('✅ Users table created');
    
    // 创建其他表
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        platform_user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        account_info JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform, platform_user_id)
      )
    `);
    console.log('✅ Accounts table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        task_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        source_config JSONB DEFAULT '{}',
        processing_config JSONB DEFAULT '{}',
        progress INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tasks table created');
    
    // 创建密码哈希
    const passwordHash = await bcrypt.hash('test123', 12);
    
    // 插入测试用户
    const result = await client.query(`
      INSERT INTO users (name, email, password_hash, plan, usage_count, max_daily_tasks)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, ['测试用户', 'test@example.com', passwordHash, 'free', 0, 10]);
    
    console.log('✅ Test user created/updated:', result.rows[0].name);
    
    // 插入测试账号
    const accountResult = await client.query(`
      INSERT INTO accounts (user_id, platform, platform_user_id, username, is_active, account_info)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
        username = EXCLUDED.username,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [result.rows[0].id, 'douyin', 'douyin_123', '测试抖音号', true, JSON.stringify({followers: 1000, following: 100})]);
    
    console.log('✅ Test account created:', accountResult.rows[0].username);
    
    client.release();
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log('🎉 You can now login with:');
    console.log('   Email: test@example.com');
    console.log('   Password: test123');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

initDatabase();