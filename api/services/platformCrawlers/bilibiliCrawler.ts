/**
 * 哔哩哔哩平台爬虫服务
 * B站相对开放，有公开的API接口，是最容易实现真实数据拉取的平台
 */

import { logger } from '../../utils/logger.js';

interface BilibiliVideo {
  aid: number;
  bvid: string;
  title: string;
  desc: string;
  pic: string;
  duration: number;
  view: number;
  like: number;
  coin: number;
  share: number;
  reply: number;
  favorite: number;
  owner: {
    mid: number;
    name: string;
    face: string;
  };
  pubdate: number;
  tag: string;
  tname: string;
}

interface BilibiliRankingResponse {
  code: number;
  message: string;
  data: {
    list: BilibiliVideo[];
    note: string;
  };
}

interface BilibiliSearchResponse {
  code: number;
  message: string;
  data: {
    result: BilibiliVideo[];
    numResults: number;
    page: number;
    pagesize: number;
  };
}

export class BilibiliCrawlerService {
  private readonly BASE_URL = 'https://api.bilibili.com';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * 获取热门视频（排行榜）
   * 由于B站排行榜API需要复杂认证，我们使用搜索热门关键词的方式来获取真实数据
   */
  async getTrendingVideos(category: string = 'all', limit: number = 20): Promise<any[]> {
    try {
      logger.info(`[Bilibili] 获取首页热门视频，数量: ${limit}`);
      const url = `${this.BASE_URL}/x/web-interface/popular?ps=${limit}&pn=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Referer': 'https://www.bilibili.com/',
          'Accept': 'application/json, text/plain, */*',
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.code !== 0 || !data.data || !Array.isArray(data.data.list)) {
        throw new Error(`Bilibili popular API error: ${data.message || 'unknown'}`);
      }
      const list = data.data.list;
      const videos = list.map((video: any) => ({
        id: (video.aid || video.cid || video.id)?.toString(),
        platform: 'bilibili',
        title: this.cleanTitle(video.title || ''),
        description: video.desc || '',
        thumbnail_url: video.pic,
        video_url: `https://www.bilibili.com/video/${video.bvid}`,
        duration: video.duration || 0,
        view_count: (video.stat?.view ?? video.view ?? 0),
        like_count: (video.stat?.like ?? video.like ?? 0),
        comment_count: (video.stat?.reply ?? video.reply ?? 0),
        share_count: (video.stat?.share ?? video.share ?? 0),
        created_at: new Date((video.pubdate || video.pub_time || Date.now()) * 1000).toISOString(),
        author: {
          id: (video.owner?.mid ?? video.mid ?? 0).toString(),
          name: video.owner?.name ?? video.uname ?? '',
          avatar_url: video.owner?.face ?? '',
          follower_count: 0,
          verified: false
        },
        tags: video.tag ? String(video.tag).split(',') : [],
        category: this.mapCategory(video.tname || ''),
        relevanceScore: this.calculateTrendScore((video.stat?.view ?? 0), (video.stat?.like ?? 0), (video.stat?.reply ?? 0)),
        crawled_at: new Date().toISOString(),
        is_real_data: true
      }));
      logger.info(`[Bilibili] 成功获取首页热门视频 ${videos.length} 个`);
      return videos;
    } catch (error) {
      logger.error('[Bilibili] 获取首页热门视频失败:', error);
      return [];
    }
  }

  /**
   * 搜索视频
   */
  async searchVideos(keyword: string, page: number = 1, limit: number = 20): Promise<any[]> {
    try {
      logger.info(`[Bilibili] 搜索视频，关键词: ${keyword}, 页码: ${page}`);
      
      // B站搜索API
      const url = `${this.BASE_URL}/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}`;
      
      // 生成随机的buvid3，模拟浏览器行为
      const buvid3 = this.generateBuvid3();
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Referer': 'https://search.bilibili.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Cookie': `buvid3=${buvid3}; _uuid=${this.generateUUID()};`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: BilibiliSearchResponse = await response.json();
      
      // B站API错误码处理
      if (data.code !== 0) {
        logger.warn(`[Bilibili] 搜索API返回错误码: ${data.code}, 消息: ${data.message}`);
        return [];
      }

      // 确保有搜索结果
      if (!data.data || !data.data.result || data.data.result.length === 0) {
        logger.warn(`[Bilibili] 搜索无结果`);
        return [];
      }

      // 格式化搜索结果
      const videos = data.data.result.map(video => ({
        id: video.aid.toString(),
        platform: 'bilibili',
        title: this.cleanTitle(video.title),
        description: video.desc || '',
        thumbnail_url: video.pic,
        video_url: `https://www.bilibili.com/video/${video.bvid}`,
        duration: video.duration,
        view_count: video.view,
        like_count: video.like,
        comment_count: video.reply,
        share_count: video.share,
        created_at: new Date(video.pubdate * 1000).toISOString(),
        author: {
          id: video.owner.mid.toString(),
          name: video.owner.name,
          avatar_url: video.owner.face,
          follower_count: 0,
          verified: false
        },
        tags: video.tag ? video.tag.split(',') : [],
        category: this.mapCategory(video.tname),
        relevanceScore: this.calculateRelevanceScore(video, keyword),
        crawled_at: new Date().toISOString(),
        is_real_data: true
      }));

      logger.info(`[Bilibili] 成功搜索到 ${videos.length} 个视频`);
      return videos;
      
    } catch (error) {
      logger.error('[Bilibili] 搜索视频失败:', error);
      return [];
    }
  }

  /**
   * 获取用户视频
   */
  async getUserVideos(mid: string, limit: number = 30): Promise<any[]> {
    try {
      logger.info(`[Bilibili] 获取用户视频，用户ID: ${mid}`);
      
      // B站用户投稿视频API
      const url = `${this.BASE_URL}/x/space/arc/search?mid=${mid}&ps=${limit}&tid=0&pn=1&order=pubdate`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Referer': `https://space.bilibili.com/${mid}`,
          'Accept': 'application/json, text/plain, */*',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`Bilibili API error: ${data.message}`);
      }

      const videos = data.data.list.vlist.map(video => ({
        id: video.aid.toString(),
        platform: 'bilibili',
        title: this.cleanTitle(video.title),
        description: video.description || '',
        thumbnail_url: video.pic,
        video_url: `https://www.bilibili.com/video/${video.bvid}`,
        duration: video.length,
        view_count: video.play,
        like_count: video.video_review, // 弹幕数作为点赞参考
        comment_count: video.comment,
        created_at: new Date(video.created * 1000).toISOString(),
        author: {
          id: mid,
          name: video.author,
          avatar_url: '', // 需要额外API获取
          follower_count: 0,
          verified: false
        },
        tags: [],
        category: this.mapCategory(video.typeid)
      }));

      logger.info(`[Bilibili] 成功获取用户 ${videos.length} 个视频`);
      return videos;
      
    } catch (error) {
      logger.error('[Bilibili] 获取用户视频失败:', error);
      throw error;
    }
  }

  /**
   * 获取分类ID
   */
  private getCategoryId(category: string): number {
    const categoryMap: Record<string, number> = {
      'all': 0,
      'entertainment': 5,     // 娱乐
      'education': 27,        // 知识
      'lifestyle': 160,       // 生活
      'food': 211,           // 美食
      'travel': 217,         // 旅行
      'technology': 188,     // 科技
      'fashion': 157        // 时尚
    };
    return categoryMap[category] || 0;
  }

  /**
   * 映射分类名称
   */
  private mapCategory(tname: string): string {
    const categoryMap: Record<string, string> = {
      '娱乐': 'entertainment',
      '知识': 'education',
      '生活': 'lifestyle',
      '美食': 'food',
      '旅行': 'travel',
      '科技': 'technology',
      '时尚': 'fashion'
    };
    return categoryMap[tname] || 'entertainment';
  }

  /**
   * 清理标题中的HTML标签
   */
  private cleanTitle(title: string): string {
    return title.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * 计算趋势分数
   */
  private calculateTrendScore(view: number, like: number, reply: number): number {
    // 基于观看、点赞、评论计算趋势分数
    const viewScore = Math.log10(view + 1) * 10;
    const engagementScore = (like + reply) / view * 1000;
    return Math.min(viewScore + engagementScore, 100);
  }

  /**
   * 计算相关度分数
   */
  private calculateRelevanceScore(video: any, keyword: string): number {
    let score = 0;
    const titleLower = video.title.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    
    // 标题完全匹配
    if (titleLower.includes(keywordLower)) {
      score += 50;
    }
    
    // 标题分词匹配
    const keywords = keywordLower.split(/\s+/);
    keywords.forEach(kw => {
      if (titleLower.includes(kw)) {
        score += 10;
      }
    });
    
    // 观看数权重
    score += Math.log10(video.view + 1);
    
    return Math.min(score, 100);
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(mid: string): Promise<any> {
    try {
      logger.info(`[Bilibili] 获取用户信息，用户ID: ${mid}`);
      
      const url = `${this.BASE_URL}/x/space/acc/info?mid=${mid}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Referer': `https://space.bilibili.com/${mid}`,
          'Accept': 'application/json, text/plain, */*',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`Bilibili API error: ${data.message}`);
      }

      const user = data.data;
      
      return {
        id: user.mid.toString(),
        platform: 'bilibili',
        username: user.name,
        display_name: user.name,
        avatar_url: user.face,
        follower_count: user.follower,
        video_count: 0, // 需要额外API获取
        verified: user.official.type !== -1,
        category: this.mapCategory(user.sign),
        bio: user.sign,
        level: user.level,
        likes: user.likes
      };
      
    } catch (error) {
      logger.error('[Bilibili] 获取用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 生成模拟热门视频数据（当真实API不可用时）
   */
  private generateMockTrendingVideos(category: string, limit: number): any[] {
    logger.info(`[Bilibili] 生成模拟热门视频数据，分类: ${category}, 数量: ${limit}`);
    
    // 使用一些真实的B站热门视频作为示例
    const sampleVideos = [
      {
        title: '【4K修复】周杰伦演唱会经典现场合集',
        description: '4K高清修复的周杰伦经典演唱会现场，画质音质都有很大提升，值得收藏',
        thumbnail_url: 'https://i0.hdslb.com/bfs/archive/7f3f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8.jpg',
        video_url: 'https://www.bilibili.com/video/BV1GJ411x7hT',
        duration: 1800,
        view_count: 2580000,
        like_count: 89000,
        comment_count: 12500,
        share_count: 5600,
        author: {
          name: '音乐修复师',
          avatar_url: 'https://i0.hdslb.com/bfs/face/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0.jpg',
          follower_count: 125000,
          verified: true
        },
        tags: ['音乐', '演唱会', '4K修复', '周杰伦'],
        category: 'entertainment'
      },
      {
        title: '【美食】深夜食堂：日式拉面的制作秘诀',
        description: '详细介绍正宗日式拉面的制作过程，从汤底到面条，每个步骤都不放过',
        thumbnail_url: 'https://i1.hdslb.com/bfs/archive/2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1.jpg',
        video_url: 'https://www.bilibili.com/video/BV2HK4y1x7hS',
        duration: 900,
        view_count: 456000,
        like_count: 23000,
        comment_count: 3400,
        share_count: 1800,
        author: {
          name: '美食作家王刚',
          avatar_url: 'https://i1.hdslb.com/bfs/face/3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1.jpg',
          follower_count: 89000,
          verified: true
        },
        tags: ['美食', '日式拉面', '料理', '教程'],
        category: 'food'
      },
      {
        title: '【科技】2024年最值得买的数码产品推荐',
        description: '从手机到电脑，从耳机到相机，全面分析2024年最值得购买的数码产品',
        thumbnail_url: 'https://i2.hdslb.com/bfs/archive/4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2.jpg',
        video_url: 'https://www.bilibili.com/video/BV3JL4y1x7hR',
        duration: 1200,
        view_count: 678000,
        like_count: 34000,
        comment_count: 8900,
        share_count: 3200,
        author: {
          name: '科技美学',
          avatar_url: 'https://i2.hdslb.com/bfs/face/5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2.jpg',
          follower_count: 156000,
          verified: true
        },
        tags: ['科技', '数码', '推荐', '评测'],
        category: 'technology'
      }
    ];
    
    const categories = ['entertainment', 'education', 'lifestyle', 'food', 'travel', 'technology', 'fashion'];
    const selectedCategory = category && category !== 'all' ? category : categories[Math.floor(Math.random() * categories.length)];
    
    return Array.from({ length: limit }, (_, i) => {
      const sample = sampleVideos[i % sampleVideos.length];
      const baseData = {
        id: `mock_bilibili_${Date.now()}_${i}`,
        platform: 'bilibili',
        title: sample.title,
        description: sample.description,
        thumbnail_url: sample.thumbnail_url,
        video_url: sample.video_url,
        duration: sample.duration,
        view_count: sample.view_count + Math.floor(Math.random() * 10000),
        like_count: sample.like_count + Math.floor(Math.random() * 1000),
        comment_count: sample.comment_count + Math.floor(Math.random() * 500),
        share_count: sample.share_count + Math.floor(Math.random() * 200),
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        author: {
          id: `mock_author_${i}`,
          name: sample.author.name,
          avatar_url: sample.author.avatar_url,
          follower_count: sample.author.follower_count,
          verified: sample.author.verified
        },
        tags: sample.tags,
        category: sample.category,
        trend_score: Math.random() * 100,
        crawled_at: new Date().toISOString(),
        is_real_data: false,
        note: '高质量模拟数据 - 基于真实B站热门视频'
      };
      
      // 如果指定了分类但样本不匹配，调整内容
      if (category && category !== 'all' && sample.category !== category) {
        baseData.category = selectedCategory;
        baseData.tags = [selectedCategory, ...baseData.tags.slice(1)];
      }
      
      return baseData;
    });
  }

  /**
   * 生成buvid3
   */
  private generateBuvid3(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + Date.now().toString(36);
  }

  /**
   * 生成UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 生成模拟搜索视频数据
   */
  private generateMockSearchVideos(keyword: string, page: number, limit: number): any[] {
    logger.info(`[Bilibili] 生成模拟搜索视频数据，关键词: ${keyword}, 页码: ${page}, 数量: ${limit}`);
    
    // 基于搜索关键词生成相关的模拟视频
    const searchSamples = {
      '美食': [
        {
          title: `🔍 ${keyword}：10分钟学会做正宗川菜麻婆豆腐`,
          description: `详细的${keyword}制作教程，从选材到烹饪，每个步骤都讲得很清楚`,
          category: 'food'
        },
        {
          title: `🔍 深夜${keyword}：探店成都最火火锅店`,
          description: `带大家一起探访成都本地人推荐的${keyword}店，味道超正宗`,
          category: 'food'
        }
      ],
      '音乐': [
        {
          title: `🔍 ${keyword}推荐：2024年最火的10首中文歌曲`,
          description: `精选2024年最受欢迎的中文${keyword}，每首都是经典`,
          category: 'entertainment'
        },
        {
          title: `🔍 ${keyword}现场：周杰伦演唱会高清完整版`,
          description: `超清晰的${keyword}现场演出，仿佛身临其境`,
          category: 'entertainment'
        }
      ],
      '科技': [
        {
          title: `🔍 ${keyword}评测：iPhone 15 Pro Max深度体验`,
          description: `全面评测最新的${keyword}产品，告诉你是否值得购买`,
          category: 'technology'
        },
        {
          title: `🔍 ${keyword}新闻：AI人工智能最新发展趋势`,
          description: `解读${keyword}领域的最新动态，把握未来发展`,
          category: 'technology'
        }
      ]
    };
    
    const categories = ['entertainment', 'education', 'lifestyle', 'food', 'travel', 'technology', 'fashion'];
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    
    return Array.from({ length: limit }, (_, i) => {
      let title = `🔍 B站搜索: ${keyword} - 相关视频 ${i + 1}`;
      let description = `与搜索词"${keyword}"相关的B站${selectedCategory}视频内容`;
      let finalCategory = selectedCategory;
      
      // 如果有匹配的搜索样本，使用更真实的标题和描述
      const samples = searchSamples[keyword as keyof typeof searchSamples];
      if (samples && samples.length > 0) {
        const sample = samples[i % samples.length];
        title = sample.title;
        description = sample.description;
        finalCategory = sample.category;
      }
      
      return {
        id: `mock_search_bilibili_${Date.now()}_${i}`,
        platform: 'bilibili',
        title: title,
        description: description,
        thumbnail_url: `https://picsum.photos/320/180?random=search_bilibili${i}`,
        video_url: `https://www.bilibili.com/video/BV${String(i + 1).padStart(2, '0')}SEARCH${String(i).padStart(3, '0')}`,
        duration: Math.floor(Math.random() * 300) + 60,
        view_count: Math.floor(Math.random() * 80000) + 10000,
        like_count: Math.floor(Math.random() * 8000) + 1000,
        comment_count: Math.floor(Math.random() * 800) + 100,
        share_count: Math.floor(Math.random() * 300) + 30,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        author: {
          id: `mock_search_author_${i}`,
          name: `B站${keyword}UP主${i + 1}`,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=search_bilibili${i}`,
          follower_count: Math.floor(Math.random() * 50000) + 5000,
          verified: Math.random() > 0.7
        },
        tags: [keyword, 'B站', '搜索', finalCategory],
        category: finalCategory,
        relevance_score: 80 + Math.random() * 20, // 搜索相关性较高
        crawled_at: new Date().toISOString(),
        is_real_data: false,
        note: '高质量模拟搜索数据 - 基于真实搜索场景'
      };
    }).sort((a, b) => b.relevance_score - a.relevance_score);
  }
}

export default BilibiliCrawlerService;