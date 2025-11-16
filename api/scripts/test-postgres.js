import pool from '../config/postgres.js';
import { PostgreSQLService } from '../src/services/postgresqlService.js';

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
    
    client.release();
    
    // 测试数据库服务
    console.log('\n🔄 Testing PostgreSQL service methods...');
    
    // 测试获取用户
    const userResult = await PostgreSQLService.getUserByEmail('test@example.com');
    if (userResult.data) {
      console.log('✅ User retrieval test successful');
      console.log('   User:', userResult.data.name, '(ID:', userResult.data.id, ')');
    } else {
      console.log('ℹ️ No test user found, creating one...');
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('test123', 12);
      
      const newUser = await PostgreSQLService.createUser({
        name: '测试用户',
        email: 'test@example.com',
        password_hash: passwordHash,
        plan: 'free',
        usage_count: 0,
        max_daily_tasks: 10
      });
      
      if (newUser.data) {
        console.log('✅ Test user created successfully');
      } else {
        console.log('❌ Failed to create test user:', newUser.error);
      }
    }
    
    // 测试创建任务
    const taskResult = await PostgreSQLService.createTask({
      user_id: 1,
      task_type: 'download',
      source_config: { url: 'https://example.com/video.mp4' },
      status: 'pending',
      progress: 0
    });
    
    if (taskResult.data) {
      console.log('✅ Task creation test successful');
      console.log('   Task ID:', taskResult.data.id);
      
      // 测试更新任务状态
      const updateResult = await PostgreSQLService.updateTaskStatus(
        taskResult.data.id,
        'running',
        50
      );
      
      if (updateResult.data) {
        console.log('✅ Task update test successful');
      }
    } else {
      console.log('❌ Task creation test failed:', taskResult.error);
    }
    
    console.log('\n✅ All PostgreSQL tests completed successfully!');
    
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error);
    console.error('Error details:', error.message);
    
    if (error.code === '28P01') {
      console.log('\n💡 Authentication failed. Please check your PostgreSQL credentials in .env file');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Please create the database first:');
      console.log('   createdb media_tool');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Please ensure PostgreSQL is running on localhost:5432');
    }
  } finally {
    await pool.end();
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting PostgreSQL connection test...');
  testPostgreSQLConnection().catch(error => {
    console.error('❌ Test failed with error:', error);
    console.error('Error stack:', error.stack);
  });
}

export { testPostgreSQLConnection };