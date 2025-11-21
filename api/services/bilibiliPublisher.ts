import fs from 'fs'
import path from 'path'
import { redisClient } from '../config/redis.js'

async function getCookies() {
  try {
    if (redisClient) {
      const jsonStr = await redisClient.get('bilibili:cookies_json')
      if (jsonStr) {
        const arr = JSON.parse(jsonStr)
        if (Array.isArray(arr)) return arr
      }
      const cookieStr = await redisClient.get('bilibili:cookie_string')
      if (cookieStr) {
        return cookieStr.split(';').map(s => {
          const [name, ...rest] = s.trim().split('=')
          return { name, value: rest.join('='), domain: '.bilibili.com', path: '/' }
        })
      }
    }
  } catch {}
  const filePath = process.env.BILIBILI_COOKIES_JSON
  const cookieStr = process.env.BILIBILI_COOKIE_STRING
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
      return { name, value: rest.join('='), domain: '.bilibili.com', path: '/' }
    })
  }
  return []
}

async function ensurePuppeteer() {
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

export const bilibiliPublisher = {
  async publish({ videoPath, title, description, tags }: { videoPath: string; title: string; description?: string; tags?: string[] }) {
    const pp = await ensurePuppeteer()
    if (!pp) return { success: false, error: '缺少puppeteer依赖' }
    const cookies = await getCookies()
    if (!cookies.length) return { success: false, error: '缺少B站登录Cookie' }
    const launchOpts: any = { headless: true }
    if (pp.core) {
      const exe = detectChromePath()
      if (!exe) return { success: false, error: '未检测到Chrome' }
      launchOpts.executablePath = exe
    }
    const browser = await pp.mod.launch(launchOpts as any)
    const page = await browser.newPage()
    try {
      await page.setCookie(...cookies as any)
      await page.goto('https://member.bilibili.com/platform/upload/video/frame', { waitUntil: 'networkidle2' })
      await page.waitForTimeout(2000)
      const fileInputs = await page.$$('input[type="file"]')
      if (!fileInputs.length) throw new Error('未找到文件上传控件')
      await (fileInputs[0] as any).uploadFile(path.resolve(videoPath))
      await page.waitForTimeout(2000)
      const titleSel = 'input[type="text"], input[placeholder]'
      const titleInputs = await page.$$(titleSel)
      if (titleInputs.length) {
        await titleInputs[0].click({ clickCount: 3 })
        await titleInputs[0].type(title)
      }
      const descSel = 'textarea, div[contenteditable="true"]'
      const descInputs = await page.$$(descSel)
      if (descInputs.length && description) {
        await descInputs[0].type(description)
      }
      const publishButtons = await page.$$('button, div[role="button"]')
      if (publishButtons.length) {
        await publishButtons[publishButtons.length - 1].click()
      }
      return { success: true, data: { platform: 'bilibili' } }
    } catch (e: any) {
      return { success: false, error: '自动化上传失败', details: String(e?.message || e) }
    } finally {
      await browser.close()
    }
  }
}

export default bilibiliPublisher