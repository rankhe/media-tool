import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from './auth.js';
import { responseUtils } from '../utils/index.js';
import VideoDownloadService from '../services/videoDownload.js';
import { videoProcessingService } from '../services/videoProcessing.js';
import { videoPublishService } from '../services/videoPublish.js';

const router = express.Router();

router.post('/', authenticateToken, [
  body('youtube_url').isString().isURL(),
  body('title').isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().isLength({ max: 50 }),
  body('quality').optional().isIn(['highest','high','medium','low']),
  body('downloadSubtitles').optional().isBoolean(),
  body('subtitleLangs').optional().isArray(),
  body('subtitleLangs.*').optional().isString(),
  body('embedSubtitles').optional().isBoolean(),
  body('process').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(responseUtils.error('Validation failed', 'VALIDATION_ERROR'));
    }

    const { youtube_url, title, description, tags, quality = 'high', downloadSubtitles = true, subtitleLangs = ['en','zh-Hans','zh-Hant'], embedSubtitles = false, process = false } = req.body;

    const downloadService = VideoDownloadService.getInstance();

    const ok = await downloadService.checkYtDlp();
    if (!ok) {
      return res.status(500).json(responseUtils.error('yt-dlp 未检测到，请安装后重试', 'YTDLP_NOT_FOUND'));
    }

    const dlResult = await downloadService.downloadVideo({
      url: youtube_url,
      outputPath: './downloads',
      quality,
      platform: 'youtube',
      renamePattern: '{title}_{id}',
      downloadSubtitles,
      subtitleLangs,
      embedSubtitles,
      createFolder: true,
    });

    if (!dlResult.success || !dlResult.filePath) {
      return res.status(500).json(responseUtils.error(dlResult.error || '下载失败', 'DOWNLOAD_ERROR'));
    }

    let finalVideoPath = dlResult.filePath;

    if (process) {
      const processed = await videoProcessingService.processVideo({
        inputPath: finalVideoPath,
        outputPath: finalVideoPath.replace(/\.[^/.]+$/, '_processed.mp4'),
        processingType: 'basic',
        addSubtitles: false,
      });

      if (!processed.success || !processed.outputPath) {
        return res.status(500).json(responseUtils.error(processed.error || '处理失败', 'PROCESS_ERROR'));
      }

      finalVideoPath = processed.outputPath;
    }

    const publish = await videoPublishService.publishVideo({
      videoPath: finalVideoPath,
      platform: 'bilibili',
      accountId: req.user.userId,
      title,
      description,
      tags,
      visibility: 'public',
    });

    if (!publish.success) {
      return res.status(500).json(responseUtils.error(publish.error || '发布失败', 'PUBLISH_ERROR'));
    }

    return res.json(responseUtils.success({
      videoPath: finalVideoPath,
      publishedUrl: publish.publishedUrl,
      videoId: publish.videoId,
      platform: publish.platform,
    }, 'YouTube 到 B站 发布成功'));

  } catch (error) {
    console.error('ytb2bili error:', error);
    return res.status(500).json(responseUtils.error('服务异常', 'INTERNAL_ERROR'));
  }
});

export default router;