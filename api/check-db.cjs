const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost', 
  database: 'media_tool',
  password: '123456',
  port: 5432
});

async function checkTables() {
  try {
    console.log('Checking database tables...');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Existing tables:', result.rows.map(r => r.table_name));
    
    if (result.rows.length === 0) {
      console.log('No tables found. Need to run migration.');
    } else {
      // Check specific tables for social monitoring
      const tables = ['monitored_users', 'social_monitoring_platforms', 'webhook_configs', 'monitoring_logs'];
      
      for (const table of tables) {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`${table}: ${countResult.rows[0].count} rows`);
        } catch (err) {
          console.log(`${table}: Table does not exist`);
        }
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
    await pool.end();
  }
}

checkTables();