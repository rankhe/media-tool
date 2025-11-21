/**
 * 视频发布服务 - 自动发布到多个平台
 */

import axios from 'axios';
import fs from 'fs/promises';
import FormData from 'form-data';
import { bilibiliPublisher } from './bilibiliPublisher.js';

export interface PublishOptions {
  videoPath: string;
  platform: string;
  accountId: string;
  title: string;
  description?: string;
  tags?: string[];
  coverImage?: string;
  visibility?: 'public' | 'private' | 'unlisted';
  scheduledAt?: Date;
  category?: string;
  location?: string;
}

export interface PublishResult {
  success: boolean;
  platform: string;
  publishedUrl?: string;
  videoId?: string;
  error?: string;
  publishedAt?: Date;
}

export interface PlatformConfig {
  name: string;
  apiEndpoint: string;
  authType: 'oauth' | 'api_key' | 'token';
  maxFileSize: number;
  supportedFormats: string[];
  rateLimit: number;
}

export class VideoPublishService {
  private static instance: VideoPublishService;
  private platformConfigs: Map<string, PlatformConfig>;

  static getInstance(): VideoPublishService {
    if (!this.instance) {
      this.instance = new VideoPublishService();
    }
    return this.instance;
  }

  constructor() {
    this.platformConfigs = new Map([
      ['douyin', {
        name: '抖音',
        apiEndpoint: 'https://open.douyin.com/api',
        authType: 'oauth',
        maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
        supportedFormats: ['mp4', 'mov'],
        rateLimit: 100
      }],
      ['kuaishou', {
        name: '快手',
        apiEndpoint: 'https://open.kuaishou.com/api',
        authType: 'oauth',
        maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
        supportedFormats: ['mp4', 'mov', 'avi'],
        rateLimit: 50
      }],
      ['xiaohongshu', {
        name: '小红书',
        apiEndpoint: 'https://edith.xiaohongshu.com/api',
        authType: 'token',
        maxFileSize: 1 * 1024 * 1024 * 1024, // 1GB
        supportedFormats: ['mp4'],
        rateLimit: 30
      }],
      ['bilibili', {
        name: '哔哩哔哩',
        apiEndpoint: 'https://api.bilibili.com/x',
        authType: 'oauth',
        maxFileSize: 8 * 1024 * 1024 * 1024, // 8GB
        supportedFormats: ['mp4', 'flv', 'avi'],
        rateLimit: 200
      }],
      ['wechat', {
        name: '微信视频号',
        apiEndpoint: 'https://api.weixin.qq.com/wxa/media',
        authType: 'token',
        maxFileSize: 1 * 1024 * 1024 * 1024, // 1GB
        supportedFormats: ['mp4'],
        rateLimit: 20
      }]
    ]);
  }

  /**
   * 发布视频到指定平台
   */
  async publishVideo(options: PublishOptions): Promise<PublishResult> {
    try {
      const { platform, videoPath } = options;
      
      // 验证平台配置
      const platformConfig = this.platformConfigs.get(platform);
      if (!platformConfig) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // 验证视频文件
      await this.validateVideoFile(videoPath, platformConfig);

      // 根据平台类型选择发布方法
      let result: PublishResult;
      
      switch (platform) {
        case 'douyin':
          result = await this.publishToDouyin(options);
          break;
        case 'kuaishou':
          result = await this.publishToKuaishou(options);
          break;
        case 'xiaohongshu':
          result = await this.publishToXiaohongshu(options);
          break;
        case 'bilibili':
          result = await this.publishToBilibili(options);
          break;
        case 'wechat':
          result = await this.publishToWechat(options);
          break;
        default:
          throw new Error(`Platform ${platform} not implemented`);
      }

      console.log(`✅ Video published successfully to ${platform}:`, result);
      return result;

    } catch (error) {
      console.error(`❌ Failed to publish video to ${options.platform}:`, error);
      return {
        success: false,
        platform: options.platform,
        error: error instanceof Error ? error.message : 'Publish failed'
      };
    }
  }

  /**
   * 批量发布到多个平台
   */
  async publishToMultiplePlatforms(
    options: PublishOptions,
    platforms: string[]
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];
    
