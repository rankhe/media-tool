import jwt from 'jsonwebtoken';

// Create a test token for user ID 1
const payload = {
  userId: 1,
  username: '测试用户'
};

const secret = 'your-super-secret-jwt-key-change-this-in-production';
const token = jwt.sign(payload, secret, { expiresIn: '24h' });

console.log('Generated JWT token:');
console.log(token);
console.log('\nUse this token in your API requests:');
console.log(`Authorization: Bearer ${token}`);