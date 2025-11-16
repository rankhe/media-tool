/**
 * 任务处理器 - 集成yt-dlp下载功能
 */

import { Queue, Job } from 'bull';
import { DatabaseService } from '../config/database.js';
import VideoDownloadService, { DownloadProgress } from '../services/videoDownload.js';
import { videoProcessingService, ProcessingProgress } from '../services/videoProcessing.js';
import { videoPublishService, PublishOptions } from '../services/videoPublish.js';
import { getVideoDownloadQueue, getVideoProcessQueue, getVideoPublishQueue } from '../config/redis.js';

export class TaskProcessor {
  private downloadService: VideoDownloadService;
  private downloadQueue: Queue;
  private processQueue: Queue;
  private publishQueue: Queue;

  constructor() {
    this.downloadService = VideoDownloadService.getInstance();
    
    // 初始化队列
    this.downloadQueue = getVideoDownloadQueue();
    this.processQueue = getVideoProcessQueue();
    this.publishQueue = getVideoPublishQueue();

    this.setupQueueProcessors();
  }

  /**
   * 设置队列处理器
   */
  private setupQueueProcessors() {
    if (!this.downloadQueue || !this.processQueue || !this.publishQueue) {
      console.warn('⚠️  Some queues are not available. Task processing will use fallback mode.');
      return;
    }

    // 下载任务处理器
    this.downloadQueue.process('download', async (job: Job) => {
      return await this.handleDownloadTask(job);
    });

    // 处理任务处理器
    this.processQueue.process('process', async (job: Job) => {
      return await this.handleProcessTask(job);
    });

    // 发布任务处理器
    this.publishQueue.process('publish', async (job: Job) => {
      return await this.handlePublishTask(job);
    });

    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.downloadQueue || !this.processQueue || !this.publishQueue) {
      return;
    }

    // 下载队列事件
    this.downloadQueue.on('completed', (job: Job) => {
      console.log(`✅ Download job ${job.id} completed`);
    });

    this.downloadQueue.on('failed', (job: Job, err: Error) => {
      console.error(`❌ Download job ${job.id} failed:`, err);
    });

    // 处理队列事件
    this.processQueue.on('completed', (job: Job) => {
      console.log(`✅ Process job ${job.id} completed`);
    });

    this.processQueue.on('failed', (job: Job, err: Error) => {
      console.error(`❌ Process job ${job.id} failed:`, err);
    });

    // 发布队列事件
    this.publishQueue.on('completed', (job: Job) => {
      console.log(`✅ Publish job ${job.id} completed`);
    });