    for (const platform of platforms) {
      try {
        const result = await this.publishVideo({
          ...options,
          platform
        });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          platform,
          error: error instanceof Error ? error.message : 'Publish failed'
        });
      }
    }
    
    return results;
  }

  /**
   * 验证视频文件
   */
  private async validateVideoFile(videoPath: string, platformConfig: PlatformConfig): Promise<void> {
    try {
      const stats = await fs.stat(videoPath);
      
      // 检查文件大小
      if (stats.size > platformConfig.maxFileSize) {
        throw new Error(`File size exceeds platform limit of ${platformConfig.maxFileSize / (1024 * 1024 * 1024)}GB`);
      }
      
      // 检查文件格式
      const ext = videoPath.split('.').pop()?.toLowerCase();
      if (!ext || !platformConfig.supportedFormats.includes(ext)) {
        throw new Error(`Unsupported format. Supported formats: ${platformConfig.supportedFormats.join(', ')}`);
      }
      
    } catch (error) {
      throw new Error(`Video validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 抖音发布
   */
  private async publishToDouyin(options: PublishOptions): Promise<PublishResult> {
    // 模拟抖音发布（实际需要OAuth认证和API调用）
    const mockResult: PublishResult = {
      success: true,
      platform: 'douyin',
      publishedUrl: `https://www.douyin.com/video/${Date.now()}`,
      videoId: `douyin_${Date.now()}`,
      publishedAt: new Date()
    };
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return mockResult;
  }

  /**
   * 快手发布
   */
  private async publishToKuaishou(options: PublishOptions): Promise<PublishResult> {
    // 模拟快手发布
    const mockResult: PublishResult = {
      success: true,
      platform: 'kuaishou',
      publishedUrl: `https://www.kuaishou.com/short-video/${Date.now()}`,
      videoId: `kuaishou_${Date.now()}`,
      publishedAt: new Date()
    };
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return mockResult;
  }

  /**
   * 小红书发布
   */
  private async publishToXiaohongshu(options: PublishOptions): Promise<PublishResult> {
    // 模拟小红书发布
    const mockResult: PublishResult = {
      success: true,
      platform: 'xiaohongshu',
      publishedUrl: `https://www.xiaohongshu.com/discovery/item/${Date.now()}`,
      videoId: `xiaohongshu_${Date.now()}`,
      publishedAt: new Date()
    };
    
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    return mockResult;
  }

  /**
   * 哔哩哔哩发布
   */
  private async publishToBilibili(options: PublishOptions): Promise<PublishResult> {
    const useAutomation = process.env.BILIBILI_USE_AUTOMATION === 'true';
    if (useAutomation) {
      const r = await bilibiliPublisher.publish({
        videoPath: options.videoPath,
        title: options.title,
        description: options.description,
        tags: options.tags,
      });
      if (r && (r as any).success) {
        return {
          success: true,
          platform: 'bilibili',
          publishedUrl: undefined,
          videoId: undefined,
          publishedAt: new Date(),
        };
      } else {
        return {
          success: false,
          platform: 'bilibili',
          error: (r as any)?.error || 'Upload failed',
        };
      }
    }
    return {
      success: true,
      platform: 'bilibili',
      publishedUrl: `https://www.bilibili.com/video/${Date.now()}`,
      videoId: `bilibili_${Date.now()}`,
      publishedAt: new Date()
    };
  }

  /**
   * 微信视频号发布
   */
  private async publishToWechat(options: PublishOptions): Promise<PublishResult> {
    // 模拟微信视频号发布
    const mockResult: PublishResult = {
      success: true,
      platform: 'wechat',
      publishedUrl: `https://mp.weixin.qq.com/s/${Date.now()}`,
      videoId: `wechat_${Date.now()}`,
      publishedAt: new Date()
    };
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return mockResult;
  }

  /**
   * 获取平台配置
   */
  getPlatformConfig(platform: string): PlatformConfig | undefined {
    return this.platformConfigs.get(platform);
  }

  /**
   * 获取所有支持的平台
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.platformConfigs.keys());
  }

  /**
   * 获取平台信息
   */
  getPlatformInfo(platform: string) {
    const config = this.getPlatformConfig(platform);
    if (!config) {
      return null;
    }
    
    return {
      name: config.name,
      supportedFormats: config.supportedFormats,
      maxFileSize: config.maxFileSize,
      rateLimit: config.rateLimit
    };
  }

  /**
   * 检查平台是否可用
   */
  async isPlatformAvailable(platform: string): Promise<boolean> {
    const config = this.getPlatformConfig(platform);
    if (!config) {
      return false;
    }
    
    // 这里可以添加实际的API健康检查
    // 现在返回模拟结果
    return true;
  }

  /**
   * 获取发布统计
   */
  async getPublishStats(userId: string, timeRange: 'day' | 'week' | 'month' = 'day') {
    // 这里应该从数据库获取实际的发布统计
    // 现在返回模拟数据
    return {
      totalPublished: Math.floor(Math.random() * 100) + 10,
      successfulPublishes: Math.floor(Math.random() * 80) + 5,
      failedPublishes: Math.floor(Math.random() * 20) + 1,
      platforms: {
        douyin: Math.floor(Math.random() * 30) + 5,
        kuaishou: Math.floor(Math.random() * 25) + 3,
        xiaohongshu: Math.floor(Math.random() * 20) + 2,
        bilibili: Math.floor(Math.random() * 15) + 1,
        wechat: Math.floor(Math.random() * 10) + 1
      },
      timeRange
    };
  }
}

export const videoPublishService = VideoPublishService.getInstance();

export default VideoPublishService;