const { WeiboCrawlerService } = require('./dist/services/socialMonitoring/weiboCrawlerService');

async function testWeiboCrawler() {
  const crawler = new WeiboCrawlerService();
  
  try {
    console.log('Testing Weibo crawler for user ID: 1669879400');
    
    // Test user info fetching
    console.log('Fetching user info...');
    const userInfo = await crawler.getUserInfo('1669879400');
    console.log('User Info:', JSON.stringify(userInfo, null, 2));
    
    // Test posts fetching
    console.log('Fetching recent posts...');
    const posts = await crawler.getAllUserPosts('1669879400', 1);
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