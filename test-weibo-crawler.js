/**
 * Test script for Weibo crawler fixes
 */
const axios = require('axios');

// Test the Weibo crawler with Xiaomi Car user ID
const testWeiboCrawler = async () => {
  console.log('Testing Weibo crawler fixes for Xiaomi Car (2803301701)...');
  
  try {
    // Test 1: User lookup
    console.log('\n1. Testing user lookup...');
    const userLookupResponse = await axios.get('http://localhost:3002/api/monitoring/users/lookup/weibo/2803301701', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    console.log('User lookup result:', userLookupResponse.data);
  } catch (error) {
    console.error('User lookup error:', error.response?.data || error.message);
  }
  
  try {
    // Test 2: Add monitoring user
    console.log('\n2. Testing add monitoring user...');
    const addUserResponse = await axios.post('http://localhost:3002/api/monitoring/users', {
      platform: 'weibo',
      target_user_id: '2803301701',
      target_username: '小米汽车',
      category: 'automotive',
      check_frequency_minutes: 60
    }, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    console.log('Add user result:', addUserResponse.data);
  } catch (error) {
    console.error('Add user error:', error.response?.data || error.message);
  }
  
  try {
    // Test 3: Fetch posts
    console.log('\n3. Testing post fetching...');
    const fetchPostsResponse = await axios.post('http://localhost:3002/api/monitoring/users/1/fetch-posts', {
      days_back: 7
    }, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    console.log('Fetch posts result:', fetchPostsResponse.data);
  } catch (error) {
    console.error('Fetch posts error:', error.response?.data || error.message);
  }
};

// Run the test
testWeiboCrawler().catch(console.error);