import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface WebhookConfig {
  id: number;
  webhook_type: 'feishu' | 'wechat_work' | 'dingtalk' | 'custom';
  webhook_url: string;
  webhook_secret?: string;
  webhook_headers?: Record<string, string>;
  message_template?: string;
}

export interface PostData {
  platform: string;
  platform_label: string;
  target_username: string;
  target_display_name: string;
  post_id: string;
  post_url: string;
  post_type: string;
  post_content: string;
  post_images: string[];
  post_videos: string[];
  published_at: Date;
  metadata: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
}

export class WebhookService {
  
  async testWebhook(webhookConfig: WebhookConfig): Promise<{success: boolean; message: string; response?: any}> {
    try {
      const testPost: PostData = {
        platform: 'weibo',
        platform_label: 'Weibo',
        target_username: 'test_user',
        target_display_name: 'Test User',
        post_id: 'test_post_id',
        post_url: 'https://example.com/test',
        post_type: 'text',
        post_content: 'This is a test notification from social media monitoring system.',
        post_images: [],
        post_videos: [],
        published_at: new Date(),
        metadata: {
          likes: 10,
          shares: 5,
          comments: 3
        }
      };
      
      const result = await this.sendNotification(webhookConfig, testPost);
      return {
        success: true,
        message: 'Webhook test successful',
        response: result
      };
    } catch (error) {
      logger.error('Webhook test failed:', error);
      return {
        success: false,
        message: `Webhook test failed: ${error.message}`
      };
    }
  }
  
