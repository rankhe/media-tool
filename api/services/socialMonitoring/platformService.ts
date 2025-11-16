import axios from 'axios';
import { logger } from '../../utils/logger';
import { Pool } from 'pg';
import { WeiboCrawlerService } from './weiboCrawlerService';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'media_tool',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export interface PlatformUserInfo {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  verified: boolean;
  bio: string;
}

export interface PlatformPost {
  postId: string;
  postUrl: string;
  postType: 'text' | 'image' | 'video' | 'mixed';
  content: string;
  images: string[];
  videos: string[];
  publishedAt: Date;
  metadata: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
}

export class PlatformService {
  
  async getPlatformConfig(platform: string): Promise<any> {
    try {
      const result = await pool.query(
        'SELECT * FROM social_monitoring_platforms WHERE platform_name = $1 AND is_active = true',
        [platform]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Platform ${platform} not configured or inactive`);
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching platform config:', error);
      throw error;
    }
  }
  
  async getUserInfo(platform: string, userId: string): Promise<PlatformUserInfo | null> {
    try {
      const config = await this.getPlatformConfig(platform);
      
      switch (platform) {
        case 'weibo':
          return await this.getWeiboUserInfo(config, userId);
        case 'x_twitter':
          return await this.getTwitterUserInfo(config, userId);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      logger.error(`Error fetching user info for ${platform}:`, error);
      return null;
    }
  }
  
  async getUserPosts(platform: string, userId: string, sincePostId?: string, daysBack?: number): Promise<PlatformPost[]> {
    try {
      const config = await this.getPlatformConfig(platform);
      
      switch (platform) {
        case 'weibo':
          return await this.getWeiboUserPosts(config, userId, sincePostId, daysBack);
        case 'x_twitter':
          return await this.getTwitterUserPosts(config, userId, sincePostId, daysBack);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      logger.error(`Error fetching user posts for ${platform}:`, error);
      return [];
    }
  }
  
  private async getWeiboUserInfo(config: any, userId: string): Promise<PlatformUserInfo> {
    try {
      logger.info(`Fetching Weibo user info for userId: ${userId}`);
      
      // Use the enhanced Weibo crawler service
      const weiboCrawler = new WeiboCrawlerService();
      
      try {
        // Try enhanced user info fetching first (no API credentials required)
        const userInfo = await weiboCrawler.getUserInfoEnhanced(userId);
        
        logger.info(`Successfully fetched Weibo user: ${userInfo.username} (${userInfo.userId})`);
        
        return {
          userId: userInfo.userId,
          username: userInfo.username,
          displayName: userInfo.displayName,
          avatarUrl: userInfo.avatarUrl,
          followerCount: userInfo.followerCount,
          verified: userInfo.verified,
          bio: userInfo.bio
        };
      } catch (crawlerError) {
        logger.warn(`Enhanced Weibo crawler failed for user ${userId}, trying standard crawler:`, crawlerError);
        
        // Fallback to standard crawler
        try {
          const userInfo = await weiboCrawler.getUserInfo(userId);
          
          logger.info(`Successfully fetched Weibo user with standard crawler: ${userInfo.username} (${userInfo.userId})`);
          
          return {
            userId: userInfo.userId,
            username: userInfo.username,
            displayName: userInfo.displayName,
            avatarUrl: userInfo.avatarUrl,
            followerCount: userInfo.followerCount,
            verified: userInfo.verified,
            bio: userInfo.bio
          };
        } catch (standardError) {
          logger.warn(`Standard Weibo crawler also failed for user ${userId}:`, standardError);
          
          // Only try API if we have credentials
          if (!config.access_token && !config.api_key) {
            logger.info(`No API credentials configured, using fallback data for user ${userId}`);
            
            // Create basic user info from userId and target_username if available
            return {
              userId: userId,
              username: `weibo_user_${userId.slice(-6)}`,
              displayName: `微博用户_${userId.slice(-4)}`,
              avatarUrl: '',
              followerCount: 0,
              verified: false,
              bio: ''
            };
          }
          
          // Try traditional API as last resort if we have credentials
          logger.info(`Trying Weibo API for user ${userId} with configured credentials`);
          
          const response = await axios.get(`${config.api_base_url}/users/show.json`, {
            params: {
              uid: userId,
              access_token: config.access_token
            },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            },
            timeout: 10000
          });
          
          const user = response.data;
          
          if (!user || !user.id_str) {
            throw new Error('Invalid user data returned from Weibo API');
          }
          
          return {
            userId: user.id_str,
            username: user.screen_name,
            displayName: user.name,
            avatarUrl: user.avatar_large || user.profile_image_url,
            followerCount: user.followers_count || 0,
            verified: user.verified || false,
            bio: user.description || ''
          };
        }
      }
    } catch (error) {
      logger.error(`Error fetching Weibo user info for ${userId}:`, error);
      
      // Return basic user info as ultimate fallback
      return {
        userId: userId,
        username: `weibo_user_${userId.slice(-6)}`,
        displayName: `微博用户_${userId.slice(-4)}`,
        avatarUrl: '',
        followerCount: 0,
        verified: false,
        bio: ''
      };
    }
  }
  
  private async getWeiboUserPosts(config: any, userId: string, sincePostId?: string, daysBack?: number): Promise<PlatformPost[]> {
    try {
      // Use the enhanced Weibo crawler service
      const weiboCrawler = new WeiboCrawlerService();
      
      try {
        // If we have a sincePostId, fetch recent posts and filter
        let posts;
        if (daysBack) {
          // Fetch posts from specified number of days back
          logger.info(`Fetching posts from last ${daysBack} days for user ${userId}`);
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);
          posts = await weiboCrawler.getUserPostsByDateRange(userId, startDate, new Date());
        } else if (sincePostId) {
          logger.info(`Fetching posts since post ID: ${sincePostId} for user ${userId}`);
          posts = await weiboCrawler.getUserPosts(userId, sincePostId);
        } else {
          // Fetch recent posts (first 2 pages)
          logger.info(`Fetching recent posts for user ${userId}`);
          posts = await weiboCrawler.getAllUserPosts(userId, 2);
        }
        
        logger.info(`Successfully fetched ${posts.length} posts for user ${userId}`);
        
        return posts.map((post: any) => ({
          postId: post.postId,
          postUrl: post.postUrl,
          postType: this.getEnhancedWeiboPostType(post),
          content: post.content,
          images: post.pics ? post.pics.map((pic: any) => pic.large?.url || pic.url) : [],
          videos: this.extractWeiboVideos(post),
          publishedAt: post.createdAt,
          metadata: {
            likes: post.attitudesCount,
            shares: post.repostsCount,
            comments: post.commentsCount,
            views: 0
          }
        }));
      } catch (crawlerError) {
        logger.warn(`Weibo crawler failed for posts of user ${userId}, trying fallback API:`, crawlerError);
        
        // Fallback to traditional API if crawler fails
        if (!config.access_token) {
          throw new Error('Weibo access token not configured and crawler failed');
        }
        
        const params: any = {
          uid: userId,
          access_token: config.access_token,
          count: 50
        };
        
        // Add date range filtering if daysBack is specified
        if (daysBack) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);
          params.since = Math.floor(startDate.getTime() / 1000);
        } else if (sincePostId) {
          params.since_id = sincePostId;
        }
        
        const response = await axios.get(`${config.api_base_url}/statuses/user_timeline`, {
          params: params,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const statuses = response.data.statuses || [];
        
        return statuses.map((status: any) => ({
          postId: status.id_str,
          postUrl: `https://weibo.com/${userId}/${status.bid}`,
          postType: this.getWeiboPostType(status),
          content: status.text,
          images: status.pic_urls ? status.pic_urls.map((pic: any) => pic.thumbnail_pic) : [],
          videos: status.page_info && status.page_info.type === 'video' ? [status.page_info.media_info?.stream_url] : [],
          publishedAt: new Date(status.created_at),
          metadata: {
            likes: status.attitudes_count,
            shares: status.reposts_count,
            comments: status.comments_count
          }
        }));
      }
    } catch (error) {
      logger.error('Error fetching Weibo user posts:', error);
      throw error;
    }
  }
  
  private getWeiboPostType(status: any): 'text' | 'image' | 'video' | 'mixed' {
    const hasText = status.text && status.text.length > 0;
    const hasImages = status.pic_urls && status.pic_urls.length > 0;
    const hasVideo = status.page_info && status.page_info.type === 'video';
    
    if (hasVideo) return 'video';
    if (hasImages && hasText) return 'mixed';
    if (hasImages) return 'image';
    return 'text';
  }

  private getEnhancedWeiboPostType(post: any): 'text' | 'image' | 'video' | 'mixed' {
    const hasText = post.content && post.content.length > 0;
    const hasImages = post.pics && post.pics.length > 0;
    const hasVideo = post.pageInfo && post.pageInfo.type === 'video';
    
    if (hasVideo) return 'video';
    if (hasImages && hasText) return 'mixed';
    if (hasImages) return 'image';
    return 'text';
  }

  private extractWeiboVideos(post: any): string[] {
    const videos = [];
    
    // Check page_info for video
    if (post.pageInfo && post.pageInfo.type === 'video' && post.pageInfo.media_info) {
      const mediaInfo = post.pageInfo.media_info;
      
      // Prefer HD video URL, fallback to stream_url
      if (mediaInfo.mp4_hd_url) {
        videos.push(mediaInfo.mp4_hd_url);
      } else if (mediaInfo.stream_url) {
        videos.push(mediaInfo.stream_url);
      } else if (mediaInfo.stream_url_hd) {
        videos.push(mediaInfo.stream_url_hd);
      }
    }
    
    // Check for Live Photo videos
    if (post.pics) {
      post.pics.forEach((pic: any) => {
        if (pic.type === 'video' && pic.videoSrc) {
          videos.push(pic.videoSrc);
        }
      });
    }
    
    return videos;
  }
  
  private async getTwitterUserInfo(config: any, userId: string): Promise<PlatformUserInfo> {
    try {
      // Twitter API v2 endpoint for user info
      const response = await axios.get(`${config.api_base_url}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const user = response.data.data;
      
      return {
        userId: user.id,
        username: user.username,
        displayName: user.name,
        avatarUrl: user.profile_image_url,
        followerCount: user.public_metrics?.followers_count || 0,
        verified: user.verified || false,
        bio: user.description || ''
      };
    } catch (error) {
      logger.error('Error fetching Twitter user info:', error);
      throw error;
    }
  }
  
  private async getTwitterUserPosts(config: any, userId: string, sincePostId?: string, daysBack?: number): Promise<PlatformPost[]> {
    try {
      // Twitter API v2 endpoint for user tweets
      const params: any = {
        max_results: 50,
        'tweet.fields': 'created_at,public_metrics,attachments,text',
        'media.fields': 'url,type',
        'expansions': 'attachments.media_keys'
      };
      
      // Add date range filtering if daysBack is specified
      if (daysBack) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        params.start_time = startDate.toISOString();
      } else if (sincePostId) {
        params.since_id = sincePostId;
      }
      
      const response = await axios.get(`${config.api_base_url}/users/${userId}/tweets`, {
        params: params,
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const tweets = response.data.data || [];
      const media = response.data.includes?.media || [];
      
      return tweets.map((tweet: any) => {
        const mediaUrls = this.extractTwitterMediaUrls(tweet, media);
        
        return {
          postId: tweet.id,
          postUrl: `https://twitter.com/i/web/status/${tweet.id}`,
          postType: this.getTwitterPostType(tweet, mediaUrls),
          content: tweet.text,
          images: mediaUrls.filter(m => m.type === 'photo').map(m => m.url),
          videos: mediaUrls.filter(m => m.type === 'video').map(m => m.url),
          publishedAt: new Date(tweet.created_at),
          metadata: {
            likes: tweet.public_metrics?.like_count,
            shares: tweet.public_metrics?.retweet_count,
            comments: tweet.public_metrics?.reply_count
          }
        };
      });
    } catch (error) {
      logger.error('Error fetching Twitter user posts:', error);
      throw error;
    }
  }
  
  private extractTwitterMediaUrls(tweet: any, media: any[]): any[] {
    if (!tweet.attachments?.media_keys) return [];
    
    return tweet.attachments.media_keys.map((key: string) => {
      const mediaItem = media.find(m => m.media_key === key);
      return mediaItem ? {
        url: mediaItem.url,
        type: mediaItem.type
      } : null;
    }).filter(Boolean);
  }
  
  private getTwitterPostType(tweet: any, mediaUrls: any[]): 'text' | 'image' | 'video' | 'mixed' {
    const hasText = tweet.text && tweet.text.length > 0;
    const hasImages = mediaUrls.some(m => m.type === 'photo');
    const hasVideos = mediaUrls.some(m => m.type === 'video');
    
    if (hasVideos) return 'video';
    if (hasImages && hasText) return 'mixed';
    if (hasImages) return 'image';
    return 'text';
  }
}

export const platformService = new PlatformService();