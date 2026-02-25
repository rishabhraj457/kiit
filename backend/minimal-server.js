require('dotenv').config();
console.log('=== MINIMAL SERVER TEST ===');

const express = require('express');
const app = express();

// Only basic test routes - NO imports from your routes
app.get('/test', (req, res) => {
  res.json({ message: 'Minimal server working' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API test working' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
  console.log('If this works, the issue is in your route imports or other dependencies');
});