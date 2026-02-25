// test-exports.js
// test-exports.js
require('dotenv').config(); // ADD THIS LINE

console.log('Testing route exports...');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Loaded' : '❌ Missing'); // Debug line

// ... rest of your code
console.log('Testing route exports...');

try {
  console.log('Testing auth.js export...');
  const authExport = require('./routes/auth.js');
  console.log('✅ auth.js exports:', typeof authExport);
  console.log('   Is function?:', typeof authExport === 'function');
  console.log('   Is router?:', authExport && typeof authExport === 'function' && authExport.name === 'router');
} catch (error) {
  console.error('❌ auth.js ERROR:', error.message);
}

try {
  console.log('Testing postRoutes.js export...');
  const postExport = require('./routes/postRoutes.js');
  console.log('✅ postRoutes.js exports:', typeof postExport);
  console.log('   Is function?:', typeof postExport === 'function');
  console.log('   Is router?:', postExport && typeof postExport === 'function' && postExport.name === 'router');
} catch (error) {
  console.error('❌ postRoutes.js ERROR:', error.message);
}

try {
  console.log('Testing userRoutes.js export...');
  const userExport = require('./routes/userRoutes.js');
  console.log('✅ userRoutes.js exports:', typeof userExport);
  console.log('   Is function?:', typeof userExport === 'function');
  console.log('   Is router?:', userExport && typeof userExport === 'function' && userExport.name === 'router');
} catch (error) {
  console.error('❌ userRoutes.js ERROR:', error.message);
}

try {
  console.log('Testing notifications.js export...');
  const notifExport = require('./routes/notifications.js');
  console.log('✅ notifications.js exports:', typeof notifExport);
  console.log('   Is function?:', typeof notifExport === 'function');
  console.log('   Is router?:', notifExport && typeof notifExport === 'function' && notifExport.name === 'router');
} catch (error) {
  console.error('❌ notifications.js ERROR:', error.message);
}

try {
  console.log('Testing cronRoutes.js export...');
  const cronExport = require('./routes/cronRoutes.js');
  console.log('✅ cronRoutes.js exports:', typeof cronExport);
  console.log('   Is function?:', typeof cronExport === 'function');
  console.log('   Is router?:', cronExport && typeof cronExport === 'function' && cronExport.name === 'router');
} catch (error) {
  console.error('❌ cronRoutes.js ERROR:', error.message);
}

console.log('Test completed!');