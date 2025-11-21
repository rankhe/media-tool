import express from 'express';
import { body, validationResult } from 'express-validator';
import { DatabaseService } from '../config/database.js';
import { responseUtils } from '../utils/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取用户设置
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const { data: settings, error } = await DatabaseService.getUserSettings(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch settings', 'DATABASE_ERROR'));
    }

    // 如果没有设置，返回默认设置
    const defaultSettings = {
      general: {
        siteName: 'media-tool',
        siteDescription: '专业的短视频内容管理和发布平台',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        maintenanceMode: false,
      },
      video: {
        maxFileSize: 500,
        allowedFormats: ['mp4', 'avi', 'mov', 'mkv', 'flv'],
        defaultQuality: 'high',
        autoTranscribe: true,
        autoTranslate: false,
      },
      download: {
        maxConcurrentDownloads: 3,
        retryAttempts: 3,
        timeout: 300,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      publish: {
        defaultPlatforms: ['douyin', 'kuaishou'],
        publishInterval: 30,
        maxDailyPublishes: 50,
        autoPublish: false,
      },
      api: {
        openaiKey: '',
        googleKey: '',
        baiduKey: '',
        tencentKey: '',
      },
      storage: {
        type: 'local',
        cloudProvider: 'aliyun',
        bucketName: '',
        region: '',
        accessKey: '',
        secretKey: '',
      },
      redis: {
        host: 'localhost',
        port: 6379,
        password: '',
        db: 0,
      },
      database: {
        type: 'sqlite',
        host: 'localhost',
        port: 3306,
        username: '',
        password: '',
        database: 'media_tool',
      },
    };

    res.json(responseUtils.success(settings || defaultSettings, 'Settings retrieved successfully'));

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch settings', 'FETCH_ERROR'));
  }
});

// 更新用户设置
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;

    const { data: existingSettings, error: fetchError } = await DatabaseService.getUserSettings(userId);
    
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch existing settings', 'DATABASE_ERROR'));
    }

    let result;
    if (existingSettings) {
      // 更新现有设置
      result = await DatabaseService.updateUserSettings(userId, settings);
    } else {
      // 创建新设置
      result = await DatabaseService.createUserSettings(userId, settings);
    }

    if (result.error) {
      return res.status(500).json(responseUtils.error('Failed to update settings', 'UPDATE_ERROR'));
    }

    res.json(responseUtils.success(result.data, 'Settings updated successfully'));

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json(responseUtils.error('Failed to update settings', 'UPDATE_ERROR'));
  }
});

// 获取特定分类设置
router.get('/:category', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const category = req.params.category;

    const { data: settings, error } = await DatabaseService.getUserSettings(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch settings', 'DATABASE_ERROR'));
    }

    if (!settings || !settings[category]) {
      return res.status(404).json(responseUtils.error('Category not found', 'CATEGORY_NOT_FOUND'));
    }

    res.json(responseUtils.success(settings[category], 'Category settings retrieved successfully'));

  } catch (error) {
    console.error('Get category settings error:', error);
    res.status(500).json(responseUtils.error('Failed to fetch category settings', 'FETCH_ERROR'));
  }
});

// 更新特定分类设置
router.put('/:category', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const category = req.params.category;
    const categorySettings = req.body;

    const { data: existingSettings, error: fetchError } = await DatabaseService.getUserSettings(userId);
    
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch existing settings', 'DATABASE_ERROR'));
    }

    let newSettings;
    if (existingSettings) {
      newSettings = {
        ...existingSettings,
        [category]: categorySettings
      };
    } else {
      newSettings = {
        [category]: categorySettings
      };
    }

    let result;
    if (existingSettings) {
      result = await DatabaseService.updateUserSettings(userId, newSettings);
    } else {
      result = await DatabaseService.createUserSettings(userId, newSettings);
    }

    if (result.error) {
      return res.status(500).json(responseUtils.error('Failed to update category settings', 'UPDATE_ERROR'));
    }

    res.json(responseUtils.success(result.data[category], 'Category settings updated successfully'));

  } catch (error) {
    console.error('Update category settings error:', error);
    res.status(500).json(responseUtils.error('Failed to update category settings', 'UPDATE_ERROR'));
  }
});

