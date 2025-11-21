import express from 'express';
import { query, validationResult } from 'express-validator';
import multer from 'multer';
import { responseUtils } from '../utils/index.js';
import { authenticateToken } from './auth.js';
import { DatabaseService } from '../config/database.js';
import { VideoDownloadService } from '../services/videoDownload.js';
import { videoProcessingService } from '../services/videoProcessing.js';
import { PlatformManager } from '../services/platformManager.js';
import path from 'path';
import fs from 'fs/promises';

// 辅助函数：生成随机视频标题
function getRandomVideoTitle(category: string, platform: string) {
  const titles = {
    entertainment: [
      '爆笑日常', '搞笑瞬间', '娱乐八卦', '明星资讯', '综艺片段',
      '趣味挑战', '幽默短剧', '喜剧表演', '欢乐时光', '娱乐精选'
    ],
    education: [
      '知识科普', '学习技巧', '教育分享', '知识干货', '学习方法',
      '专业讲解', '知识分享', '教育资讯', '学习资源', '知识宝库'
    ],
    lifestyle: [
      '生活日常', '生活技巧', '生活分享', '生活记录', '生活美学',
      '品质生活', '生活智慧', '生活感悟', '生活点滴', '生活精选'
    ],
    food: [
      '美食制作', '美食分享', '烹饪技巧', '美食探店', '美食教程',
      '美味佳肴', '美食推荐', '厨艺展示', '美食文化', '美食精选'
    ],
    travel: [
      '旅行记录', '旅游攻略', '风景欣赏', '旅行分享', '旅游推荐',
      '美景分享', '旅行体验', '旅游日记', '风景如画', '旅行精选'
    ],
    technology: [
      '科技资讯', '产品评测', '技术分享', '数码产品', '科技前沿',
      '智能设备', '科技生活', '数码评测', '技术创新', '科技精选'
    ],
    fashion: [
      '时尚穿搭', '美妆教程', '时尚资讯', '穿搭分享', '美妆分享',
      '时尚生活', '潮流趋势', '美妆技巧', '时尚美学', '时尚精选'
    ]
  };
  
  const categoryTitles = titles[category as keyof typeof titles] || titles.entertainment;
  return categoryTitles[Math.floor(Math.random() * categoryTitles.length)];
}

// 辅助函数：生成随机视频描述
function getRandomVideoDescription(category: string, platform: string) {
  const descriptions = {
    entertainment: [
      '这个视频太有趣了，看完你一定会笑出声！',
      '最新娱乐资讯，第一时间分享给大家',
      '爆笑内容，不容错过！',
      '娱乐精选，每天更新精彩内容'
    ],
    education: [
      '知识改变命运，学习成就未来',
      '干货分享，让你快速掌握知识点',
      '教育资讯，助力学习成长',
      '知识科普，让学习更有趣'
    ],
    lifestyle: [
      '分享生活小技巧，让生活更美好',
      '记录美好生活瞬间',
      '生活智慧，品质生活指南',
      '生活美学，发现生活中的美'
    ],
    food: [
      '美食制作教程，手把手教你做美食',
      '探店分享，发现城市美味',
      '厨艺展示，家常美食制作',
      '美食文化，品味生活'
    ],
    travel: [
      '旅行攻略分享，带你游遍世界',
      '风景欣赏，感受自然之美',
      '旅游日记，记录美好旅程',
      '美景推荐，发现旅行目的地'
    ],
    technology: [
      '科技前沿资讯，了解最新技术',
      '产品评测，帮你选择科技好物',
      '技术分享，让科技更简单',
      '数码产品，科技生活指南'
    ],
    fashion: [
      '时尚穿搭分享，提升个人品味',
      '美妆教程，让你更美',
      '潮流趋势，掌握时尚脉搏',
      '时尚生活，美丽每一天'
    ]
  };
  
  const categoryDescriptions = descriptions[category as keyof typeof descriptions] || descriptions.entertainment;
  return categoryDescriptions[Math.floor(Math.random() * categoryDescriptions.length)];
}

// 辅助函数：生成随机标签
function getRandomTags(category: string) {
  const tags = {
    entertainment: ['搞笑', '娱乐', '爆笑', '有趣', '欢乐'],
    education: ['知识', '学习', '教育', '科普', '干货'],
    lifestyle: ['生活', '日常', '分享', '记录', '美好'],
    food: ['美食', '烹饪', '美味', '食谱', '料理'],
    travel: ['旅行', '旅游', '风景', '攻略', '美景'],
    technology: ['科技', '数码', '智能', '技术', '产品'],
    fashion: ['时尚', '穿搭', '美妆', '潮流', '美丽']
  };
  
  const categoryTags = tags[category as keyof typeof tags] || tags.entertainment;
  const shuffled = categoryTags.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * 3) + 2);
}

