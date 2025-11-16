const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function createDatabase() {
  console.log('🔄 Creating PostgreSQL database...');
  
  try {
    // 连接到默认的 postgres 数据库
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: 'postgres', // 使用默认数据库
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '123456',
    });

    const client = await pool.connect();
    
    // 检查数据库是否存在
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'media_tool'"
    );
    
    if (checkResult.rows.length === 0) {
      // 创建数据库
      await client.query('CREATE DATABASE media_tool');
      console.log('✅ Database "media_tool" created successfully');
    } else {
      console.log('ℹ️ Database "media_tool" already exists');
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Database creation failed:', error.message);
    if (error.code === '28P01') {
      console.log('💡 Authentication failed. Please check your PostgreSQL password.');
      console.log('💡 Default PostgreSQL passwords are often: postgres, 123456, or empty');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused. Please ensure PostgreSQL is running.');
    }
  }
}

createDatabase();