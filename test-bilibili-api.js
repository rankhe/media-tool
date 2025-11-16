import fetch from 'node-fetch';

async function testBilibiliAPI() {
  console.log('=== 测试Bilibili API真实数据拉取 ===');
  
  try {
    // 测试热门视频API
    console.log('\n1. 测试热门视频API...');
    const trendingUrl = 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all';
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cookie': 'buvid3=TEST123456789; _uuid=test-uuid-123456;'
    };
    
    const trendingResponse = await fetch(trendingUrl, { headers });
    const trendingData = await trendingResponse.json();
    
    console.log('热门视频API响应状态:', trendingResponse.status);
    console.log('热门视频API返回码:', trendingData.code);
    console.log('热门视频API消息:', trendingData.message);
    
    if (trendingData.code === 0 && trendingData.data && trendingData.data.list) {
      console.log('✅ 成功获取热门视频，数量:', trendingData.data.list.length);
      const firstVideo = trendingData.data.list[0];
      if (firstVideo) {
        console.log('第一个热门视频:');
        console.log('- 标题:', firstVideo.title);
        console.log('- 作者:', firstVideo.owner?.name);
        console.log('- 播放量:', firstVideo.view);
        console.log('- 点赞数:', firstVideo.like);
        console.log('- 视频链接:', `https://www.bilibili.com/video/${firstVideo.bvid}`);
      }
    } else {
      console.log('❌ 无法获取热门视频，返回模拟数据');
    }
    
    // 测试搜索API
    console.log('\n2. 测试搜索API...');
    const searchKeyword = '美食';
    const searchUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(searchKeyword)}&page=1&pagesize=5`;
    
    const searchResponse = await fetch(searchUrl, { headers });
    const searchData = await searchResponse.json();
    
    console.log('搜索API响应状态:', searchResponse.status);
    console.log('搜索API返回码:', searchData.code);
    console.log('搜索API消息:', searchData.message);
    
    if (searchData.code === 0 && searchData.data && searchData.data.result) {
      console.log('✅ 成功搜索到视频，数量:', searchData.data.result.length);
      const firstSearchVideo = searchData.data.result[0];
      if (firstSearchVideo) {
        console.log('第一个搜索结果:');
        console.log('- 标题:', firstSearchVideo.title);
        console.log('- 作者:', firstSearchVideo.author);
        console.log('- 播放量:', firstSearchVideo.play);
        console.log('- 点赞数:', firstSearchVideo.like);
      }
    } else {
      console.log('❌ 无法搜索视频，返回模拟数据');
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testBilibiliAPI().then(() => {
  console.log('\n=== 测试完成 ===');
}).catch(err => {
  console.error('测试错误:', err);
});