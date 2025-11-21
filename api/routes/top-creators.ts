import express from 'express'
import { Pool } from 'pg'
import { logger } from '../utils/logger'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'media_tool',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
})

router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id
  const { platform, category, limit = 20, page = 1 } = req.query as any
  try {
    const params: any[] = [userId]
    let sql = `SELECT * FROM top_creators WHERE user_id = $1`
    if (platform) {
      sql += ` AND platform = $${params.length + 1}`
      params.push(platform)
    }
    if (category) {
      sql += ` AND category = $${params.length + 1}`
      params.push(category)
    }
    sql += ` ORDER BY score DESC, follower_count DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(Number(limit))
    params.push((Number(page) - 1) * Number(limit))
    const result = await pool.query(sql, params)
    return res.json({ success: true, data: result.rows })
  } catch (e) {
    logger.error('Error fetching top creators:', e)
    return res.status(500).json({ success: false, error: 'Failed to get top creators' })
  }
})

router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id
  const { platform, creator_user_id, creator_username, creator_display_name, avatar_url, follower_count, verified, bio, category, score } = req.body || {}
  if (!platform || !creator_user_id) {
    return res.status(400).json({ success: false, error: 'platform and creator_user_id are required' })
  }
  try {
    const sql = `
      INSERT INTO top_creators (user_id, platform, creator_user_id, creator_username, creator_display_name, avatar_url, follower_count, verified, bio, category, score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (user_id, platform, creator_user_id) DO UPDATE SET 
        creator_username = EXCLUDED.creator_username,
        creator_display_name = EXCLUDED.creator_display_name,
        avatar_url = EXCLUDED.avatar_url,
        follower_count = EXCLUDED.follower_count,
        verified = EXCLUDED.verified,
        bio = EXCLUDED.bio,
        category = EXCLUDED.category,
        score = EXCLUDED.score,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    const params = [userId, platform, String(creator_user_id), creator_username || null, creator_display_name || creator_username || null, avatar_url || null, follower_count || 0, !!verified, bio || null, category || null, score || 0]
    const result = await pool.query(sql, params)
    return res.json({ success: true, data: result.rows[0] })
  } catch (e: any) {
    logger.error('Error adding top creator:', e)
    return res.status(500).json({ success: false, error: 'Failed to add top creator', details: e?.message })
  }
})

router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id
  const id = req.params.id
  try {
    await pool.query(`DELETE FROM top_creators WHERE id = $1 AND user_id = $2`, [id, userId])
    return res.json({ success: true })
  } catch (e) {
    logger.error('Error deleting top creator:', e)
    return res.status(500).json({ success: false, error: 'Failed to delete top creator' })
  }
})

export default router