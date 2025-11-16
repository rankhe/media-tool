/**
 * local server entry file, for local development
 */
import app, { initializeServices } from './app.js';
import { taskProcessor } from './services/taskProcessor.js';

/**
 * start server with port
 */
process.env.PORT = process.env.PORT || '3000';
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 初始化服务
    await initializeServices();
    
    // 初始化任务处理器
    console.log('🔄 Initializing task processor...');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server ready on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
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

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;