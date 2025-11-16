import { WeiboCrawlerService } from './services/socialMonitoring/weiboCrawlerService';

async function testWeiboCrawler() {
  const crawler = new WeiboCrawlerService();
  
  try {
    const testUserId = '7871239944'; // 你要监控的用户ID
    console.log(`Testing Weibo crawler for user ID: ${testUserId}`);
    
    // Test user info fetching
    console.log('Fetching user info...');
    const userInfo = await crawler.getUserInfo(testUserId);
    console.log('User Info:', JSON.stringify(userInfo, null, 2));
    
    // Test posts fetching
    console.log('Fetching recent posts...');
    const posts = await crawler.getAllUserPosts(testUserId, 1);
    console.log('Found', posts.length, 'posts');
    
    if (posts.length > 0) {
      console.log('First post:', JSON.stringify(posts[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWeiboCrawler();