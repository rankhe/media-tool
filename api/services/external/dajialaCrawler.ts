import { logger } from '../../utils/logger.js'
import { redisClient } from '../../config/redis.js'
import fs from 'fs'

export class DajialaCrawlerService {
  private readonly BASE_URL = 'https://dajiala.com'
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  async getLatestExplodes(limit: number = 20, opts?: { nocache?: boolean }): Promise<any[]> {
    const apiData = await this.fetchExplodesAPI(limit)
    if (apiData.length) return apiData
    return await this.fetchSection(['最新爆文', '爆文', '低粉爆文'], limit, 'dajiala:explodes', !!opts?.nocache)
  }

  async getLatestQualityAccounts(limit: number = 20, opts?: { nocache?: boolean }): Promise<any[]> {
    const apiData = await this.fetchQualityAccountsAPI(limit)
    if (apiData.length) return apiData
    return await this.fetchSection(['最新收录优质公众号', '优质公众号', '公众号收录'], limit, 'dajiala:quality_accounts', !!opts?.nocache)
  }

  async getLatestHotArticles(limit: number = 20, opts?: { nocache?: boolean }): Promise<any[]> {
    const apiData = await this.fetchTodayHotAPI(limit)
    if (apiData.length) return apiData
    return await this.fetchSection(['最新热文', '热文', '热门文章'], limit, 'dajiala:hot_articles', !!opts?.nocache)
  }

  private async fetchSection(sectionTitles: string[] | string, limit: number, cacheKey: string, nocache: boolean): Promise<any[]> {
    try {
      if (!nocache) {
        const cached = await this.getCache(cacheKey)
        if (cached && Array.isArray(cached) && cached.length) return cached.slice(0, limit)
      }

      const html = await this.fetchHtml('/main/')
      const titlesArr = Array.isArray(sectionTitles) ? sectionTitles : [sectionTitles]
      let list: any[] = []
      for (const t of titlesArr) {
        list = this.parseSection(html, t)
        if (list.length) break
      }
      if (!list.length) {
        logger.warn(`[Dajiala] 直取为空，尝试浏览器回退`)
        list = await this.fetchViaBrowser(titlesArr)
      }
      list = list.slice(0, limit)
      if (!nocache) {
        await this.setCache(cacheKey, list, Number(process.env.DAJIALA_CACHE_TTL || 600))
      }
      return list
    } catch (e) {
      logger.error(`[Dajiala] 获取版块失败`, e)
      return []
    }
  }

