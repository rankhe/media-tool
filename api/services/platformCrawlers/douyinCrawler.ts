import { logger } from '../../utils/logger.js'
import fs from 'fs'

export class DouyinCrawlerService {
  private readonly BASE_URL = 'https://www.douyin.com'
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  async getTrendingVideos(category: string = 'all', limit: number = 20): Promise<any[]> {
    try {
      const url = `${this.BASE_URL}/`
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': this.BASE_URL
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const data = this.extractRenderData(html)
      const items: any[] = this.pickAwemeList(data)
      const videos = items.slice(0, limit).map(v => this.mapAwemeToVideo(v))
      if (videos.length && videos[0]?.id) return videos
      logger.warn('[Douyin] SSR解析为空，尝试启用无头浏览器回退')
      const viaBrowser = await this.getTrendingViaBrowser(limit)
      return viaBrowser
    } catch (e) {
      logger.error('[Douyin] 获取热门失败', e)
      return []
    }
  }

  async searchVideos(keyword: string, platform?: string, limit: number = 20): Promise<any[]> {
    return []
  }

  async getUserVideos(username: string, limit: number = 30): Promise<any[]> {
    return []
  }

  async getUserInfo(username: string): Promise<any> {
    return {}
  }

  getPlatformName(): string { return 'douyin' }

  private extractRenderData(html: string): any {
    const m = html.match(/id="RENDER_DATA"[^>]*>([^<]+)</)
    if (!m) return {}
    try {
      const jsonStr = decodeURIComponent(m[1])
      const obj = JSON.parse(jsonStr)
      return obj
    } catch {
      return {}
    }
  }

  private pickAwemeList(obj: any): any[] {
    const arr: any[] = []
    const walk = (o: any) => {
      if (!o) return
      if (Array.isArray(o)) {
        o.forEach(walk)
        return
      }
      if (typeof o === 'object') {
        if (o.aweme_list && Array.isArray(o.aweme_list)) arr.push(...o.aweme_list)
        Object.values(o).forEach(walk)
      }
    }
    walk(obj)
    return arr
  }

  private mapAwemeToVideo(v: any) {
    const id = String(v.aweme_id || v.awemeId || v.id || '')
    const title = String(v.desc || v.share_info?.share_title || '')
    const desc = String(v.desc || '')
    const cover = v.video?.cover?.url_list?.[0] || v.video?.origin_cover?.url_list?.[0] || v.images?.[0]?.url || ''
    const playUrl = v.video?.play_addr?.url_list?.[0] || ''
    const url = id ? `https://www.douyin.com/video/${id}` : ''
    const createTs = v.create_time || v.createTime || Date.now()
    const stats = v.statistics || {}
    const author = v.author || v.music?.owner || {}
    return {
      id,
      platform: 'douyin',
      title,
      description: desc,
      thumbnail_url: cover,
      video_url: url || playUrl,
      duration: v.video?.duration || 0,
      view_count: stats.play_count || stats.playCount || 0,
      like_count: stats.digg_count || stats.diggCount || 0,
      share_count: stats.share_count || stats.shareCount || 0,
      comment_count: stats.comment_count || stats.commentCount || 0,
      created_at: new Date((createTs || Date.now()) * 1000).toISOString(),
      author: {
        id: String(author?.uid || author?.id || ''),
        name: String(author?.nickname || author?.name || ''),
        avatar_url: String(author?.avatar_thumb?.url_list?.[0] || author?.avatar || ''),
        follower_count: 0,
        verified: false
      },
      tags: Array.isArray(v.text_extra) ? v.text_extra.map((t: any) => t.hashtag_name).filter(Boolean) : [],
      category: 'entertainment',
      relevanceScore: this.score(stats.play_count || 0, stats.digg_count || 0, stats.comment_count || 0),
      is_real_data: true
    }
  }

  private score(view: number, like: number, comment: number) {
    const a = Math.log10((view || 0) + 1) * 10
    const b = ((like || 0) + (comment || 0)) / Math.max(1, view || 1) * 1000
    return Math.min(a + b, 100)
  }

  private async ensurePuppeteer(): Promise<{ mod: any; core: boolean } | null> {
    try {
      const puppeteer = await import('puppeteer')
      return { mod: puppeteer, core: false }
    } catch {
      try {
        const puppeteerCore = await import('puppeteer-core')
        return { mod: puppeteerCore, core: true }
      } catch {
        return null
      }
    }
  }

  private detectChromePath(): string | undefined {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
    const candidates = [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      `C:/Users/${process.env.USERNAME || 'User'}/AppData/Local/Google/Chrome/Application/chrome.exe`
    ]
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p } catch {}
    }
    return undefined
  }

  private async getTrendingViaBrowser(limit: number): Promise<any[]> {
    const pp = await this.ensurePuppeteer()
    if (!pp) return []
    const launchOpts: any = { headless: true }
    if (pp.core) {
      const exe = this.detectChromePath()
      if (!exe) return []
      launchOpts.executablePath = exe
    }
    const browser = await pp.mod.launch(launchOpts)
    const page = await browser.newPage()
    try {
      await page.setUserAgent(this.USER_AGENT)
      await page.goto(`${this.BASE_URL}/`, { waitUntil: 'networkidle2' })
      const html = await page.content()
      const data = this.extractRenderData(html)
      const items: any[] = this.pickAwemeList(data)
      const videos = items.slice(0, limit).map(v => this.mapAwemeToVideo(v))
      return videos
    } catch (e) {
      logger.error('[Douyin] 无头浏览器回退失败', e)
      return []
    } finally {
      await browser.close()
    }
  }
}

export default DouyinCrawlerService