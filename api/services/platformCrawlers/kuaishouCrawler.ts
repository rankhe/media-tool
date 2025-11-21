import { logger } from '../../utils/logger.js'
import fs from 'fs'

export class KuaishouCrawlerService {
  private readonly BASE_URL = 'https://www.kuaishou.com'
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
      const state = this.extractApolloState(html)
      const items = this.pickVideoItems(state)
      const videos = items.slice(0, limit).map(v => this.mapItemToVideo(v))
      if (videos.length && videos[0]?.id) return videos
      logger.warn('[Kuaishou] SSR解析为空，尝试启用无头浏览器回退')
      const viaBrowser = await this.getTrendingViaBrowser(limit)
      return viaBrowser
    } catch (e) {
      logger.error('[Kuaishou] 获取热门失败', e)
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

  getPlatformName(): string { return 'kuaishou' }

  private extractApolloState(html: string): any {
    const m = html.match(/__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/)
    if (!m) return {}
    try {
      const jsonStr = m[1]
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }

  private pickVideoItems(state: any): any[] {
    const arr: any[] = []
    const values = state && typeof state === 'object' ? Object.values(state) : []
    values.forEach((v: any) => {
      if (!v) return
      if (v.__typename && /Photo|Video/i.test(v.__typename)) arr.push(v)
      if (v.items && Array.isArray(v.items)) v.items.forEach((it: any) => { if (it && (it.photoId || it.videoId)) arr.push(it) })
    })
    return arr
  }

  private mapItemToVideo(v: any) {
    const id = String(v.photoId || v.videoId || v.id || '')
    const title = String(v.caption || v.title || '')
    const desc = String(v.caption || '')
    const cover = v.coverUrl || v.coverUrls?.[0]?.url || v.poster || ''
    const play = v.playUrl || v.playUrls?.[0]?.url || ''
    const url = id ? `https://www.kuaishou.com/short-video/${id}` : ''
    const ts = v.timestamp || Date.now()
    const stats = v.stats || {}
    const author = v.author || v.user || {}
    return {
      id,
      platform: 'kuaishou',
      title,
      description: desc,
      thumbnail_url: cover,
      video_url: url || play,
      duration: v.duration || 0,
      view_count: stats.viewCount || v.viewCount || 0,
      like_count: stats.likeCount || v.likeCount || 0,
      share_count: stats.shareCount || v.shareCount || 0,
      comment_count: stats.commentCount || v.commentCount || 0,
      created_at: new Date(ts).toISOString(),
      author: {
        id: String(author.id || author.userId || ''),
        name: String(author.name || author.userName || ''),
        avatar_url: String(author.avatar || author.headurl || ''),
        follower_count: 0,
        verified: Boolean(author.verified || author.isVerified)
      },
      tags: Array.isArray(v.tags) ? v.tags.map((t: any) => t.name || t).filter(Boolean) : [],
      category: 'entertainment',
      relevanceScore: this.score(stats.viewCount || 0, stats.likeCount || 0, stats.commentCount || 0),
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
      const state = this.extractApolloState(html)
      const items = this.pickVideoItems(state)
      const videos = items.slice(0, limit).map(v => this.mapItemToVideo(v))
      return videos
    } catch (e) {
      logger.error('[Kuaishou] 无头浏览器回退失败', e)
      return []
    } finally {
      await browser.close()
    }
  }
}

export default KuaishouCrawlerService