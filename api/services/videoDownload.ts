/**
 * 视频下载服务 - 集成yt-dlp
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface DownloadOptions {
  url: string;
  outputPath: string;
  quality?: string;
  format?: string;
  extractAudio?: boolean;
  renamePattern?: string;
  createFolder?: boolean;
}

export interface DownloadProgress {
  percent: number;
  size: string;
  speed: string;
  eta: string;
  status: string;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  message?: string;
  metadata?: any;
}

export class VideoDownloadService {
  private static instance: VideoDownloadService;

  static getInstance(): VideoDownloadService {
    if (!this.instance) {
      this.instance = new VideoDownloadService();
    }
    return this.instance;
  }

  /**
   * 检查yt-dlp是否可用
   */
  async checkYtDlp(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        const process = spawn('yt-dlp', ['--version']);
        process.on('close', (code) => {
          resolve(code === 0);
        });
        process.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取视频信息
   */
  async getVideoInfo(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = [
        url,
        '--dump-json',
        '--no-warnings',
        '--ignore-errors'
      ];

      const process = spawn('yt-dlp', args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output.trim());
            resolve(info);
          } catch (error) {
            reject(new Error('Failed to parse video info'));
          }
        } else {
          reject(new Error(errorOutput || 'Failed to get video info'));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 下载视频
   */
  async downloadVideo(
    options: DownloadOptions,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<DownloadResult> {
    try {
      // 确保输出目录存在
      await fs.mkdir(options.outputPath, { recursive: true });

      // 构建文件名
      let fileName = options.renamePattern || '%(title)s_%(id)s.%(ext)s';
      fileName = fileName
        .replace('{title}', '%(title)s')
        .replace('{id}', '%(id)s')
        .replace('{uploader}', '%(uploader)s')
        .replace('{duration}', '%(duration)s')
        .replace('{upload_date}', '%(upload_date)s');

      const outputTemplate = path.join(options.outputPath, fileName);

      // 构建yt-dlp参数
      const args = [
        options.url,
        '-o', outputTemplate,
        '--no-warnings',
        '--ignore-errors',
        '--newline'
      ];

      // 质量设置
      if (options.quality) {
        switch (options.quality) {
          case 'highest':
            args.push('-f', 'best');
            break;
          case 'high':
            args.push('-f', 'best[height<=1080]');
            break;
          case 'medium':
            args.push('-f', 'best[height<=720]');
            break;
          case 'low':
            args.push('-f', 'best[height<=480]');
            break;
        }
      }

      // 提取音频
      if (options.extractAudio) {
        args.push('--extract-audio', '--audio-format', 'mp3');
      }

      // 添加进度输出格式
      args.push('--print-traffic');

      return new Promise((resolve, reject) => {
        const process = spawn('yt-dlp', args);
        let lastProgress: DownloadProgress = {
          percent: 0,
          size: '',
          speed: '',
          eta: '',
          status: 'downloading'
        };

        process.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('yt-dlp output:', output);

          // 解析进度信息
          const progressMatch = output.match(/(\d+(?:\.\d+)?)%\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/);
          if (progressMatch) {
            lastProgress = {
              percent: parseFloat(progressMatch[1]),
              size: progressMatch[2],
              speed: progressMatch[3],
              eta: progressMatch[4],
              status: 'downloading'
            };
            if (onProgress) {
              onProgress(lastProgress);
            }
          }
        });

        process.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          console.error('yt-dlp error:', errorOutput);
        });

        process.on('close', async (code) => {
          if (code === 0) {
            try {
              // 获取下载的文件信息
              const files = await fs.readdir(options.outputPath);
              const downloadedFile = files.find(file => 
                file.includes('.mp4') || file.includes('.webm') || 
                file.includes('.mkv') || file.includes('.mp3')
              );

              if (downloadedFile) {
                const filePath = path.join(options.outputPath, downloadedFile);
                resolve({
                  success: true,
                  filePath
                });
              } else {
                resolve({
                  success: true,
                  message: 'Download completed but file not found'
                });
              }
            } catch (error) {
              resolve({
                success: true,
                message: 'Download completed'
              });
            }
          } else {
            reject(new Error(`Download failed with code ${code}`));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * 获取支持的平台列表
   */
  async getSupportedPlatforms(): Promise<string[]> {
    try {
      const process = spawn('yt-dlp', ['--list-extractors']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      return new Promise((resolve) => {
        process.on('close', (code) => {
          if (code === 0) {
            const platforms = output
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('#'));
            resolve(platforms);
          } else {
            resolve([]);
          }
        });
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * 验证URL是否支持
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      await this.getVideoInfo(url);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default VideoDownloadService;