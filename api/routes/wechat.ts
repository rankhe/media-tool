import express from 'express'
import { query, validationResult } from 'express-validator'
import { responseUtils } from '../utils/index.js'
import { authenticateToken } from './auth.js'
import DajialaCrawlerService from '../services/external/dajialaCrawler.js'

const router = express.Router()
const crawler = new DajialaCrawlerService()

router.get('/explodes', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20 } = req.query
    const items = await crawler.getLatestExplodes(Number(limit))
    return res.json(responseUtils.success({ items, total: items.length }, 'Explodes retrieved'))
  } catch (e) {
    console.error('Explodes error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch explodes', 'FETCH_FAILED'))
  }
})

router.get('/quality-accounts', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20 } = req.query
    const items = await crawler.getLatestQualityAccounts(Number(limit))
    return res.json(responseUtils.success({ items, total: items.length }, 'Quality accounts retrieved'))
  } catch (e) {
    console.error('Quality accounts error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch quality accounts', 'FETCH_FAILED'))
  }
})

router.get('/hot-articles', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'))
    }
    const { limit = 20 } = req.query
    const items = await crawler.getLatestHotArticles(Number(limit))
    return res.json(responseUtils.success({ items, total: items.length }, 'Hot articles retrieved'))
  } catch (e) {
    console.error('Hot articles error:', e)
    return res.status(500).json(responseUtils.error('Failed to fetch hot articles', 'FETCH_FAILED'))
  }
})

router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const explodes = await crawler.getLatestExplodes(20)
    const accounts = await crawler.getLatestQualityAccounts(20)
    const hot = await crawler.getLatestHotArticles(20)
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

export default router