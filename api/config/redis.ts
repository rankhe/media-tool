import Redis from 'redis';
import Bull from 'bull';
import { env } from './env.js';

let redisClient: Redis.RedisClientType | null = null;
let videoDownloadQueue: Bull.Queue | null = null;
let videoProcessQueue: Bull.Queue | null = null;
let videoPublishQueue: Bull.Queue | null = null;

// 尝试连接Redis，但不强制要求
export async function connectRedis() {
  try {
    redisClient = Redis.createClient({
      url: env.redis.url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false // 禁用自动重连
      }
    });

    redisClient.on('error', (err) => {
      console.warn('Redis Client Error (optional):', err.message);
      // 如果连接失败，清理客户端
      if (redisClient) {
        redisClient.quit().catch(() => {});
        redisClient = null;
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    
    // 初始化队列
    setupQueues();
  } catch (error) {
    console.warn('⚠️  Redis connection failed (optional):', error);
    console.log('📝 Running without Redis - task queues will use in-memory processing');
    redisClient = null;
    // 不退出进程，继续运行
  }
}

function setupQueues() {
  if (!redisClient) return;
  
  try {
    videoDownloadQueue = new Bull('video download', env.redis.url);
    videoProcessQueue = new Bull('video process', env.redis.url);
    videoPublishQueue = new Bull('video publish', env.redis.url);

    // 队列事件监听
    videoDownloadQueue.on('completed', (job) => {
      console.log(`✅ Download job ${job.id} completed`);
    });

    videoDownloadQueue.on('failed', (job, err) => {
      console.error(`❌ Download job ${job.id} failed:`, err);
    });

    videoProcessQueue.on('completed', (job) => {
      console.log(`✅ Process job ${job.id} completed`);
    });

    videoProcessQueue.on('failed', (job, err) => {
      console.error(`❌ Process job ${job.id} failed:`, err);
    });

    videoPublishQueue.on('completed', (job) => {
      console.log(`✅ Publish job ${job.id} completed`);
    });

    videoPublishQueue.on('failed', (job, err) => {
      console.error(`❌ Publish job ${job.id} failed:`, err);
    });
  } catch (error) {
    console.warn('⚠️  Queue setup failed:', error);
  }
}

// 导出队列访问器
export function getVideoDownloadQueue() {
  return videoDownloadQueue;
}

export function getVideoProcessQueue() {
  return videoProcessQueue;
}

export function getVideoPublishQueue() {
  return videoPublishQueue;
}

// 导出Redis客户端
export { redisClient };