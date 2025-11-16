import express from 'express';
import { body, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { jwtUtils, passwordUtils, responseUtils } from '../utils/index.js';

const router = express.Router();

// 用户注册
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { email, password, name } = req.body;

    // 检查用户是否已存在
    const { data: existingUser } = await DatabaseService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json(responseUtils.error('User already exists', 'USER_EXISTS'));
    }

    // 加密密码
    const passwordHash = await passwordUtils.hashPassword(password);

    // 创建用户
    const { data: user, error } = await DatabaseService.createUser({
      email,
      password_hash: passwordHash,
      name,
      plan: 'free',
      usage_count: 0,
      max_daily_tasks: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create user', 'DATABASE_ERROR'));
    }

    // 生成JWT令牌
    const token = jwtUtils.generateToken({ 
      userId: user.id, 
      email: user.email,
      plan: user.plan 
    });

    // 返回用户数据（不包含密码）
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      usage_count: user.usage_count,
      max_daily_tasks: user.max_daily_tasks,
      created_at: user.created_at
    };

    res.json(responseUtils.success({
      token,
      user: userResponse
    }, 'User registered successfully'));

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(responseUtils.error('Registration failed', 'REGISTRATION_ERROR'));
  }
});

// 用户登录
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { email, password } = req.body;

    // 查找用户
    const { data: user, error } = await DatabaseService.getUserByEmail(email);
    if (error || !user) {
      return res.status(401).json(responseUtils.error('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    // 验证密码
    const isValidPassword = await passwordUtils.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json(responseUtils.error('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    // 生成JWT令牌
    const token = jwtUtils.generateToken({ 
      userId: user.id, 
      email: user.email,
      plan: user.plan 
    });

    // 返回用户数据（不包含密码）
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      usage_count: user.usage_count,
      max_daily_tasks: user.max_daily_tasks,
      created_at: user.created_at
    };

    res.json(responseUtils.success({
      token,
      user: userResponse
    }, 'Login successful'));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(responseUtils.error('Login failed', 'LOGIN_ERROR'));
  }
});

// 获取用户信息
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: user, error } = await DatabaseService.getUserById(userId);
    if (error || !user) {
      return res.status(404).json(responseUtils.error('User not found', 'USER_NOT_FOUND'));
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      usage_count: user.usage_count,
      max_daily_tasks: user.max_daily_tasks,
      created_at: user.created_at
    };

    res.json(responseUtils.success(userResponse, 'User profile retrieved'));

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json(responseUtils.error('Failed to retrieve profile', 'PROFILE_ERROR'));
  }
});

// 用户登出
router.post('/logout', authenticateToken, (req, res) => {
  // 在客户端清除token即可，服务器端不需要特殊处理
  res.json(responseUtils.success(null, 'Logout successful'));
});

// JWT认证中间件
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(responseUtils.error('No token provided', 'NO_TOKEN'));
  }

  try {
    const user = jwtUtils.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json(responseUtils.error('Invalid token', 'INVALID_TOKEN'));
  }
}

export default router;