const router = express.Router();

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|flv|mkv|wmv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传视频文件 (mp4, mov, avi, flv, mkv, wmv)'));
    }
  }
});

// 发现热门视频
router.get('/discover', authenticateToken, [
  query('platform').isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  query('category').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { platform, category, limit = 20, page = 1, nocache } = req.query as any;

    const platformManager = PlatformManager.getInstance();
    const targetPlatforms = [platform as string];
    const realVideos = await platformManager.getTrendingFromAll(
      targetPlatforms,
      category as string,
      Number(limit),
      { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }
    );
    return res.json(responseUtils.success({
      videos: realVideos,
      pagination: {
        total: realVideos.length,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil((realVideos.length || 0) / Number(limit))
      }
    }, 'Videos discovered successfully'));

  } catch (error) {
    console.error('Discover videos error:', error);
    res.status(500).json(responseUtils.error('Failed to discover videos', 'DISCOVER_ERROR'));
  }
});

// 搜索视频
router.get('/search', authenticateToken, [
  query('q').optional().isString().isLength({ min: 0, max: 100 }),
  query('platform').optional().isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { q, platform, limit = 20, nocache } = req.query as any;

    const platformManager = PlatformManager.getInstance();
    const targetPlatforms = platform ? [platform as string] : ['bilibili'];

    if (platform && !platformManager.getCrawler(platform as string)) {
      return res.status(400).json(responseUtils.error('Platform not supported', 'PLATFORM_NOT_SUPPORTED'));
    }
    
    // 当q为空时，返回趋势数据作为搜索结果
    if (!q || (q as string).trim() === '') {
      const trending = await platformManager.getTrendingFromAll(
        targetPlatforms,
        undefined,
        Number(limit),
        { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }
      );
      return res.json(responseUtils.success({
        videos: trending,
        query: '',
        total: trending.length
      }, 'Videos searched successfully'));
    }

    const realVideos = await platformManager.searchFromAll(
      q as string,
      targetPlatforms,
      Number(limit),
      { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }
    );
    return res.json(responseUtils.success({
      videos: realVideos,
      query: q,
      total: realVideos.length
    }, 'Videos searched successfully'));

  } catch (error) {
    console.error('Search videos error:', error);
    res.status(500).json(responseUtils.error('Failed to search videos', 'SEARCH_ERROR'));
  }
});

// 获取视频详情
router.get('/:platform/:id', authenticateToken, async (req, res) => {
  try {
    const { platform, id } = req.params;

    // 模拟视频详情
    const mockVideo = {
      id,
      platform,
      title: `视频标题 - ${id}`,
      description: `这是一个很棒的${platform}视频内容，包含了丰富的信息和娱乐元素。`,
      author: '热门创作者',
      author_id: 'author_123',
      author_avatar: 'https://via.placeholder.com/64x64?text=Avatar',
      thumbnail_url: `https://via.placeholder.com/640x360?text=Video+Detail`,
      video_url: `https://example.com/video_${id}.mp4`,
      duration: 180,
      views: 125000,
      likes: 8500,
      comments: 423,
      shares: 156,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['热门', '推荐', '精选', platform],
      category: 'entertainment',
      is_downloadable: true,
      download_url: `https://example.com/download_${id}.mp4`
    };

    res.json(responseUtils.success(mockVideo, 'Video details retrieved successfully'));

  } catch (error) {
    console.error('Get video details error:', error);
    res.status(500).json(responseUtils.error('Failed to get video details', 'DETAILS_ERROR'));
  }
});

// 获取趋势视频
router.get('/trending', authenticateToken, [
  query('platform').optional().isIn(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat']),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { platform, limit = 20, nocache } = req.query as any;

    const platformManager = PlatformManager.getInstance();
    const targetPlatforms = platform ? [platform as string] : ['bilibili'];

    if (platform && !platformManager.getCrawler(platform as string)) {
      return res.status(400).json(responseUtils.error('Platform not supported', 'PLATFORM_NOT_SUPPORTED'));
    }
    const realVideos = await platformManager.getTrendingFromAll(
      targetPlatforms,
      undefined,
      Number(limit),
      { nocache: ['1','true'].includes(String(nocache).toLowerCase()) }
    );
    return res.json(responseUtils.success({
      videos: realVideos,
      platform: platform || 'bilibili',
      total: realVideos.length
    }, 'Trending videos retrieved successfully'));

  } catch (error) {
    console.error('Get trending videos error:', error);
    res.status(500).json(responseUtils.error('Failed to get trending videos', 'TRENDING_ERROR'));
  }
});

