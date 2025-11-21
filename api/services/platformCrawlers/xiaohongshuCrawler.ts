import { logger } from '../../utils/logger.js'
import fs from 'fs'

export class XiaohongshuCrawlerService {
  private readonly BASE_URL = 'https://www.xiaohongshu.com'
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  async getTrendingVideos(category: string = 'all', limit: number = 20): Promise<any[]> {
    try {
      const url = `${this.BASE_URL}/explore`
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
      const state = this.extractInitialState(html)
      const items = this.pickNotes(state)
      const videos = items.slice(0, limit).map(v => this.mapNoteToVideo(v))
      if (videos.length && videos[0]?.id) return videos
      logger.warn('[XHS] SSR解析为空，尝试启用无头浏览器回退')
      const viaBrowser = await this.getTrendingViaBrowser(limit)
      return viaBrowser
    } catch (e) {
      logger.error('[XHS] 获取热门失败', e)
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

  getPlatformName(): string { return 'xiaohongshu' }

  private extractInitialState(html: string): any {
    const m = html.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/)
    if (!m) return {}
    try {
      const jsonStr = m[1]
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }

  private pickNotes(state: any): any[] {
    const arr: any[] = []
    const walk = (o: any) => {
      if (!o) return
      if (Array.isArray(o)) { o.forEach(walk); return }
      if (typeof o === 'object') {
        if (o.notes && Array.isArray(o.notes)) arr.push(...o.notes)
        if (o.items && Array.isArray(o.items)) arr.push(...o.items)
        Object.values(o).forEach(walk)
      }
    }
    walk(state)
    return arr
  }

  private mapNoteToVideo(n: any) {
    const id = String(n.id || n.noteId || '')
    const title = String(n.title || n.desc || '')
    const desc = String(n.desc || '')
    const cover = n.cover?.url || n.imageList?.[0]?.url || ''
    const video = n.video?.url || ''
    const url = id ? `https://www.xiaohongshu.com/explore/${id}` : ''
    const ts = n.time || Date.now()
    const stats = n.statistics || {}
    const author = n.user || {}
    const isVideo = Boolean(n.video)
    return {
      id,
      platform: 'xiaohongshu',
      title,
      description: desc,
      thumbnail_url: cover,
      video_url: url || video,
      duration: n.video?.duration || 0,
      view_count: stats.viewCount || n.collectedCount || 0,
      like_count: stats.likeCount || n.likedCount || 0,
      share_count: stats.shareCount || 0,
      comment_count: stats.commentCount || n.commentCount || 0,
      created_at: new Date(ts).toISOString(),
      author: {
        id: String(author.id || author.userId || ''),
        name: String(author.nickname || author.name || ''),
        avatar_url: String(author.avatar || author.avatarUrl || ''),
        follower_count: 0,
        verified: Boolean(author.officialVerified || author.verified)
      },
      tags: Array.isArray(n.tags) ? n.tags.map((t: any) => t.name || t).filter(Boolean) : [],
      category: 'lifestyle',
      relevanceScore: this.score(this.toNum(stats.viewCount) || 0, this.toNum(stats.likeCount) || this.toNum(n.likedCount) || 0, this.toNum(stats.commentCount) || this.toNum(n.commentCount) || 0),
      is_real_data: true
    }
  }

  private toNum(v: any) { return typeof v === 'number' ? v : 0 }

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
      await page.goto(`${this.BASE_URL}/explore`, { waitUntil: 'networkidle2' })
      const html = await page.content()
      const state = this.extractInitialState(html)
      const items = this.pickNotes(state)
      const videos = items.slice(0, limit).map(v => this.mapNoteToVideo(v))
      return videos
    } catch (e) {
      logger.error('[XHS] 无头浏览器回退失败', e)
      return []
    } finally {
      await browser.close()
    }
  }
}

export default XiaohongshuCrawlerService