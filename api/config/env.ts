import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

export const env = {
  // 数据库配置
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  
  // Redis配置
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: '7d',
  },
  
  // 第三方平台API配置
  platforms: {
    douyin: {
      clientId: process.env.DOUYIN_CLIENT_ID || '',
      clientSecret: process.env.DOUYIN_CLIENT_SECRET || '',
    },
    kuaishou: {
      clientId: process.env.KUAISHOU_CLIENT_ID || '',
      clientSecret: process.env.KUAISHOU_CLIENT_SECRET || '',
    },
    xiaohongshu: {
      clientId: process.env.XIAOHONGSHU_CLIENT_ID || '',
      clientSecret: process.env.XIAOHONGSHU_CLIENT_SECRET || '',
    },
  },
  
  // 文件存储配置
  storage: {
    type: process.env.STORAGE_TYPE || 'supabase',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'videos',
  },
  
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // 视频处理配置
  video: {
    maxSize: process.env.MAX_VIDEO_SIZE || '500MB',
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3'),
    processingTimeout: parseInt(process.env.VIDEO_PROCESSING_TIMEOUT || '300000'),
  },
};

// 验证必需的环境变量
export function validateEnv() {
  const required = [
    'JWT_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}