// 下载视频
router.post('/download', authenticateToken, async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    const userId = req.user.userId;

    if (!url) {
      return res.status(400).json(responseUtils.error('Video URL is required', 'MISSING_URL'));
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return res.status(400).json(responseUtils.error('Invalid video URL', 'INVALID_URL'));
    }

    // 创建下载任务
    const taskData = {
      task_type: 'download',
      status: 'pending',
      user_id: userId,
      source_config: {
        url,
        platform: options.platform || 'unknown',
        quality: options.quality || 'best',
        format: options.format || 'mp4'
      },
      target_config: {
        output_path: `./downloads/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`,
        metadata: options.metadata || {}
      },
      processing_config: {
        extract_audio: options.extractAudio || false,
        thumbnail: options.thumbnail || true
      },
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 创建任务记录
    const { data: task, error } = await DatabaseService.createTask(taskData);
    
    if (error) {
      return res.status(500).json(responseUtils.error('Failed to create download task', 'TASK_CREATE_ERROR'));
    }

    // 立即开始下载（异步）
    setImmediate(async () => {
      try {
        await VideoDownloadService.getInstance().downloadVideo({
          url: url,
          outputPath: taskData.target_config.output_path,
          quality: taskData.source_config.quality,
          format: taskData.source_config.format,
          extractAudio: taskData.processing_config.extract_audio
        }, (progress) => {
          // 更新任务进度
          DatabaseService.updateTaskStatus(task.id, 'running', progress.percent / 100, progress.status);
        });
      } catch (error) {
        console.error('Download error:', error);
        await DatabaseService.updateTaskStatus(task.id, 'failed', 0, error.message);
      }
    });

    res.json(responseUtils.success({
      task_id: task.id,
      status: 'pending',
      message: 'Download task created successfully'
    }, 'Download task created'));

  } catch (error) {
    console.error('Download video error:', error);
    res.status(500).json(responseUtils.error('Failed to create download task', 'DOWNLOAD_ERROR'));
  }
});

// 处理视频
router.post('/:id/process', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const processingConfig = req.body;

    // 获取视频信息
    const { data: video, error: videoError } = await DatabaseService.getVideoById(id);
    
    if (videoError || !video) {
      return res.status(404).json(responseUtils.error('Video not found', 'VIDEO_NOT_FOUND'));
    }

    // 验证视频所有权
    const { data: task } = await DatabaseService.getTaskById(video.task_id);
    if (task.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 'FORBIDDEN'));
    }

    // 创建处理任务
    const taskData = {
      task_type: 'process',
      status: 'pending',
      user_id: userId,
      source_config: {
        video_id: id,
        video_path: video.local_path || video.video_url,
        original_platform: video.platform
      },
      target_config: {
        output_path: `./processed/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`,
        preserve_original: processingConfig.preserveOriginal || true
      },
      processing_config: {
        trim: processingConfig.trim || null,
        crop: processingConfig.crop || null,
        watermark: processingConfig.watermark || null,
        filters: processingConfig.filters || [],
        audio: processingConfig.audio || {},
        subtitles: processingConfig.subtitles || null,
        speed: processingConfig.speed || 1.0,
        format: processingConfig.format || 'mp4',
        quality: processingConfig.quality || 'high'
      },
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 创建任务记录
    const { data: processTask, error: taskError } = await DatabaseService.createTask(taskData);
    
    if (taskError) {
      return res.status(500).json(responseUtils.error('Failed to create processing task', 'TASK_CREATE_ERROR'));
    }

    // 立即开始处理（异步）
    setImmediate(async () => {
      try {
        await videoProcessingService.processVideo({
          inputPath: taskData.source_config.video_path,
          outputPath: taskData.target_config.output_path,
          processingType: 'all',
          ...taskData.processing_config
        }, (progress) => {
          // 更新任务进度
          DatabaseService.updateTaskStatus(processTask.id, 'running', progress.percent / 100, progress.currentStep);
        });
      } catch (error) {
        console.error('Processing error:', error);
        await DatabaseService.updateTaskStatus(processTask.id, 'failed', 0, error.message);
      }
    });

    res.json(responseUtils.success({
      task_id: processTask.id,
      status: 'pending',
      message: 'Video processing task created successfully'
    }, 'Processing task created'));

  } catch (error) {
    console.error('Process video error:', error);
    res.status(500).json(responseUtils.error('Failed to create processing task', 'PROCESSING_ERROR'));
  }
});

