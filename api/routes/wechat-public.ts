import express from 'express'
import { query, validationResult } from 'express-validator'
import { responseUtils } from '../utils/index.js'
import DajialaCrawlerService from '../services/external/dajialaCrawler.js'

const router = express.Router()
const crawler = new DajialaCrawlerService()

async function withTimeout<T>(p: Promise<T>, ms = 10000, fallback: T): Promise<T> {
  const safeP = p.catch(() => fallback)
  return await Promise.race([
    safeP,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

router.get('/explodes', [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20, nocache } = req.query as any
    const items = await withTimeout(crawler.getLatestExplodes(Number(limit), { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }), 12000, [])
    res.set('Cache-Control', 'no-store')
    return res.json(responseUtils.success({ items, total: items.length }, 'Explodes retrieved'))
  } catch (e) {
    console.error('Explodes error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch explodes', 'FETCH_FAILED'))
  }
})

router.get('/quality-accounts', [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20, nocache } = req.query as any
    const items = await withTimeout(crawler.getLatestQualityAccounts(Number(limit), { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }), 12000, [])
    res.set('Cache-Control', 'no-store')
    return res.json(responseUtils.success({ items, total: items.length }, 'Quality accounts retrieved'))
  } catch (e) {
    console.error('Quality accounts error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch quality accounts', 'FETCH_FAILED'))
  }
})

router.get('/hot-articles', [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20, nocache } = req.query as any
    const items = await withTimeout(crawler.getLatestHotArticles(Number(limit), { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }), 12000, [])
    res.set('Cache-Control', 'no-store')
    return res.json(responseUtils.success({ items, total: items.length }, 'Hot articles retrieved'))
  } catch (e) {
    console.error('Hot articles error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch hot articles', 'FETCH_FAILED'))
  }
})

router.get('/overview', async (req, res) => {
  try {
    const nocache = ['1','true'].includes(String((req.query as any).nocache || '').toLowerCase())
    const [explodes, accounts, hot] = await Promise.all([
      withTimeout(crawler.getLatestExplodes(20, { nocache }), 12000, []),
      withTimeout(crawler.getLatestQualityAccounts(20, { nocache }), 12000, []),
      withTimeout(crawler.getLatestHotArticles(20, { nocache }), 12000, [])
    ])
    res.set('Cache-Control', 'no-store')
    return res.json(responseUtils.success({
      explodes,
      quality_accounts: accounts,
      hot_articles: hot
    }, 'Overview retrieved'))
  } catch (e) {
    console.error('Overview error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch overview', 'FETCH_FAILED'))
  }
})

router.delete('/cache', async (req, res) => {
  try {
    await crawler.clearCache()
    res.set('Cache-Control', 'no-store')
    return res.json(responseUtils.success({ cleared: true }, 'Cache cleared'))
  } catch (e) {
    return res.status(500).json(responseUtils.error('Failed to clear cache', 'CACHE_CLEAR_FAILED'))
  }
})

export default router