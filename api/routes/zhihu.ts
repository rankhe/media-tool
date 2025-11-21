import express from 'express'
import { authenticateToken } from './auth.js'
import { logger } from '../utils/logger.js'
import multer from 'multer'
import { redisClient } from '../config/redis.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/publish', authenticateToken, async (req, res) => {
  try {
    const { type, title, content, images, source_url } = req.body || {}
    if (!type || !content) {
      return res.status(400).json({ success: false, error: 'type和content为必填' })
    }
    const { zhihuPublisher } = await import('../services/socialMonitoring/zhihuPublisher.js')
    const result = await zhihuPublisher.publish({ type, title, content, images: Array.isArray(images) ? images : [], source_url })
    if (result.success) {
      return res.json({ success: true, data: result })
    }
    return res.status(500).json({ success: false, error: result.error || '发布失败', details: result.details })
  } catch (error) {
    logger.error('Zhihu publish error:', error)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
})

export default router

router.post('/config', authenticateToken, upload.single('cookies_json'), async (req, res) => {
  try {
    const cookieString = typeof req.body.cookie_string === 'string' ? req.body.cookie_string.trim() : ''
    let cookiesJsonStr = ''
    if (req.file && req.file.buffer) {
      cookiesJsonStr = req.file.buffer.toString('utf-8')
      try {
        const parsed = JSON.parse(cookiesJsonStr)
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ success: false, error: 'JSON格式不正确，应为数组' })
        }
      } catch {
        return res.status(400).json({ success: false, error: '无法解析JSON文件' })
      }
    }
    if (!cookieString && !cookiesJsonStr) {
      return res.status(400).json({ success: false, error: '至少提供cookie_string或cookies_json其一' })
    }
    if (redisClient) {
      if (cookieString) await redisClient.set('zhihu:cookie_string', cookieString)
      if (cookiesJsonStr) await redisClient.set('zhihu:cookies_json', cookiesJsonStr)
    }
    return res.json({ success: true })
  } catch (e) {
    logger.error('Zhihu config error:', e)
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.get('/config/status', authenticateToken, async (req, res) => {
  try {
    let hasString = false
    let hasJson = false
    if (redisClient) {
      const s = await redisClient.get('zhihu:cookie_string')
      const j = await redisClient.get('zhihu:cookies_json')
      hasString = !!(s && s.length)
      hasJson = !!(j && j.length)
    }
    return res.json({ success: true, data: { cookie_string: hasString, cookies_json: hasJson } })
  } catch (e) {
    return res.status(500).json({ success: false, error: '服务器错误' })
  }
})