// 上传视频
router.post('/upload', authenticateToken, upload.single('video'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, tags } = req.body;

    if (!req.file) {
      return res.status(400).json(responseUtils.error('No video file uploaded', 'NO_FILE'));
    }

    const uploadedFile = req.file;
    const fileName = `${Date.now()}_${uploadedFile.originalname}`;
    const uploadPath = path.join(process.env.LOCAL_STORAGE_PATH || './uploads', fileName);

    // 确保上传目录存在
    const uploadDir = path.dirname(uploadPath);
    await fs.mkdir(uploadDir, { recursive: true });

    // 保存文件到本地存储
    await fs.writeFile(uploadPath, uploadedFile.buffer);

    // 获取视频信息（这里简化处理，实际需要调用ffprobe等工具）
    const videoInfo = {
      duration: 0, // 需要实际解析
      width: 1920,
      height: 1080,
      format: 'mp4',
      size: uploadedFile.size
    };

    // 创建上传任务
    const taskData = {
      task_type: 'upload',
      status: 'completed', // 上传任务立即完成
      user_id: userId,
      source_config: {
        type: 'upload',
        original_name: uploadedFile.originalname,
        mime_type: uploadedFile.mimetype,
        size: uploadedFile.size
      },
      target_config: {
        file_path: uploadPath,
        file_name: fileName
      },
      processing_config: {
        title: title || '上传的视频',
        description: description || '',
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : []
      },
      progress: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };

    // 创建任务记录
    const { data: task, error: taskError } = await DatabaseService.createTask(taskData);
    
    if (taskError) {
      // 清理上传的文件
      await fs.unlink(uploadPath).catch(() => {});
      return res.status(500).json(responseUtils.error('Failed to create upload task', 'TASK_CREATE_ERROR'));
    }

    // 创建视频记录
    const videoData = {
      task_id: task.id,
      platform: 'upload',
      platform_video_id: `upload_${task.id}`,
      title: taskData.processing_config.title,
      description: taskData.processing_config.description,
      thumbnail_url: '', // 需要生成缩略图
      video_url: uploadPath,
      local_path: uploadPath,
      duration: videoInfo.duration,
      file_size: uploadedFile.size,
      views: 0,
      likes: 0,
      comments: 0,
      metadata: {
        original_name: uploadedFile.originalname,
        mime_type: uploadedFile.mimetype,
        dimensions: {
          width: videoInfo.width,
          height: videoInfo.height
        },
        format: videoInfo.format,
        tags: taskData.processing_config.tags
      }
    };

    const { data: video, error: videoError } = await DatabaseService.createVideo(videoData);
    
    if (videoError) {
      // 清理上传的文件
      await fs.unlink(uploadPath).catch(() => {});
      return res.status(500).json(responseUtils.error('Failed to create video record', 'VIDEO_CREATE_ERROR'));
    }

    res.json(responseUtils.success({
      task_id: task.id,
      video_id: video.id,
      file_path: uploadPath,
      file_name: fileName,
      size: uploadedFile.size,
      message: 'Video uploaded successfully'
    }, 'Video uploaded'));

  } catch (error) {
    console.error('Upload video error:', error);
    
    // 清理上传的文件（如果存在）
    if (req.file) {
      const fileName = `${Date.now()}_${req.file.originalname}`;
      const uploadPath = path.join(process.env.LOCAL_STORAGE_PATH || './uploads', fileName);
      await fs.unlink(uploadPath).catch(() => {});
    }
    
    res.status(500).json(responseUtils.error('Failed to upload video', 'UPLOAD_ERROR'));
  }
});

// 获取视频播放地址
router.get('/:id/url', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 获取视频信息
    const { data: video, error } = await DatabaseService.getVideoById(id);
    
    if (error || !video) {
      return res.status(404).json(responseUtils.error('Video not found', 'VIDEO_NOT_FOUND'));
    }

    // 验证视频所有权
    const { data: task } = await DatabaseService.getTaskById(video.task_id);
    if (task.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 'FORBIDDEN'));
    }

    // 检查文件是否存在
    if (!video.local_path) {
      return res.status(404).json(responseUtils.error('Video file not found', 'FILE_NOT_FOUND'));
    }

    try {
      await fs.access(video.local_path);
    } catch {
      return res.status(404).json(responseUtils.error('Video file not accessible', 'FILE_NOT_ACCESSIBLE'));
    }

    // 生成临时访问URL（这里简化处理，实际需要更安全的签名机制）
    const videoUrl = `/api/videos/stream/${id}`;

    res.json(responseUtils.success({
      video_id: id,
      url: videoUrl,
      expires_at: new Date(Date.now() + 3600000).toISOString() // 1小时有效期
    }, 'Video URL generated'));

  } catch (error) {
    console.error('Get video URL error:', error);
    res.status(500).json(responseUtils.error('Failed to get video URL', 'URL_ERROR'));
  }
});

// 清理视频发现缓存
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    const platformManager = PlatformManager.getInstance();
    platformManager.clearCache();
    res.set('Cache-Control', 'no-store');
    return res.json(responseUtils.success({ cleared: true }, 'Video discovery cache cleared'));
  } catch (error) {
    console.error('Clear video cache error:', error);
    return res.status(500).json(responseUtils.error('Failed to clear video cache', 'CACHE_CLEAR_FAILED'));
  }
});

export default router;