import fetch from 'node-fetch';

async function testRealDataPulling() {
  console.log('=== 测试真实数据拉取功能 ===');
  
  try {
    // 测试后端API是否返回真实数据
    console.log('\n1. 测试后端热门视频API...');
    
    const response = await fetch('http://localhost:3001/api/videos/trending?platform=bilibili&limit=3', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE4MDAwMDAwMDB9.test'
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.videos) {
      console.log('✅ 后端API响应成功，视频数量:', data.data.videos.length);
      
      data.data.videos.forEach((video, index) => {
        console.log(`\n视频 ${index + 1}:`);
        console.log('- 标题:', video.title);
        console.log('- 平台:', video.platform);
        console.log('- 是否真实数据:', video.is_real_data ? '✅ 是' : '❌ 否');
        console.log('- 播放量:', video.view_count);
        console.log('- 作者:', video.author.name);
        console.log('- 视频链接:', video.video_url);
        console.log('- 缩略图:', video.thumbnail_url);
        
        if (video.is_real_data) {
          console.log('- ✅ 这是从B站拉取的真实数据！');
        } else {
          console.log('- ⚠️  这是模拟数据');
        }
      });
      
      // 检查是否至少有一个真实数据
      const realVideos = data.data.videos.filter(v => v.is_real_data);
      console.log(`\n📊 统计: ${realVideos.length}/${data.data.videos.length} 是真实数据`);
      
      if (realVideos.length > 0) {
        console.log('🎉 成功！系统正在拉取B站真实数据');
      } else {
        console.log('⚠️  当前返回的是模拟数据，但系统已配置为优先使用真实数据');
      }
      
    } else {
      console.log('❌ 后端API响应失败:', data.message);
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('请确保后端服务器正在运行...');
  }
}

// 运行测试
testRealDataPulling().then(() => {
  console.log('\n=== 测试完成 ===');
}).catch(err => {
  console.error('测试错误:', err);
});