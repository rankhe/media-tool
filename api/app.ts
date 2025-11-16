/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { validateEnv } from './config/env.js'
import { connectRedis } from './config/redis.js'

// 路由导入
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/accounts.js'
import videoRoutes from './routes/videos.js'
import taskRoutes from './routes/tasks.js'
import publishRoutes from './routes/publish.js'
import publishTasksRoutes from './routes/publish-tasks.js'
import statsRoutes from './routes/stats.js'
import settingsRoutes from './routes/settings.js'
import analyticsRoutes from './routes/analytics.js'
import migrateRoutes from './routes/migrate.js'
import monitoringRoutes from './routes/monitoring.js'
import monitoringAdminRoutes from './routes/monitoring-admin.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 验证环境变量
try {
  validateEnv()
} catch (error) {
  console.error('❌ Environment validation failed:', error)
  process.exit(1)
}

const app: express.Application = express()

// 安全中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// 限流中间件 - 针对监控接口设置更宽松的限制
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 300, // 增加限制到每15分钟300个请求
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    }
  },
  skip: (req) => {
    // 跳过监控相关的请求，因为它们有独立的限流
    return req.path.includes('/monitoring');
  }
})

// 监控接口专用限流 - 更宽松
const monitoringLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 50, // 每5分钟50个请求
  message: {
    success: false,
    error: {
      message: 'Too many monitoring requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    }
  }
})

// CORS配置 - 必须在限流之前
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(generalLimiter)
app.use('/api/monitoring', monitoringLimiter)

// 请求体解析
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 健康检查
app.use('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// API路由
app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/publish', publishRoutes)
app.use('/api/publish-tasks', publishTasksRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/monitoring', monitoringRoutes)
app.use('/api/monitoring-admin', monitoringAdminRoutes)
app.use('/', migrateRoutes)

// 全局错误处理
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Global error handler:', error)
  
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500
    }
  })
})

// 404处理
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
      code: 'NOT_FOUND',
      statusCode: 404
    }
  })
})

// 初始化服务
export async function initializeServices() {
  try {
    // 连接Redis
    await connectRedis()
    
    // Start social media monitoring scheduler
    const { monitoringScheduler } = await import('./services/socialMonitoring/scheduler.js')
    monitoringScheduler.start()
    console.log('✅ Social media monitoring scheduler started')
    
    console.log('✅ All services initialized successfully')
  } catch (error) {
    console.error('❌ Service initialization failed:', error)
    process.exit(1)
  }
}

export default app