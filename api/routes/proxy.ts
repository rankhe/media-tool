import express from 'express'
import axios from 'axios'

const router = express.Router()

router.get('/image', async (req, res) => {
  try {
    const url = String(req.query.url || '')
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ success: false, error: 'Invalid url' })
    }

    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    let referer = 'https://www.bilibili.com/'
    if (host.endsWith('qpic.cn') || host.includes('weixin')) {
      referer = 'https://mp.weixin.qq.com/'
    } else if (host.includes('bilibili')) {
      referer = 'https://www.bilibili.com/'
    } else if (host.includes('douyin') || host.includes('bytecdn')) {
      referer = 'https://www.douyin.com/'
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000
    })

    const contentType = response.headers['content-type'] || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=300')
    response.data.pipe(res)
  } catch (error: any) {
    const status = error?.response?.status || 500
    res.status(status).json({ success: false, error: 'Proxy image failed' })
  }
})

export default router