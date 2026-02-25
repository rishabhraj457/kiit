// test-routes.js
console.log('Testing route imports...');

try {
  console.log('Testing auth.js...');
  require('./routes/auth.js');
  console.log('✅ auth.js OK');
} catch (error) {
  console.error('❌ auth.js ERROR:', error.message);
}

try {
  console.log('Testing postRoutes.js...');
  require('./routes/postRoutes.js');
  console.log('✅ postRoutes.js OK');
} catch (error) {
  console.error('❌ postRoutes.js ERROR:', error.message);
}

try {
  console.log('Testing userRoutes.js...');
  require('./routes/userRoutes.js');
  console.log('✅ userRoutes.js OK');
} catch (error) {
  console.error('❌ userRoutes.js ERROR:', error.message);
}

try {
  console.log('Testing notifications.js...');
  require('./routes/notifications.js');
  console.log('✅ notifications.js OK');
} catch (error) {
  console.error('❌ notifications.js ERROR:', error.message);
}

try {
  console.log('Testing cronRoutes.js...');
  require('./routes/cronRoutes.js');
  console.log('✅ cronRoutes.js OK');
} catch (error) {
  console.error('❌ cronRoutes.js ERROR:', error.message);
}

console.log('Test completed!');