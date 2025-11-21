import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { redisClient } from '../../config/redis.js'

async function getCookies() {
  try {
    if (redisClient) {
      const jsonStr = await redisClient.get('zhihu:cookies_json')
      if (jsonStr) {
        const arr = JSON.parse(jsonStr)
        if (Array.isArray(arr)) return arr
      }
      const cookieStr = await redisClient.get('zhihu:cookie_string')
      if (cookieStr) {
        return cookieStr.split(';').map(s => {
          const [name, ...rest] = s.trim().split('=')
          return { name, value: rest.join('='), domain: '.zhihu.com', path: '/' }
        })
      }
    }
  } catch {}
  const filePath = process.env.ZHIHU_COOKIES_JSON
  const cookieStr = process.env.ZHIHU_COOKIE_STRING
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const json = JSON.parse(raw)
      return Array.isArray(json) ? json : []
    } catch {
      return []
    }
  }
  if (cookieStr) {
    return cookieStr.split(';').map(s => {
      const [name, ...rest] = s.trim().split('=')
      return { name, value: rest.join('='), domain: '.zhihu.com', path: '/' }
    })
  }
  return []
}

async function downloadImages(imageUrls: string[]) {
  const dir = path.join(process.cwd(), 'api', 'uploads', 'tmp', String(Date.now()))
  fs.mkdirSync(dir, { recursive: true })
  const files: string[] = []
  for (const url of imageUrls) {
    try {
      const resp = await axios.get(url, { responseType: 'arraybuffer' })
      const file = path.join(dir, path.basename(new URL(url).pathname) || `${Date.now()}.jpg`)
      fs.writeFileSync(file, resp.data)
      files.push(file)
    } catch {
      continue
    }
  }
  return { dir, files }
}

async function ensurePuppeteer() {
  try {
    const puppeteer = await import('puppeteer')
    return { mod: puppeteer, core: false }
  } catch (e) {
    try {
      const puppeteerCore = await import('puppeteer-core')
      return { mod: puppeteerCore, core: true }
    } catch {
      return null
    }
  }
}

function detectChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Users/' + (process.env.USERNAME || 'User') + '/AppData/Local/Google/Chrome/Application/chrome.exe'
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch {}
  }
  return undefined
}

export const zhihuPublisher = {
  async publish({ type, title, content, images = [], source_url }: { type: 'idea' | 'article'; title?: string; content: string; images?: string[]; source_url?: string }) {
    const pp = await ensurePuppeteer()
    if (!pp) {
      return { success: false, error: '缺少puppeteer/puppeteer-core依赖，请安装: npm i puppeteer 或 npm i puppeteer-core' }
    }
    const cookies = await getCookies()
    if (!cookies.length) {
      return { success: false, error: '缺少知乎登录Cookie，请配置ZHIHU_COOKIES_JSON或ZHIHU_COOKIE_STRING环境变量' }
    }
    const launchOpts: any = { headless: true }
    if (pp.core) {
      const exe = detectChromePath()
      if (!exe) {
        return { success: false, error: '未检测到本机Chrome，请设置环境变量PUPPETEER_EXECUTABLE_PATH指向Chrome可执行文件' }
      }
      launchOpts.executablePath = exe
    }
    const browser = await pp.mod.launch(launchOpts)
    const page = await browser.newPage()
    try {
      await page.setCookie(...cookies as any)
      const targetUrl = type === 'idea' ? 'https://www.zhihu.com/creator' : 'https://zhuanlan.zhihu.com'
      await page.goto(targetUrl, { waitUntil: 'networkidle2' })
      if (type === 'article' && title) {
        try {
          await page.waitForTimeout(1500)
          const titleSel = 'input[placeholder="请输入标题"], input[aria-label="标题"], input[type="text"]'
          const titleHandles = await page.$$(titleSel)
          if (titleHandles.length) {
            await titleHandles[0].focus()
            await page.type(titleSel, title)
          }
        } catch {}
      }
      try {
        await page.waitForTimeout(1500)
        const editorSel = 'div[contenteditable="true"], textarea'
        const editorHandles = await page.$$(editorSel)
        if (editorHandles.length) {
          await editorHandles[0].focus()
          await page.keyboard.type(content)
        }
      } catch {}
      let uploaded = 0
      if (images.length) {
        const { files } = await downloadImages(images)
        try {
          const inputSel = 'input[type="file"]'
          const fileInputs = await page.$$(inputSel)
          if (fileInputs.length) {
            await (fileInputs[0] as any).uploadFile(...files)
            uploaded = files.length
          }
        } catch {}
      }
      if (source_url) {
        try {
          await page.keyboard.type(`\n原帖链接：${source_url}`)
        } catch {}
      }
      return { success: true, data: { uploadedImages: uploaded } }
    } catch (e: any) {
      return { success: false, error: '自动化提交失败', details: String(e?.message || e) }
    } finally {
      await browser.close()
    }
  }
}

export default zhihuPublisher