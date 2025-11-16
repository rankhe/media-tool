import { BilibiliCrawlerService } from './platformCrawlers/bilibiliCrawler';

export interface PlatformCrawler {
  getTrendingVideos(category?: string, limit?: number): Promise<any[]>;
  searchVideos(keyword: string, platform?: string, limit?: number): Promise<any[]>;
  getUserVideos(username: string, limit?: number): Promise<any[]>;
  getUserInfo(username: string): Promise<any>;
  getPlatformName(): string;
}

export class PlatformManager {
  private crawlers: Map<string, PlatformCrawler> = new Map();
  private static instance: PlatformManager;

  private constructor() {
    this.initializeCrawlers();
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }

  private initializeCrawlers() {
    // 已实现的爬虫
    // Temporarily commented out due to interface mismatch
    // this.crawlers.set('bilibili', new BilibiliCrawlerService());
    
    // TODO: 逐步添加其他平台
    // this.crawlers.set('xiaohongshu', new XiaohongshuCrawlerService());
    // this.crawlers.set('kuaishou', new KuaishouCrawlerService());
    // this.crawlers.set('douyin', new DouyinCrawlerService());
  }

  public getCrawler(platform: string): PlatformCrawler | null {
    return this.crawlers.get(platform) || null;
  }

  public getAvailablePlatforms(): string[] {
    return Array.from(this.crawlers.keys());
  }

  public async getTrendingFromAll(platforms: string[] = [], category?: string, limit: number = 20) {
    const results: any[] = [];
    const targetPlatforms = platforms.length > 0 ? platforms : this.getAvailablePlatforms();

    for (const platform of targetPlatforms) {
      const crawler = this.getCrawler(platform);
      if (crawler) {
        try {
          const videos = await crawler.getTrendingVideos(category, Math.ceil(limit / targetPlatforms.length));
          results.push(...videos.map(video => ({
            ...video,
            platform,
            crawledAt: new Date().toISOString()
          })));
        } catch (error) {
          console.error(`Failed to fetch trending videos from ${platform}:`, error);
        }
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }

  public async searchFromAll(keyword: string, platforms: string[] = [], limit: number = 20) {
    const results: any[] = [];
    const targetPlatforms = platforms.length > 0 ? platforms : this.getAvailablePlatforms();

    for (const platform of targetPlatforms) {
      const crawler = this.getCrawler(platform);
      if (crawler) {
        try {
          const videos = await crawler.searchVideos(keyword, platform, Math.ceil(limit / targetPlatforms.length));
          results.push(...videos.map(video => ({
            ...video,
            platform,
            crawledAt: new Date().toISOString()
          })));
        } catch (error) {
          console.error(`Failed to search videos from ${platform}:`, error);
        }
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }
}