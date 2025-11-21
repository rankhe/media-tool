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
  platform?: string;
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
  private ytDlpCmd: { cmd: string; baseArgs: string[] } | null = null;

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
    const candidates: Array<{ cmd: string; baseArgs: string[] }> = [];
    const envPath = process.env.YTDLP_PATH;
    if (envPath) candidates.push({ cmd: envPath, baseArgs: [] });
    candidates.push({ cmd: 'yt-dlp', baseArgs: [] });
    candidates.push({ cmd: 'yt-dlp.exe', baseArgs: [] });
    candidates.push({ cmd: 'youtube-dl', baseArgs: [] });
    candidates.push({ cmd: 'python', baseArgs: ['-m', 'yt_dlp'] });
    for (const c of candidates) {
      try {
        const ok = await new Promise<boolean>((resolve) => {
          const p = spawn(c.cmd, [...c.baseArgs, '--version']);
          p.on('close', (code) => resolve(code === 0));
          p.on('error', () => resolve(false));
        });
        if (ok) {
          this.ytDlpCmd = c;
          return true;
        }
      } catch {}
    }
    return false;
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
        '--ignore-errors',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ];

      const cmd = this.ytDlpCmd || { cmd: 'yt-dlp', baseArgs: [] };
      const process = spawn(cmd.cmd, [...cmd.baseArgs, ...args]);
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
            const lines = output.trim().split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
              try {
                const obj = JSON.parse(line);
                if (obj) return resolve(obj);
              } catch {}
            }
            throw new Error('No JSON info parsed');
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
        '--newline',
        '--verbose'
      ];

      // 基础UA
      args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // 平台特定头（提升站点兼容性）
      const browser = process.env.YTDLP_BROWSER || 'chrome';
      const profile = process.env.YTDLP_PROFILE ? `:${process.env.YTDLP_PROFILE}` : '';
      if (options.platform === 'bilibili') {
        args.push('--add-header', 'Referer:https://www.bilibili.com/');
        args.push('--add-header', 'Accept-Language: zh-CN,zh;q=0.9');
        args.push('--cookies-from-browser', `${browser}${profile}`);
        args.push('--no-check-certificate');
      }
      if (options.platform === 'douyin') {
        args.push('--add-header', 'Referer:https://www.douyin.com/');
        args.push('--add-header', 'Accept-Language: zh-CN,zh;q=0.9');
        args.push('--cookies-from-browser', `${browser}${profile}`);
      }
      if (options.platform === 'xiaohongshu') {
        args.push('--add-header', 'Referer:https://www.xiaohongshu.com/');
        args.push('--add-header', 'Accept-Language: zh-CN,zh;q=0.9');
        args.push('--cookies-from-browser', `${browser}${profile}`);
      }

      // 质量设置（优先选择分离视频+音频，带回退）
      if (options.quality) {
        switch (options.quality) {
          case 'highest':
            args.push('-f', 'bv*+ba/best');
            break;
          case 'high':
            args.push('-f', 'bv*[height<=1080]+ba/best');
            break;
          case 'medium':
            args.push('-f', 'bv*[height<=720]+ba/best');
            break;
          case 'low':
            args.push('-f', 'bv*[height<=480]+ba/best');
            break;
        }
      } else {
        args.push('-f', 'bv*+ba/best');
      }

      // 合并输出格式
      args.push('--merge-output-format', 'mp4');

      // 提取音频
      if (options.extractAudio) {
        args.push('--extract-audio', '--audio-format', 'mp3');
      }

      // 添加进度输出格式
      args.push('--print-traffic');

      return new Promise((resolve, reject) => {
        const cmd = this.ytDlpCmd || { cmd: 'yt-dlp', baseArgs: [] };
        const process = spawn(cmd.cmd, [...cmd.baseArgs, ...args]);
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

        let errorOutputAll = '';
        process.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          errorOutputAll += errorOutput;
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
            const needRetryWithoutCookies = /Could not copy Chrome cookie database|PermissionError/i.test(errorOutputAll);
            if (needRetryWithoutCookies) {
              const base = [...args];
              const idx = base.findIndex(a => a === '--cookies-from-browser');
              if (idx !== -1) {
                base.splice(idx, 2);
              }
              const retryProc = spawn(cmd.cmd, [...cmd.baseArgs, ...base]);
              let retryErr = '';
              retryProc.stdout.on('data', (data) => {
                const output = data.toString();
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
              retryProc.stderr.on('data', (data) => {
                retryErr += data.toString();
                console.error('yt-dlp error:', data.toString());
              });
              retryProc.on('close', async (rcode) => {
                if (rcode === 0) {
                  try {
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
                  reject(new Error(`yt-dlp error (code ${rcode}): ${retryErr.trim() || 'unknown'}`));
                }
              });
            } else {
              reject(new Error(`yt-dlp error (code ${code}): ${errorOutputAll.trim() || 'unknown'}`));
            }
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
      const cmd = this.ytDlpCmd || { cmd: 'yt-dlp', baseArgs: [] };
      const process = spawn(cmd.cmd, [...cmd.baseArgs, '--list-extractors']);
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