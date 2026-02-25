// test-routes-final.js
require('dotenv').config();

console.log('=== FINAL ROUTE TEST ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Loaded' : '❌ Missing');

const testRoute = (name, path) => {
  try {
    console.log(`Testing ${name}...`);
    const route = require(path);
    console.log(`✅ ${name}:`, typeof route);
    return true;
  } catch (error) {
    console.log(`❌ ${name}:`, error.message);
    return false;
  }
};

testRoute('auth.js', './routes/auth.js');
testRoute('postRoutes.js', './routes/postRoutes.js');
testRoute('userRoutes.js', './routes/userRoutes.js');
testRoute('notifications.js', './routes/notifications.js');
testRoute('cronRoutes.js', './routes/cronRoutes.js');