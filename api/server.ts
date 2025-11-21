/**
 * local server entry file, for local development
 */
import app, { initializeServices } from './app.js';
import http from 'http';
import { taskProcessor } from './services/taskProcessor.js';

/**
 * start server with port
 */
process.env.PORT = process.env.PORT || '3000';
const DEFAULT_PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    // 初始化服务
    await initializeServices();
    
    // 初始化任务处理器
    console.log('🔄 Initializing task processor...');

    const startOnPort = (port: number) => {
      const server = http.createServer(app);
      server.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          const next = port + 1;
          console.warn(`⚠️  Port ${port} is in use, trying ${next}...`);
          startOnPort(next);
        } else {
          console.error('❌ Failed to start server:', err);
          process.exit(1);
        }
      });

      server.listen(port, () => {
        console.log(`🚀 Server ready on port ${port}`);
        console.log(`📊 Health check: http://localhost:${port}/api/health`);
      });

      /**
       * close server
       */
      process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM signal received');
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('🛑 SIGINT signal received');
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });
    };

    startOnPort(DEFAULT_PORT);


  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;