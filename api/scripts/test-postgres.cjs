const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'media_tool',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function testPostgreSQLConnection() {
  console.log('🔄 Testing PostgreSQL connection...');
  console.log('📋 Environment variables:');
  console.log('   POSTGRES_HOST:', process.env.POSTGRES_HOST);
  console.log('   POSTGRES_PORT:', process.env.POSTGRES_PORT);
  console.log('   POSTGRES_DB:', process.env.POSTGRES_DB);
  console.log('   POSTGRES_USER:', process.env.POSTGRES_USER);
  
  try {
    // 测试基本连接
    console.log('🔄 Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection successful');
    
    // 测试查询
    console.log('🔄 Testing query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query test successful, current time:', result.rows[0].current_time);
    
    // 测试创建用户表（如果不存在）
    console.log('🔄 Testing table creation...');
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
    console.log('✅ Users table created/verified');
    
    // 测试插入数据
    console.log('🔄 Testing data insertion...');
    const insertResult = await client.query(`
      INSERT INTO users (name, email, password_hash, plan, usage_count, max_daily_tasks)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, ['测试用户', 'test@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', 'free', 0, 10]);
    
    console.log('✅ Test user created/updated:', insertResult.rows[0].name);
    
    // 测试查询数据
    console.log('🔄 Testing data retrieval...');
    const selectResult = await client.query('SELECT * FROM users WHERE email = $1', ['test@example.com']);
    console.log('✅ User retrieval test successful:', selectResult.rows[0].name);
    
    client.release();
    
    console.log('\n✅ All PostgreSQL tests completed successfully!');
    console.log('🎉 PostgreSQL database is ready to use!');
    
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error.message);
    
    if (error.code === '28P01') {
      console.log('\n💡 Authentication failed. Please check your PostgreSQL credentials in .env file');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Please create the database first:');
      console.log('   createdb media_tool');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Please ensure PostgreSQL is running on localhost:5432');
    } else {
      console.log('\n💡 Error code:', error.code);
      console.log('💡 Error detail:', error.detail);
    }
  } finally {
    await pool.end();
  }
}

// 运行测试
testPostgreSQLConnection().catch(error => {
  console.error('❌ Test failed with error:', error);
});