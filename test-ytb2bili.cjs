async function loadServices() {
  const { default: VideoDownloadService } = await import('./api/services/videoDownload.js')
  const { videoPublishService } = await import('./api/services/videoPublish.js')
  const { videoProcessingService } = await import('./api/services/videoProcessing.js')
  return { VideoDownloadService, videoPublishService, videoProcessingService }
}

async function main() {
  const youtubeUrl = process.env.TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  console.log('=== 测试 YouTube 到 B站 发布流程 ===');

  const { VideoDownloadService, videoPublishService } = await loadServices()
  const dl = VideoDownloadService.getInstance();
  const ok = await dl.checkYtDlp();
  if (!ok) {
    console.error('未检测到 yt-dlp，请安装后重试');
    process.exit(1);
  }

  console.log('\n1) 下载 YouTube 视频: ', youtubeUrl);
  const dlResult = await dl.downloadVideo({
    url: youtubeUrl,
    outputPath: './downloads',
    quality: 'medium',
    platform: 'youtube',
    renamePattern: '{title}_{id}',
    downloadSubtitles: true,
    subtitleLangs: ['en','zh-Hans'],
    embedSubtitles: false,
    createFolder: true,
  });

  if (!dlResult.success || !dlResult.filePath) {
    console.error('下载失败: ', dlResult.error);
    process.exit(1);
  }

  console.log('下载完成: ', dlResult.filePath);

  console.log('\n2) 可选处理（跳过）');
  const finalPath = dlResult.filePath;

  console.log('\n3) 发布到 B站（模拟）');
  const pub = await videoPublishService.publishVideo({
    videoPath: finalPath,
    platform: 'bilibili',
    accountId: 'test-account',
    title: '测试发布：YouTube到B站',
    description: '由自动化脚本生成的示例发布',
    tags: ['demo','ytb2bili'],
    visibility: 'public',
  });

  console.log('发布结果: ', pub);
}

main().catch(err => {
  console.error('运行失败: ', err);
  process.exit(1);
});