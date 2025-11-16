/**
 * 视频处理服务 - 实现二创功能（文案、声音、画面处理）
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

export interface VideoProcessingOptions {
  inputPath: string;
  outputPath: string;
  processingType: string;
  // 文案处理
  transcribe?: boolean;
  translate?: boolean;
  summarize?: boolean;
  targetLanguage?: string;
  // 声音处理
  removeOriginalAudio?: boolean;
  addBackgroundMusic?: boolean;
  backgroundMusicPath?: string;
  adjustAudioVolume?: number;
  // 画面处理
  resizeVideo?: boolean;
  targetResolution?: string;
  addWatermark?: boolean;
  watermarkPath?: string;
  watermarkPosition?: string;
  cropVideo?: boolean;
  cropArea?: string;
  // 特效处理
  addEffects?: boolean;
  effectsType?: string;
  // 字幕处理
  addSubtitles?: boolean;
  subtitleContent?: string;
  subtitleStyle?: string;
}

export interface ProcessingProgress {
  percent: number;
  currentStep: string;
  eta?: string;
}

export interface ProcessingResult {
  success: boolean;
  outputPath?: string;
  metadata?: {
    duration: number;
    resolution: string;
    fileSize: number;
    format: string;
  };
  extractedText?: string;
  translatedText?: string;
  summary?: string;
  error?: string;
}

export class VideoProcessingService {
  private static instance: VideoProcessingService;

  static getInstance(): VideoProcessingService {
    if (!this.instance) {
      this.instance = new VideoProcessingService();
    }
    return this.instance;
  }

  /**
   * 处理视频文件
   */
  async processVideo(
    options: VideoProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    try {
      console.log('🎬 Starting video processing...', options);

      // 确保输出目录存在
      const outputDir = path.dirname(options.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // 验证输入文件
      await this.validateInputFile(options.inputPath);

      let currentStep = 1;
      const totalSteps = this.calculateTotalSteps(options);

      // 步骤1: 转录（如果启用）
      let extractedText = '';
      if (options.transcribe) {
        this.updateProgress(onProgress, currentStep++, totalSteps, '正在转录音频...');
        extractedText = await this.transcribeAudio(options.inputPath);
      }

      // 步骤2: 翻译（如果启用）
      let translatedText = '';
      if (options.translate && extractedText) {
        this.updateProgress(onProgress, currentStep++, totalSteps, '正在翻译文本...');
        translatedText = await this.translateText(extractedText, options.targetLanguage || 'en');
      }

      // 步骤3: 摘要（如果启用）
      let summary = '';
      if (options.summarize && (extractedText || translatedText)) {
        this.updateProgress(onProgress, currentStep++, totalSteps, '正在生成摘要...');
        const textToSummarize = translatedText || extractedText;
        summary = await this.generateSummary(textToSummarize);
      }

      // 步骤4: 视频处理（画面、声音、字幕等）
      this.updateProgress(onProgress, currentStep++, totalSteps, '正在处理视频...');
      const processedPath = await this.processVideoFile(options, onProgress, currentStep, totalSteps);

      // 步骤5: 获取输出文件信息
      this.updateProgress(onProgress, currentStep++, totalSteps, '正在获取文件信息...');
      const metadata = await this.getVideoMetadata(processedPath);

      console.log('✅ Video processing completed successfully');

      return {
        success: true,
        outputPath: processedPath,
        metadata,
        extractedText,
        translatedText,
        summary
      };

    } catch (error) {
      console.error('❌ Video processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * 验证输入文件
   */
  private async validateInputFile(inputPath: string): Promise<void> {
    try {
      const stats = await fs.stat(inputPath);
      if (!stats.isFile()) {
        throw new Error('Input path is not a file');
      }
      
      // 检查文件大小（限制为2GB）
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (stats.size > maxSize) {
        throw new Error('File size exceeds 2GB limit');
      }
    } catch (error) {
      throw new Error(`Invalid input file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 计算总步骤数
   */
  private calculateTotalSteps(options: VideoProcessingOptions): number {
    let steps = 1; // 基础视频处理
    
    if (options.transcribe) steps++;
    if (options.translate) steps++;
    if (options.summarize) steps++;
    if (options.addSubtitles) steps++;
    
    return steps;
  }

  /**
   * 更新进度
   */
  private updateProgress(
    onProgress: ((progress: ProcessingProgress) => void) | undefined,
    currentStep: number,
    totalSteps: number,
    stepName: string
  ): void {
    if (onProgress) {
      const percent = (currentStep / totalSteps) * 100;
      onProgress({
        percent,
        currentStep: stepName,
        eta: `${totalSteps - currentStep} steps remaining`
      });
    }
  }

  /**
   * 转录音频
   */
  private async transcribeAudio(videoPath: string): Promise<string> {
    try {
      // 提取音频
      const audioPath = videoPath.replace(/\.[^/.]+$/, '') + '_audio.wav';
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .output(audioPath)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // 这里应该集成实际的语音识别服务
      // 例如：Whisper API、Google Speech-to-Text、Azure Speech Service等
      // 现在返回模拟文本
      const mockTranscription = "这是一个测试视频的内容转录。视频中包含了丰富的信息和有趣的对话。";
      
      // 清理临时文件
      try {
        await fs.unlink(audioPath);
      } catch (error) {
        console.warn('Failed to delete temporary audio file:', error);
      }

      return mockTranscription;

    } catch (error) {
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 翻译文本
   */
  private async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      // 这里应该集成实际的翻译服务
      // 例如：Google Translate API、DeepL API、Azure Translator等
      // 现在返回模拟翻译
      const mockTranslation = `This is a translated version of the video content. The original Chinese text has been translated to ${targetLanguage}.`;
      
      return mockTranslation;

    } catch (error) {
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 生成摘要
   */
  private async generateSummary(text: string): Promise<string> {
    try {
      // 这里应该集成实际的文本摘要服务
      // 例如：OpenAI GPT、Google Bard、Azure Text Analytics等
      // 现在返回模拟摘要
      const mockSummary = "This video discusses important topics and provides valuable insights in an engaging format.";
      
      return mockSummary;

    } catch (error) {
      throw new Error(`Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理视频文件
   */
  private async processVideoFile(
    options: VideoProcessingOptions,
    onProgress?: (progress: ProcessingProgress) => void,
    currentStep: number = 1,
    totalSteps: number = 1
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(options.inputPath);
      
      // 视频处理步骤
      if (options.resizeVideo && options.targetResolution) {
        const [width, height] = options.targetResolution.split('x').map(Number);
        command.size(`${width}x${height}`);
      }

      if (options.cropVideo && options.cropArea) {
        command.videoFilters(`crop=${options.cropArea}`);
      }

      if (options.addWatermark && options.watermarkPath) {
        const position = options.watermarkPosition || 'top-right';
        command.videoFilters(`overlay=${position}`);
      }

      if (options.removeOriginalAudio) {
        command.noAudio();
      }

      if (options.addBackgroundMusic && options.backgroundMusicPath) {
        // 这里需要更复杂的音频混合逻辑
        // 使用input方法添加音频输入，然后使用complexFilter进行音频混合
        command.input(options.backgroundMusicPath);
      }

      if (options.adjustAudioVolume) {
        command.audioFilters(`volume=${options.adjustAudioVolume}`);
      }

      if (options.addSubtitles && options.subtitleContent) {
        // 创建字幕文件
        const subtitlePath = options.outputPath.replace(/\.[^/.]+$/, '.srt');
        this.createSubtitleFile(subtitlePath, options.subtitleContent);
        command.videoFilters(`subtitles=${subtitlePath}`);
      }

      if (options.addEffects && options.effectsType) {
        // 添加视频特效
        switch (options.effectsType) {
          case 'fade':
            command.videoFilters('fade=in:0:30,fade=out:120:30');
            break;
          case 'blur':
            command.videoFilters('boxblur=2:1');
            break;
          case 'sharpen':
            command.videoFilters('unsharp=5:5:1.0:5:5:0.0');
            break;
        }
      }

      // 输出设置
      command
        .output(options.outputPath)
        .outputFormat('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('progress', (progress) => {
          if (onProgress) {
            const percent = (currentStep - 1 + progress.percent / 100) / totalSteps * 100;
            onProgress({
              percent,
              currentStep: `Processing video: ${Math.round(progress.percent)}%`,
              eta: progress.timemark
            });
          }
        })
        .on('end', () => {
          resolve(options.outputPath);
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });
  }

  /**
   * 创建字幕文件
   */
  private async createSubtitleFile(path: string, content: string): Promise<void> {
    const srtContent = `1
00:00:00,000 --> 00:00:05,000
${content}
`;
    await fs.writeFile(path, srtContent, 'utf8');
  }

  /**
   * 获取视频元数据
   */
  private async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration || 0,
            resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
            fileSize: metadata.format.size || 0,
            format: metadata.format.format_name || 'unknown',
            hasAudio: !!audioStream
          });
        }
      });
    });
  }

  /**
   * 获取支持的格式
   */
  getSupportedFormats(): string[] {
    return ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v'];
  }

  /**
   * 检查文件格式是否支持
   */
  isFormatSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    return this.getSupportedFormats().includes(ext);
  }
}

export const videoProcessingService = VideoProcessingService.getInstance();

export default VideoProcessingService;