  private async fetchTodayHotAPI(limit: number): Promise<any[]> {
    try {
      const url = 'https://www.dajiala.com/fbmain/main/v1/today_hot'
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://dajiala.com/main/'
        }
      })
      if (!res.ok) return []
      const json = await res.json()
      const arr = this.pickFirstArray(json)
      if (!arr || !Array.isArray(arr)) return []
      const items = arr.slice(0, limit).map((it: any, idx: number) => {
        const title = String(it.title || it.news_title || it.name || it.subject || '').trim()
        const link = String(it.url || it.link || it.jump_url || '').trim()
        const rawThumb = String(it.cover || it.image || it.pic_url || it.cover_url || '').trim()
        const thumb = rawThumb && /^https?:\/\//.test(rawThumb) ? rawThumb : (rawThumb ? `${this.BASE_URL}${rawThumb}` : '')
        const ts = (it.time || it.publish_time || Date.now())
        return {
          id: `todayhot_${idx}_${Date.now()}`,
          platform: 'wechat',
          title,
          description: String(it.desc || it.abstract || '').trim(),
          thumbnail_url: thumb,
          video_url: '',
          duration: 0,
          view_count: Number((it as any).read_num ?? it.reads ?? it.view ?? 0),
          like_count: Number((it as any).zan_num ?? it.likes ?? 0),
          share_count: 0,
          comment_count: Number(it.comments || 0),
          created_at: typeof ts === 'number' ? new Date(ts).toISOString() : String(ts),
          author: {
            id: String(it.account_id || it.author_id || ''),
            name: String(it.account_name || it.author || ''),
            avatar_url: String(it.avatar || ''),
            follower_count: 0,
            verified: false
          },
          tags: Array.isArray(it.tags) ? it.tags : [],
          category: String((it as any).industry2 || ''),
          relevanceScore: 50,
          is_real_data: true,
          link: link,
          zan_num: Number((it as any).zan_num ?? 0)
        }
      })
      return items.filter(x => x.title && x.link)
    } catch {
      return []
    }
  }

  private async fetchExplodesAPI(limit: number): Promise<any[]> {
    try {
      const url = 'https://www.dajiala.com/fbmain/main/v1/today_hot?industry=26&home=1&page=1&num=6&topType=2'
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://dajiala.com/main/'
        }
      })
      if (!res.ok) return []
      const json = await res.json()
      const arr = this.pickFirstArray(json)
      if (!arr || !Array.isArray(arr)) return []
      const items = arr.slice(0, limit).map((it: any, idx: number) => {
        const title = String(it.title || it.news_title || it.name || it.subject || '').trim()
        const link = String(it.url || it.link || it.jump_url || '').trim()
        const rawThumb = String(it.cover || it.image || it.pic_url || it.cover_url || '').trim()
        const thumb = rawThumb && /^https?:\/\//.test(rawThumb) ? rawThumb : (rawThumb ? `${this.BASE_URL}${rawThumb}` : '')
        const ts = (it.time || it.publish_time || Date.now())
        return {
          id: `explodes_${idx}_${Date.now()}`,
          platform: 'wechat',
          title,
          description: String(it.desc || it.abstract || '').trim(),
          thumbnail_url: thumb,
          video_url: '',
          duration: 0,
          view_count: Number((it as any).read_num ?? it.reads ?? it.view ?? 0),
          like_count: Number((it as any).zan_num ?? it.likes ?? 0),
          share_count: 0,
          comment_count: Number(it.comments || 0),
          created_at: typeof ts === 'number' ? new Date(ts).toISOString() : String(ts),
          author: {
            id: String(it.account_id || it.author_id || ''),
            name: String(it.account_name || it.author || ''),
            avatar_url: String(it.avatar || ''),
            follower_count: 0,
            verified: false
          },
          tags: Array.isArray(it.tags) ? it.tags : [],
          category: String((it as any).industry2 || ''),
          relevanceScore: 50,
          is_real_data: true,
          link: link,
          zan_num: Number((it as any).zan_num ?? 0)
        }
      })
      return items.filter(x => x.title && x.link)
    } catch {
      return []
    }
  }

  private async fetchQualityAccountsAPI(limit: number): Promise<any[]> {
    try {
      const url = 'https://www.dajiala.com/fbmain/account/v1/last_mpaccount'
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://dajiala.com/main/'
        }
      })
      if (!res.ok) return []
      const json = await res.json()
      const arr = this.pickFirstArray(json)
      if (!arr || !Array.isArray(arr)) return []
      const items = arr.slice(0, limit).map((it: any, idx: number) => {
        const name = String(it.account_name || it.name || it.nickname || '').trim()
        const avatar = String(it.cover || it.avatar || it.headimg || '').trim()
        const link = String(it.url || it.link || '').trim()
        const desc = String(it.desc || it.intro || it.signature || '').trim()
        return {
          id: String(it.account_id || it.id || idx),
          platform: 'wechat',
          name,
          avatar_url: avatar,
          desc,
          link: link,
          is_real_data: true
        }
      })
      return items.filter(x => x.name)
    } catch {
      return []
    }
  }

  private pickFirstArray(obj: any): any[] | null {
    if (!obj) return null
    if (Array.isArray(obj)) return obj
    const keys = Object.keys(obj)
    for (const k of keys) {
      const v = obj[k]
      if (Array.isArray(v)) return v
      if (v && typeof v === 'object') {
        const inner = this.pickFirstArray(v)
        if (inner) return inner
      }
    }
    return null
  }

  private async fetchHtml(pathname: string): Promise<string> {
    const url = `${this.BASE_URL}${pathname}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': this.BASE_URL
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  }

  private parseSection(html: string, title: string): any[] {
    if (!html) return []
    let source = html
    const idx = html.indexOf(title)
    if (idx >= 0) {
      source = html.slice(idx, idx + 60_000)
    }
    const items: any[] = []
    const cardRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    let count = 0
    while ((m = cardRegex.exec(source)) && count < 100) {
      const link = m[1]
      const inner = m[2]
      const imgMatch = inner.match(/<img[^>]*src="([^"]+)"/i)
      // 过滤导航/登录等
      const text = inner.replace(/<[^>]+>/g, '').trim()
      const name = (text || '').replace(/[\n\r\t]+/g, ' ').trim()
      if (!link || !name) continue
      if (name.length < 4) continue
      if (/(登录|注册|联系我们|帮助|更多|查看更多)/.test(name)) continue
      const cover = imgMatch ? imgMatch[1] : ''
      items.push({
        id: `${title}_${count}_${Date.now()}`,
        platform: 'wechat',
        title: name.slice(0, 80),
        description: '',
        thumbnail_url: cover,
        video_url: '',
        duration: 0,
        view_count: 0,
        like_count: 0,
        share_count: 0,
        comment_count: 0,
        created_at: new Date().toISOString(),
        author: { id: '', name: '', avatar_url: '', follower_count: 0, verified: false },
        tags: [],
        category: 'lifestyle',
        relevanceScore: 50,
        is_real_data: true,
        link: link.startsWith('http') ? link : `${this.BASE_URL}${link}`
      })
      count++
    }
    // 若未命中标题片段且结果过少，则在全页再扫一次图片卡片
    if (items.length < 5 && idx < 0) {
      const all: any[] = []
      let mm: RegExpExecArray | null
      const re = /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<\/a>/gi
      while ((mm = re.exec(html)) && all.length < 80) {
        const link = mm[1]
        const cover = mm[2]
        const chunk = html.slice(Math.max(0, mm.index - 400), mm.index + 400)
        const txt = chunk.replace(/<[^>]+>/g, ' ').replace(/[\s]+/g, ' ').trim()
        if (!txt || txt.length < 4) continue
        if (/(登录|注册|联系我们|帮助|更多|查看更多)/.test(txt)) continue
        all.push({
          id: `all_${all.length}_${Date.now()}`,
          platform: 'wechat',
          title: txt.slice(0, 80),
          description: '',
          thumbnail_url: cover,
          video_url: '',
          duration: 0,
          view_count: 0,
          like_count: 0,
          share_count: 0,
          comment_count: 0,
          created_at: new Date().toISOString(),
          author: { id: '', name: '', avatar_url: '', follower_count: 0, verified: false },
          tags: [],
          category: 'lifestyle',
          relevanceScore: 50,
          is_real_data: true,
          link: link.startsWith('http') ? link : `${this.BASE_URL}${link}`
        })
      }
      return all
    }
    return items
  }

  private async fetchViaBrowser(sectionTitles: string[]): Promise<any[]> {
    const pp = await this.ensurePuppeteer()
    if (!pp) return []
    const launchOpts: any = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
    if (pp.core) {
      const exe = this.detectChromePath()
      if (!exe) return []
      launchOpts.executablePath = exe
    }
    let browser: any
    try {
      browser = await pp.mod.launch(launchOpts)
    } catch (e) {
      const edgePath = this.detectEdgePath() || undefined
      if (edgePath) {
        try { browser = await pp.mod.launch({ ...launchOpts, executablePath: edgePath }) } catch {}
      }
      if (!browser && !pp.core) {
        try { browser = await pp.mod.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled'] }) } catch {}
      }
      if (!browser) throw e
    }
    const page = await browser.newPage()
    try {
      await page.setUserAgent(this.USER_AGENT)
      await page.setViewport({ width: 1440, height: 900 })
      await page.goto(`${this.BASE_URL}/main/`, { waitUntil: 'networkidle2' })
      await new Promise(resolve => setTimeout(resolve, 2000))
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await new Promise(resolve => setTimeout(resolve, 900))
      }
      const headingsJson = JSON.stringify(sectionTitles)
      const preferredClasses: string[] = []
      if (sectionTitles.some(t => /最新爆文|爆文|低粉爆文/.test(t))) preferredClasses.push('.newIncluded1')
      if (sectionTitles.some(t => /最新收录优质公众号|优质公众号|公众号收录/.test(t))) preferredClasses.push('.newIncluded2')
      if (sectionTitles.some(t => /最新热文|热文|热门文章/.test(t))) preferredClasses.push('.newIncluded3')
      const classJson = JSON.stringify(preferredClasses.length ? preferredClasses : [])
      const js = `(() => {
        const headings = ${headingsJson};
        const classes = ${classJson};
        const contains = (el, text) => (el && el.innerText || '').includes(text);
        const extractFromContainer = (container) => {
          const anchors = Array.from(container.querySelectorAll('a'));
          const items = [];
          let idx = 0;
          for (const a of anchors) {
            const link = a.getAttribute('href') || '';
            const name = (a.textContent || '').trim();
            const img = a.querySelector('img');
            if (!link || !name || name.length < 4) continue;
            if (/(登录|注册|联系我们|帮助|更多|查看更多)/.test(name)) continue;
            items.push({ link, title: name, thumb: img ? img.src : '' });
            idx++; if (idx >= 60) break;
          }
          return items;
        };
        for (const cls of classes) {
          const c = document.querySelector(cls);
          if (c) {
            const list = extractFromContainer(c);
            if (list.length) return list;
          }
        }
        const findSection = () => {
          const nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,section,div'));
          for (const h of headings) {
            for (const n of nodes) {
              if (contains(n, h)) {
                let c = n;
                for (let i = 0; i < 8; i++) {
                  const p = c.parentElement || c;
                  if (!p) break;
                  const aCount = p.querySelectorAll('a').length;
                  if (aCount >= 6) { c = p; break; }
                  c = p;
                }
                const list = extractFromContainer(c);
                if (list.length) return list;
              }
            }
          }
          return [];
        };
        const items = findSection();
        if (items && items.length) return items;
        const fallbacks = Array.from(document.querySelectorAll('a'));
        const out = [];
        let i = 0;
        for (const a of fallbacks) {
          const link = a.getAttribute('href') || '';
          const name = (a.textContent || '').trim();
          const img = a.querySelector('img');
          if (!link || !name || name.length < 4) continue;
          if (/(登录|注册|联系我们|帮助|更多|查看更多)/.test(name)) continue;
          out.push({ link, title: name, thumb: img ? img.src : '' });
          i++; if (i >= 60) break;
        }
        return out;
      })()`
      const itemsFromPage = await page.evaluate(js)
      if (Array.isArray(itemsFromPage) && itemsFromPage.length) {
        return itemsFromPage.map((it: any, idx: number) => ({
          id: `wechat_${idx}_${Date.now()}`,
          platform: 'wechat',
          title: String(it.title || '').slice(0, 80),
          description: '',
          thumbnail_url: String(it.thumb || ''),
          video_url: '',
          duration: 0,
          view_count: 0,
          like_count: 0,
          share_count: 0,
          comment_count: 0,
          created_at: new Date().toISOString(),
          author: { id: '', name: '', avatar_url: '', follower_count: 0, verified: false },
          tags: [],
          category: 'lifestyle',
          relevanceScore: 50,
          is_real_data: true,
          link: it.link && it.link.startsWith('http') ? it.link : `${this.BASE_URL}${it.link}`
        }))
      }
      // 尝试获取目标版块的“更多”页链接（如 center?tabSt=...），再在子页解析
      const moreLink: string | null = await page.evaluate((headings) => {
        const contains = (el: any, text: string) => (el && (el.innerText || '').includes(text));
        const findContainer = () => {
          const nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,section,div')) as HTMLElement[];
          for (const h of headings as string[]) {
            for (const n of nodes) {
              if (contains(n, h)) {
                let c: HTMLElement | null = n;
                for (let i = 0; i < 6; i++) { c = (c?.parentElement || c); }
                return c;
              }
            }
          }
          return null;
        };
        const container = findContainer();
        if (!container) return null;
        const anchors = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const txt = (a.textContent || '').trim();
          if (/中心|更多|查看|center|tabSt/i.test(txt) || /center\?tabSt=/i.test(href)) {
            return href.startsWith('http') ? href : `${location.origin}${href}`
          }
        }
        return null;
      }, sectionTitles)
      if (moreLink) {
        await page.goto(moreLink, { waitUntil: 'networkidle2' })
        await new Promise(resolve => setTimeout(resolve, 1500))
        const subItems = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
          const out: any[] = [];
          let idx = 0;
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            const txt = (a.textContent || '').trim();
            const img = a.querySelector('img') as HTMLImageElement | null;
            if (!href || !txt || txt.length < 4) continue;
            if (/(登录|注册|联系我们|帮助|更多|查看更多)/.test(txt)) continue;
            out.push({ link: href, title: txt, thumb: img?.src || '' });
            idx++; if (idx >= 60) break;
          }
          return out;
        })
        if (Array.isArray(subItems) && subItems.length) {
          return subItems.map((it: any, idx: number) => ({
            id: `wechat_${idx}_${Date.now()}`,
            platform: 'wechat',
            title: String(it.title || '').slice(0, 80),
            description: '',
            thumbnail_url: String(it.thumb || ''),
            video_url: '',
            duration: 0,
            view_count: 0,
            like_count: 0,
            share_count: 0,
            comment_count: 0,
            created_at: new Date().toISOString(),
            author: { id: '', name: '', avatar_url: '', follower_count: 0, verified: false },
            tags: [],
            category: 'lifestyle',
            relevanceScore: 50,
            is_real_data: true,
            link: it.link && /^https?:\/\//.test(it.link) ? it.link : `${this.BASE_URL}${it.link}`
          }))
        }
      }
      const html = await page.content()
      for (const h of sectionTitles) {
        const list = this.parseSection(html, h)
        if (list.length) return list
      }
      return []
    } catch (e) {
      logger.error('[Dajiala] 浏览器回退失败', e)
      return []
    } finally {
      await browser.close()
    }
  }

  private async getCache(key: string): Promise<any[] | null> {
    try {
      if (!redisClient) return null
      const raw = await redisClient.get(key)
      if (!raw) return null
      const json = JSON.parse(raw)
      return Array.isArray(json) ? json : null
    } catch {
      return null
    }
  }

  private async setCache(key: string, value: any, ttlSeconds: number) {
    try {
      if (!redisClient) return
      const raw = JSON.stringify(value)
      await redisClient.setEx(key, ttlSeconds, raw)
    } catch {}
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

  private detectEdgePath(): string | undefined {
    const candidates = [
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ]
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p } catch {}
    }
    return undefined
  }

  public async clearCache(keys?: string[]): Promise<void> {
    try {
      if (!redisClient) return
      const ks = keys && keys.length ? keys : ['dajiala:explodes','dajiala:quality_accounts','dajiala:hot_articles']
      for (const k of ks) {
        await redisClient.del(k).catch(() => {})
      }
    } catch {}
  }
}

export default DajialaCrawlerService