  async sendNotification(webhookConfig: WebhookConfig, postData: PostData): Promise<any> {
    try {
      let messagePayload: any;
      
      switch (webhookConfig.webhook_type) {
        case 'feishu':
          messagePayload = this.buildFeishuMessage(postData, webhookConfig.message_template);
          break;
        case 'wechat_work':
          messagePayload = this.buildWechatWorkMessage(postData, webhookConfig.message_template);
          break;
        case 'dingtalk':
          messagePayload = this.buildDingTalkMessage(postData, webhookConfig.message_template);
          break;
        case 'custom':
          messagePayload = this.buildCustomMessage(postData, webhookConfig.message_template);
          break;
        default:
          throw new Error(`Unsupported webhook type: ${webhookConfig.webhook_type}`);
      }
      
      const headers = {
        'Content-Type': 'application/json',
        ...webhookConfig.webhook_headers
      };
      
      // Add signature if webhook secret is configured
      if (webhookConfig.webhook_secret) {
        const signature = this.generateSignature(JSON.stringify(messagePayload), webhookConfig.webhook_secret);
        headers['X-Webhook-Signature'] = signature;
      }
      
      const response = await axios.post(webhookConfig.webhook_url, messagePayload, {
        headers,
        timeout: 10000 // 10 second timeout
      });
      
      logger.info(`Webhook notification sent successfully to ${webhookConfig.webhook_type}`, {
        webhookId: webhookConfig.id,
        postId: postData.post_id,
        status: response.status
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to send webhook notification to ${webhookConfig.webhook_type}:`, error);
      throw error;
    }
  }
  
  private buildFeishuMessage(postData: PostData, customTemplate?: string): any {
    if (customTemplate) {
      const content = this.applyMessageTemplate(customTemplate, postData);
      return {
        msg_type: 'text',
        content: {
          text: content
        }
      };
    }
    
    // Default Feishu message format
    return {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: `${postData.target_display_name} (@${postData.target_username}) - ${postData.platform_label}`,
            content: [
              [
                {
                  tag: 'text',
                  text: `Content: ${postData.post_content}\n`
                }
              ],
              [
                {
                  tag: 'text',
                  text: `Type: ${postData.post_type}\n`
                }
              ],
              [
                {
                  tag: 'text',
                  text: `Published: ${this.formatDate(postData.published_at)}\n`
                }
              ],
              [
                {
                  tag: 'text',
                  text: `Likes: ${postData.metadata.likes || 0}, Shares: ${postData.metadata.shares || 0}, Comments: ${postData.metadata.comments || 0}\n`
                }
              ],
              [
                {
                  tag: 'a',
                  text: 'View Post',
                  href: postData.post_url
                }
              ]
            ]
          }
        }
      }
    };
  }
  
  private buildWechatWorkMessage(postData: PostData, customTemplate?: string): any {
    if (customTemplate) {
      const content = this.applyMessageTemplate(customTemplate, postData);
      return {
        msgtype: 'text',
        text: {
          content: content
        }
      };
    }
    
    // Default WeChat Work message format
    return {
      msgtype: 'markdown',
      markdown: {
        content: `## ${postData.target_display_name} (@${postData.target_username}) - ${postData.platform_label}\n\n` +
                `**Content:** ${postData.post_content}\n\n` +
                `**Type:** ${postData.post_type}\n\n` +
                `**Published:** ${this.formatDate(postData.published_at)}\n\n` +
                `**Engagement:** 👍${postData.metadata.likes || 0} 🔁${postData.metadata.shares || 0} 💬${postData.metadata.comments || 0}\n\n` +
                `[View Post](${postData.post_url})`
      }
    };
  }
  
  private buildDingTalkMessage(postData: PostData, customTemplate?: string): any {
    if (customTemplate) {
      const content = this.applyMessageTemplate(customTemplate, postData);
      return {
        msgtype: 'text',
        text: {
          content: content
        }
      };
    }
    
    // Default DingTalk message format
    return {
      msgtype: 'markdown',
      markdown: {
        title: 'Social Media Update',
        text: `#### ${postData.target_display_name} (@${postData.target_username}) - ${postData.platform_label}\n\n` +
              `> **Content:** ${postData.post_content}\n\n` +
              `> **Type:** ${postData.post_type}\n\n` +
              `> **Published:** ${this.formatDate(postData.published_at)}\n\n` +
              `> **Engagement:** 👍${postData.metadata.likes || 0} 🔁${postData.metadata.shares || 0} 💬${postData.metadata.comments || 0}\n\n` +
              `> [View Post](${postData.post_url})`
      }
    };
  }
  
  private buildCustomMessage(postData: PostData, customTemplate?: string): any {
    if (customTemplate) {
      return {
        content: this.applyMessageTemplate(customTemplate, postData)
      };
    }
    
    // Default custom message format
    return {
      platform: postData.platform,
      platform_label: postData.platform_label,
      user: {
        username: postData.target_username,
        display_name: postData.target_display_name
      },
      post: {
        id: postData.post_id,
        url: postData.post_url,
        type: postData.post_type,
        content: postData.post_content,
        images: postData.post_images,
        videos: postData.post_videos,
        published_at: postData.published_at,
        metadata: postData.metadata
      }
    };
  }
  
  private applyMessageTemplate(template: string, postData: PostData): string {
    return template
      .replace(/\{\{platform\}\}/g, postData.platform)
      .replace(/\{\{platform_label\}\}/g, postData.platform_label)
      .replace(/\{\{target_username\}\}/g, postData.target_username)
      .replace(/\{\{target_display_name\}\}/g, postData.target_display_name)
      .replace(/\{\{post_id\}\}/g, postData.post_id)
      .replace(/\{\{post_url\}\}/g, postData.post_url)
      .replace(/\{\{post_type\}\}/g, postData.post_type)
      .replace(/\{\{post_content\}\}/g, postData.post_content)
      .replace(/\{\{published_at\}\}/g, this.formatDate(postData.published_at))
      .replace(/\{\{likes\}\}/g, String(postData.metadata.likes || 0))
      .replace(/\{\{shares\}\}/g, String(postData.metadata.shares || 0))
      .replace(/\{\{comments\}\}/g, String(postData.metadata.comments || 0))
      .replace(/\{\{views\}\}/g, String(postData.metadata.views || 0));
  }
  
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
  
  private formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export const webhookService = new WebhookService();