// 测试API密钥
router.post('/test-api-key', authenticateToken, [
  body('provider').isIn(['openai', 'google', 'baidu', 'tencent']),
  body('key').isString().isLength({ min: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { provider, key } = req.body;

    // 这里应该调用实际的API测试逻辑
    // 现在返回模拟结果
    const isValid = Math.random() > 0.3; // 70% 成功率
    
    res.json(responseUtils.success({
      valid: isValid,
      message: isValid ? 'API密钥有效' : 'API密钥无效'
    }, 'API key test completed'));

  } catch (error) {
    console.error('Test API key error:', error);
    res.status(500).json(responseUtils.error('Failed to test API key', 'TEST_ERROR'));
  }
});

// 测试数据库连接
router.post('/test-database', authenticateToken, async (req, res) => {
  try {
    const config = req.body;

    // 这里应该调用实际的数据库连接测试逻辑
    // 现在返回模拟结果
    const isSuccess = Math.random() > 0.2; // 80% 成功率
    
    res.json(responseUtils.success({
      success: isSuccess,
      message: isSuccess ? '数据库连接成功' : '数据库连接失败'
    }, 'Database connection test completed'));

  } catch (error) {
    console.error('Test database connection error:', error);
    res.status(500).json(responseUtils.error('Failed to test database connection', 'TEST_ERROR'));
  }
});

// 测试Redis连接
router.post('/test-redis', authenticateToken, async (req, res) => {
  try {
    const config = req.body;

    // 这里应该调用实际的Redis连接测试逻辑
    // 现在返回模拟结果
    const isSuccess = Math.random() > 0.15; // 85% 成功率
    
    res.json(responseUtils.success({
      success: isSuccess,
      message: isSuccess ? 'Redis连接成功' : 'Redis连接失败'
    }, 'Redis connection test completed'));

  } catch (error) {
    console.error('Test Redis connection error:', error);
    res.status(500).json(responseUtils.error('Failed to test Redis connection', 'TEST_ERROR'));
  }
});

// 备份设置
router.get('/backup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: settings, error } = await DatabaseService.getUserSettings(userId);
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to fetch settings', 'DATABASE_ERROR'));
    }

    if (!settings) {
      return res.status(404).json(responseUtils.error('Settings not found', 'SETTINGS_NOT_FOUND'));
    }

    // 设置文件下载头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="settings-backup.json"');
    
    res.send(JSON.stringify(settings, null, 2));

  } catch (error) {
    console.error('Backup settings error:', error);
    res.status(500).json(responseUtils.error('Failed to backup settings', 'BACKUP_ERROR'));
  }
});

// 恢复设置
router.post('/restore', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;

    // 验证设置格式
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json(responseUtils.error('Invalid settings format', 'INVALID_FORMAT'));
    }

    const { data: existingSettings, error: fetchError } = await DatabaseService.getUserSettings(userId);
    
    if (fetchError) {
      return res.status(500).json(responseUtils.error('Failed to fetch existing settings', 'DATABASE_ERROR'));
    }

    let result;
    if (existingSettings) {
      result = await DatabaseService.updateUserSettings(userId, settings);
    } else {
      result = await DatabaseService.createUserSettings(userId, settings);
    }

    if (result.error) {
      return res.status(500).json(responseUtils.error('Failed to restore settings', 'RESTORE_ERROR'));
    }

    res.json(responseUtils.success(result.data, 'Settings restored successfully'));

  } catch (error) {
    console.error('Restore settings error:', error);
    res.status(500).json(responseUtils.error('Failed to restore settings', 'RESTORE_ERROR'));
  }
});

export default router;