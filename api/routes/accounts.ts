import express from 'express';
import { body, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取用户账号列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: accounts, error } = await DatabaseService.getUserAccounts(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch accounts', 'DATABASE_ERROR'));
    }

    // 转换数据格式以匹配前端期望
    const formattedAccounts = (accounts || []).map(account => ({
      id: account.id,
      platform: account.platform,
      username: account.username || account.platform_user_id,
      nickname: account.nickname || account.username || account.platform_user_id,
      status: account.is_active ? 'active' : 'inactive',
      lastLogin: account.updated_at,
      cookies: account.cookies,
      settings: account.account_info || {},
      createdAt: account.created_at,
      updatedAt: account.updated_at
    }));

    res.json(responseUtils.success(formattedAccounts, 'Accounts retrieved successfully'));

  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch accounts', 'FETCH_ERROR'));
  }
});

// 绑定新账号
router.post('/bind', authenticateToken, [
  body('platform').isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  body('access_token').exists(),
  body('platform_user_id').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { platform, access_token, refresh_token, platform_user_id, username, account_info } = req.body;

    // 检查账号是否已绑定
    const { data: existingAccount } = await DatabaseService.getAccountByPlatformId(userId, platform, platform_user_id);
    if (existingAccount) {
      return res.status(409).json(responseUtils.error('Account already bound', 'ACCOUNT_EXISTS'));
    }

    // 创建账号绑定
    const { data: account, error } = await DatabaseService.createAccount({
      user_id: userId,
      platform,
      platform_user_id,
      username,
      access_token,
      refresh_token,
      account_info: account_info || {},
      is_active: true,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to bind account', 'BIND_ERROR'));
    }

    res.json(responseUtils.success(account, 'Account bound successfully'));

  } catch (error) {
    console.error('Bind account error:', error);
    res.status(500).json(responseUtils.error('Failed to bind account', 'BIND_ERROR'));
  }
});

// 解绑账号
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.params.id;

    // 验证账号所有权
    const { data: account } = await DatabaseService.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Account not found or access denied', 'ACCESS_DENIED'));
    }

    const { error } = await DatabaseService.deleteAccount(accountId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to unbind account', 'UNBIND_ERROR'));
    }

    res.json(responseUtils.success(null, 'Account unbound successfully'));

  } catch (error) {
    console.error('Unbind account error:', error);
    res.status(500).json(responseUtils.error('Failed to unbind account', 'UNBIND_ERROR'));
  }
});

// 创建账号 (兼容前端格式)
router.post('/', authenticateToken, [
  body('platform').isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  body('username').exists(),
  body('nickname').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const userId = req.user.userId;
    const { platform, username, nickname, cookies, status = 'active', settings = {} } = req.body;

    // 创建账号
    const { data: account, error } = await DatabaseService.createAccount({
      user_id: userId,
      platform,
      platform_user_id: username,
      username,
      nickname,
      access_token: cookies || '',
      refresh_token: '',
      account_info: settings,
      is_active: status === 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create account', 'CREATE_ERROR'));
    }

    // 转换数据格式
    const formattedAccount = {
      id: account.id,
      platform: account.platform,
      username: account.username || account.platform_user_id,
      nickname: account.nickname || account.username || account.platform_user_id,
      status: account.is_active ? 'active' : 'inactive',
      lastLogin: account.updated_at,
      cookies: account.cookies,
      settings: account.account_info || {},
      createdAt: account.created_at,
      updatedAt: account.updated_at
    };

    res.json(responseUtils.success(formattedAccount, 'Account created successfully'));

  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json(responseUtils.error('Failed to create account', 'CREATE_ERROR'));
  }
});

// 更新账号
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.params.id;
    const { platform, username, nickname, cookies, status, settings } = req.body;

    // 验证账号所有权
    const { data: existingAccount } = await DatabaseService.getAccountById(accountId);
    if (!existingAccount || existingAccount.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Account not found or access denied', 'ACCESS_DENIED'));
    }

    // 更新账号
    const updateData: any = {};
    if (platform) updateData.platform = platform;
    if (username) updateData.platform_user_id = username;
    if (nickname) updateData.nickname = nickname;
    if (cookies) updateData.access_token = cookies;
    if (status !== undefined) updateData.is_active = status === 'active';
    if (settings) updateData.account_info = settings;
    updateData.updated_at = new Date().toISOString();

    const { data: account, error } = await DatabaseService.updateAccount(accountId, updateData);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to update account', 'UPDATE_ERROR'));
    }

    // 转换数据格式
    const formattedAccount = {
      id: account.id,
      platform: account.platform,
      username: account.username || account.platform_user_id,
      nickname: account.nickname || account.username || account.platform_user_id,
      status: account.is_active ? 'active' : 'inactive',
      lastLogin: account.updated_at,
      cookies: account.cookies,
      settings: account.account_info || {},
      createdAt: account.created_at,
      updatedAt: account.updated_at
    };

    res.json(responseUtils.success(formattedAccount, 'Account updated successfully'));

  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json(responseUtils.error('Failed to update account', 'UPDATE_ERROR'));
  }
});

// 刷新账号信息
router.post('/:id/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.params.id;

    // 验证账号所有权
    const { data: account } = await DatabaseService.getAccountById(accountId);
    if (!account || account.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Account not found or access denied', 'ACCESS_DENIED'));
    }

    // 这里应该调用相应平台的API来刷新账号信息
    // 暂时返回模拟数据
    const updatedAccount = {
      ...account,
      account_info: {
        ...account.account_info,
        followers: Math.floor(Math.random() * 10000) + 1000,
        following: Math.floor(Math.random() * 1000) + 100,
        posts: Math.floor(Math.random() * 500) + 50
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await DatabaseService.updateAccount(accountId, updatedAccount);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to refresh account', 'REFRESH_ERROR'));
    }

    res.json(responseUtils.success(updatedAccount, 'Account refreshed successfully'));

  } catch (error) {
    console.error('Refresh account error:', error);
    res.status(500).json(responseUtils.error('Failed to refresh account', 'REFRESH_ERROR'));
  }
});



export default router;