    this.publishQueue.on('failed', (job: Job, err: Error) => {
      console.error(`❌ Publish job ${job.id} failed:`, err);
    });
  }

  /**
   * 处理下载任务
   */
  private async handleDownloadTask(job: Job) {
    const { taskId, sourceConfig, targetConfig } = job.data;
    
    try {
      // 更新任务状态为运行中
      await DatabaseService.updateTaskStatus(taskId, 'running', 0);

      // 验证yt-dlp是否可用
      const isYtDlpAvailable = await this.downloadService.checkYtDlp();
      if (!isYtDlpAvailable) {
        throw new Error('yt-dlp is not available. Please install yt-dlp first.');
      }

      // 构建视频URL
      let videoUrl = '';
      switch (sourceConfig.platform) {
        case 'douyin':
          videoUrl = `https://www.douyin.com/video/${sourceConfig.videoId}`;
          break;
        case 'kuaishou':
          videoUrl = `https://www.kuaishou.com/short-video/${sourceConfig.videoId}`;
          break;
        case 'xiaohongshu':
          videoUrl = `https://www.xiaohongshu.com/discovery/item/${sourceConfig.videoId}`;
          break;
        case 'bilibili':
          videoUrl = `https://www.bilibili.com/video/${sourceConfig.videoId}`;
          break;
        case 'wechat':
          videoUrl = sourceConfig.videoId; // 微信视频号可能需要特殊处理
          break;
        default:
          videoUrl = sourceConfig.videoId; // 直接作为URL
      }

      // 验证URL
      const isValidUrl = await this.downloadService.validateUrl(videoUrl);
      if (!isValidUrl) {
        throw new Error(`Invalid video URL: ${videoUrl}`);
      }

      // 获取视频信息
      const videoInfo = await this.downloadService.getVideoInfo(videoUrl);
      console.log(`📹 Video info:`, {
        title: videoInfo.title,
        duration: videoInfo.duration,
        uploader: videoInfo.uploader
      });

      // 执行下载
      let lastProgress = 0;
      const result = await this.downloadService.downloadVideo(
        {
          url: videoUrl,
          outputPath: targetConfig.outputPath || './downloads',
          quality: sourceConfig.quality || 'high',
          extractAudio: sourceConfig.extractAudio || false,
          renamePattern: targetConfig.renamePattern || '{title}_{id}',
          createFolder: targetConfig.createFolder !== false
        },
        (progress: DownloadProgress) => {
          // 更新进度
          const progressPercent = progress.percent / 100;
          if (progressPercent !== lastProgress) {
            lastProgress = progressPercent;
            job.progress(progressPercent);
            
            // 更新数据库中的任务进度
            DatabaseService.updateTaskStatus(taskId, 'running', progressPercent)
              .catch(err => console.error('Failed to update task progress:', err));
          }

          console.log(`⬇️ Download progress: ${progress.percent}% | Speed: ${progress.speed} | ETA: ${progress.eta}`);
        }
      );

      if (result.success) {
        // 更新任务状态为完成
        await DatabaseService.updateTaskStatus(taskId, 'completed', 1);
        
        console.log(`✅ Download completed: ${result.filePath}`);
        
        // 如果配置了自动处理，将任务添加到处理队列
        if (targetConfig.autoProcess) {
          await this.processQueue.add('process', {
            taskId,
            filePath: result.filePath,
            processingConfig: targetConfig.processingConfig
          });
        }
        
        return {
          success: true,
          filePath: result.filePath,
          videoInfo
        };
      } else {
        throw new Error(result.error || 'Download failed');
      }

    } catch (error) {
      console.error(`❌ Download task failed:`, error);
      
      // 更新任务状态为失败
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      await DatabaseService.updateTaskStatus(taskId, 'failed', 0, errorMessage);
      
      throw error;
    }
  }

  /**
   * 处理视频处理任务
   */
  private async handleProcessTask(job: Job) {
    const { taskId, filePath, processingConfig } = job.data;
    
    try {
      console.log(`🎬 Processing video: ${filePath}`);
      
      // 更新任务状态为运行中
      await DatabaseService.updateTaskStatus(taskId, 'running', 0);

      // 构建处理选项
      const processingOptions = {
        inputPath: filePath,
        outputPath: filePath.replace(/\.[^/.]+$/, '_processed.mp4'),
        processingType: processingConfig.processingType || 'basic',
        // 文案处理
        transcribe: processingConfig.transcribe || false,
        translate: processingConfig.translate || false,
        summarize: processingConfig.summarize || false,
        targetLanguage: processingConfig.targetLanguage || 'en',
        // 声音处理
        removeOriginalAudio: processingConfig.removeOriginalAudio || false,
        addBackgroundMusic: processingConfig.addBackgroundMusic || false,
        backgroundMusicPath: processingConfig.backgroundMusicPath,
        adjustAudioVolume: processingConfig.adjustAudioVolume || 1.0,
        // 画面处理
        resizeVideo: processingConfig.resizeVideo || false,
        targetResolution: processingConfig.targetResolution || '1920x1080',
        addWatermark: processingConfig.addWatermark || false,
        watermarkPath: processingConfig.watermarkPath,
        watermarkPosition: processingConfig.watermarkPosition || 'top-right',
        cropVideo: processingConfig.cropVideo || false,
        cropArea: processingConfig.cropArea || 'in_w/2:in_h/2:in_w/2:in_h/2',
        // 特效处理
        addEffects: processingConfig.addEffects || false,
        effectsType: processingConfig.effectsType || 'fade',
        // 字幕处理
        addSubtitles: processingConfig.addSubtitles || false,
        subtitleContent: processingConfig.subtitleContent,
        subtitleStyle: processingConfig.subtitleStyle || 'default'
      };

      let lastProgress = 0;
      const result = await videoProcessingService.processVideo(
        processingOptions,
        (progress: ProcessingProgress) => {
          const progressPercent = progress.percent / 100;
          if (progressPercent !== lastProgress) {
            lastProgress = progressPercent;
            job.progress(progressPercent);
            
            // 更新数据库中的任务进度
            DatabaseService.updateTaskStatus(taskId, 'running', progressPercent)
              .catch(err => console.error('Failed to update processing progress:', err));
          }

          console.log(`🎬 Processing progress: ${progress.percent}% | Step: ${progress.currentStep}`);
        }
      );

      if (result.success) {
        // 更新任务状态为完成
        await DatabaseService.updateTaskStatus(taskId, 'completed', 1);
        
        console.log(`✅ Video processing completed: ${result.outputPath}`);
        
        return {
          success: true,
          processedFilePath: result.outputPath,
          metadata: result.metadata,
          extractedText: result.extractedText,
          translatedText: result.translatedText,
          summary: result.summary
        };
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error(`❌ Video processing failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      await DatabaseService.updateTaskStatus(taskId, 'failed', 0, errorMessage);
      
      throw error;
    }
  }

  /**
   * 处理发布任务
   */
  private async handlePublishTask(job: Job) {
    const { taskId, filePath, target_config } = job.data;
    
    try {
      console.log(`📤 Publishing video: ${filePath}`);
      
      // 更新任务状态为运行中
      await DatabaseService.updateTaskStatus(taskId, 'running', 0);

      // 构建发布选项
      const publishOptions: PublishOptions = {
        videoPath: filePath,
        platform: target_config.platform || 'douyin',
        accountId: target_config.accountId,
        title: target_config.title || '发布视频',
        description: target_config.description,
        tags: target_config.tags || [],
        coverImage: target_config.coverImage,
        visibility: target_config.visibility || 'public',
        scheduledAt: target_config.scheduledAt ? new Date(target_config.scheduledAt) : undefined,
        category: target_config.category,
        location: target_config.location
      };

      // 发布视频
      const result = await videoPublishService.publishVideo(publishOptions);

      if (result.success) {
        // 更新任务状态为完成
        await DatabaseService.updateTaskStatus(taskId, 'completed', 1);
        
        console.log(`✅ Video published successfully to ${result.platform}: ${result.publishedUrl}`);
        
        return {
          success: true,
          platform: result.platform,
          publishedUrl: result.publishedUrl,
          videoId: result.videoId,
          publishedAt: result.publishedAt
        };
      } else {
        throw new Error(result.error || 'Publishing failed');
      }

    } catch (error) {
      console.error(`❌ Video publishing failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Publishing failed';
      await DatabaseService.updateTaskStatus(taskId, 'failed', 0, errorMessage);
      
      throw error;
    }
  }

  /**
   * 添加任务到队列
   */
  async addDownloadTask(taskData: any) {
    if (!this.downloadQueue) {
      console.warn('⚠️  Download queue not available, using fallback processing');
      return await this.handleDownloadTask({ data: taskData } as any);
    }
    
    return await this.downloadQueue.add('download', taskData, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async addProcessTask(taskData: any) {
    if (!this.processQueue) {
      console.warn('⚠️  Process queue not available, using fallback processing');
      return await this.handleProcessTask({ data: taskData } as any);
    }
    
    return await this.processQueue.add('process', taskData, {
      priority: 2,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000
      }
    });
  }

  async addPublishTask(taskData: any) {
    if (!this.publishQueue) {
      console.warn('⚠️  Publish queue not available, using fallback processing');
      return await this.handlePublishTask({ data: taskData } as any);
    }
    
    return await this.publishQueue.add('publish', taskData, {
      priority: 3,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }

  /**
   * 获取队列状态
   */
  async getQueueStats() {
    return {
      download: await this.downloadQueue.getJobCounts(),
      process: await this.processQueue.getJobCounts(),
      publish: await this.publishQueue.getJobCounts()
    };
  }
}

// 创建单例实例
export const taskProcessor = new TaskProcessor();

export default TaskProcessor;