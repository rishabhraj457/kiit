require('dotenv').config(); // MUST BE FIRST

console.log('Server file is being executed!');

// DEBUG ENV CHECK
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Loaded' : '❌ Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ Missing');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Loaded' : '❌ Missing');
console.log('====================================');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const { passport } = require('./config/passport-setup');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= CLOUDINARY ================= */
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured');
} catch (error) {
  console.warn('⚠️ Cloudinary configuration failed:', error.message);
}

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'startup-showcase-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(passport.initialize());
app.use(passport.session());

/* ================= ROUTES ================= */

const loadRoute = (name, routePath, mountPath) => {
  try {
    const route = require(routePath);
    app.use(mountPath, route);
    console.log(`✅ ${name} loaded`);
  } catch (err) {
    console.error(`❌ Failed loading ${name}:`, err.message);
  }
};

loadRoute('Auth routes', './routes/auth.js', '/api/auth');
loadRoute('Post routes', './routes/postRoutes.js', '/api/posts');
loadRoute('User routes', './routes/userRoutes.js', '/api/users');
loadRoute('Notification routes', './routes/notifications.js', '/api/notifications');
loadRoute('Cron routes', './routes/cronRoutes.js', '/api/cron');

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

/* ================= PRODUCTION STATIC ================= */

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'frontend', 'dist');

  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(buildPath, 'index.html'));
    });

    console.log('✅ Production static serving enabled');
  }
}

/* ================= ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* ================= DATABASE CONNECTION ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('🔥 MongoDB connected successfully');

    // START SERVER ONLY AFTER DB CONNECTS
    app.listen(PORT, '0.0.0.0', () => {
      console.log('====================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('📊 Database: Connected');
      console.log('====================================');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

/* ================= GRACEFUL SHUTDOWN ================= */

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed.');
  process.exit(0);
});