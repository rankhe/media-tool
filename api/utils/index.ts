import jwt, { Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

// JWT工具函数
export const jwtUtils = {
  generateToken(payload: any): string {
    return jwt.sign(payload, env.jwt.secret as Secret, { expiresIn: '7d' });
  },

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, env.jwt.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  },

  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided');
    }
    return authHeader.substring(7);
  }
};

// 密码工具函数
export const passwordUtils = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  },

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
};

// ID生成工具
export const idUtils = {
  generateUUID(): string {
    return uuidv4();
  },

  generateShortId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

// 响应工具函数
export const responseUtils = {
  success(data: any, message = 'Success') {
    return {
      success: true,
      message,
      data
    };
  },

  error(message = 'Error', code = 'ERROR', statusCode = 400) {
    return {
      success: false,
      error: {
        message,
        code,
        statusCode
      }
    };
  },

  paginated(data: any[], total: number, page: number, limit: number) {
    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
};

// 文件工具函数
export const fileUtils = {
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },

  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  },

  generateUniqueFilename(originalName: string): string {
    const ext = this.getFileExtension(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}.${ext}`;
  }
};

// 时间工具函数
export const timeUtils = {
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },

  formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  },

  addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }
};

// 验证工具函数
export const validationUtils = {
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  isValidVideoPlatform(url: string): boolean {
    const supportedPlatforms = [
      'douyin.com',
      'kuaishou.com',
      'xiaohongshu.com',
      'bilibili.com',
      'weixin.qq.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return supportedPlatforms.some(platform => urlObj.hostname.includes(platform));
    } catch {
      return false;
    }
  }
};