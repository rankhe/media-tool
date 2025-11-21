import { BilibiliCrawlerService } from './platformCrawlers/bilibiliCrawler';
import { DouyinCrawlerService } from './platformCrawlers/douyinCrawler';
import { KuaishouCrawlerService } from './platformCrawlers/kuaishouCrawler';
import { XiaohongshuCrawlerService } from './platformCrawlers/xiaohongshuCrawler';

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
  private cache: {
    trending: Map<string, { data: any[]; time: number }>;
    search: Map<string, { data: any[]; time: number }>;
  } = { trending: new Map(), search: new Map() };
  private cacheTTL = 2 * 60 * 1000;

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
    const bilibili = new BilibiliCrawlerService();
    this.crawlers.set('bilibili', {
      async getTrendingVideos(category?: string, limit?: number) {
        return await bilibili.getTrendingVideos(category || 'all', limit || 20);
      },
      async searchVideos(keyword: string, _platform?: string, limit?: number) {
        return await bilibili.searchVideos(keyword, 1, limit || 20);
      },
      async getUserVideos(username: string, limit?: number) {
        return await bilibili.getUserVideos(username, limit || 30);
      },
      async getUserInfo(username: string) {
        return await bilibili.getUserInfo(username);
      },
      getPlatformName() { return 'bilibili'; }
    });
    const douyin = new DouyinCrawlerService();
    this.crawlers.set('douyin', {
      async getTrendingVideos(category?: string, limit?: number) {
        return await douyin.getTrendingVideos(category || 'all', limit || 20);
      },
      async searchVideos(keyword: string, _platform?: string, limit?: number) {
        return await douyin.searchVideos(keyword, 'douyin', limit || 20);
      },
      async getUserVideos(username: string, limit?: number) {
        return await douyin.getUserVideos(username, limit || 30);
      },
      async getUserInfo(username: string) {
        return await douyin.getUserInfo(username);
      },
      getPlatformName() { return 'douyin'; }
    });

    const kuaishou = new KuaishouCrawlerService();
    this.crawlers.set('kuaishou', {
      async getTrendingVideos(category?: string, limit?: number) {
        return await kuaishou.getTrendingVideos(category || 'all', limit || 20);
      },
      async searchVideos(keyword: string, _platform?: string, limit?: number) {
        return await kuaishou.searchVideos(keyword, 'kuaishou', limit || 20);
      },
      async getUserVideos(username: string, limit?: number) {
        return await kuaishou.getUserVideos(username, limit || 30);
      },
      async getUserInfo(username: string) {
        return await kuaishou.getUserInfo(username);
      },
      getPlatformName() { return 'kuaishou'; }
    });

    const xhs = new XiaohongshuCrawlerService();
    this.crawlers.set('xiaohongshu', {
      async getTrendingVideos(category?: string, limit?: number) {
        return await xhs.getTrendingVideos(category || 'all', limit || 20);
      },
      async searchVideos(keyword: string, _platform?: string, limit?: number) {
        return await xhs.searchVideos(keyword, 'xiaohongshu', limit || 20);
      },
      async getUserVideos(username: string, limit?: number) {
        return await xhs.getUserVideos(username, limit || 30);
      },
      async getUserInfo(username: string) {
        return await xhs.getUserInfo(username);
      },
      getPlatformName() { return 'xiaohongshu'; }
    });
  }

  public getCrawler(platform: string): PlatformCrawler | null {
    return this.crawlers.get(platform) || null;
  }

  public getAvailablePlatforms(): string[] {
    return Array.from(this.crawlers.keys());
  }

  public clearCache() {
    this.cache.trending.clear();
    this.cache.search.clear();
  }

  public async getTrendingFromAll(platforms: string[] = [], category?: string, limit: number = 20, options?: { nocache?: boolean }) {
    const targetPlatforms = platforms.length > 0 ? platforms : (this.getAvailablePlatforms().length ? this.getAvailablePlatforms() : ['bilibili']);
    const key = JSON.stringify({ type: 'trending', platforms: targetPlatforms.sort(), category: category || 'all', limit });
    const now = Date.now();
    const cached = this.cache.trending.get(key);
    if (!options?.nocache && cached && (now - cached.time) < this.cacheTTL) {
      return cached.data.slice(0, limit);
    }
    const results: any[] = [];

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

    const finalData = results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
    this.cache.trending.set(key, { data: finalData, time: now });
    return finalData;
  }

  public async searchFromAll(keyword: string, platforms: string[] = [], limit: number = 20, options?: { nocache?: boolean }) {
    const targetPlatforms = platforms.length > 0 ? platforms : (this.getAvailablePlatforms().length ? this.getAvailablePlatforms() : ['bilibili']);
    const key = JSON.stringify({ type: 'search', keyword, platforms: targetPlatforms.sort(), limit });
    const now = Date.now();
    const cached = this.cache.search.get(key);
    if (!options?.nocache && cached && (now - cached.time) < this.cacheTTL) {
      return cached.data.slice(0, limit);
    }
    const results: any[] = [];

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

    const finalData = results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
    this.cache.search.set(key, { data: finalData, time: now });
    return finalData;
  }
}