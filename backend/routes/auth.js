const express = require('express');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const { passport, generateTokenForGoogleUser, isGoogleOAuthConfigured } = require('../config/passport-setup');

const router = express.Router();

// ==============================================
// ✅ ENVIRONMENT VALIDATION
// ==============================================

const validateEnv = () => {
  const required = ['JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

validateEnv();

// ==============================================
// ✅ HELPER FUNCTIONS
// ==============================================

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ✅ CONSISTENT: Avatar URL extraction
const getAvatarUrl = (avatar) => {
  if (!avatar) {
    return 'https://placehold.co/40x40/cccccc/000000?text=A';
  }
  
  if (typeof avatar === 'object' && avatar.url) {
    return avatar.url;
  }
  
  if (typeof avatar === 'string') {
    return avatar;
  }
  
  return 'https://placehold.co/40x40/cccccc/000000?text=A';
};

// ✅ Avatar normalization for database storage
const normalizeAvatar = (avatar) => {
  console.log('🔄 Normalizing avatar:', avatar);
  
  if (!avatar || avatar === 'undefined' || avatar === 'null') {
    console.log('❌ No avatar provided, using default');
    return {
      url: 'https://placehold.co/40x40/cccccc/000000?text=A',
      publicId: 'default_avatar'
    };
  }
  
  if (typeof avatar === 'object' && avatar.url) {
    console.log('✅ Avatar is object with URL:', avatar.url);
    return avatar;
  }
  
  if (typeof avatar === 'string') {
    console.log('✅ Avatar is string, converting to object:', avatar);
    return {
      url: avatar,
      publicId: avatar.includes('cloudinary') ? `custom_avatar_${Date.now()}` : 'external_avatar'
    };
  }
  
  console.log('⚠️ Avatar format unknown, using default');
  return {
    url: 'https://placehold.co/40x40/cccccc/000000?text=A',
    publicId: 'default_avatar'
  };
};

// Basic validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  return null;
};

// Input sanitization
const sanitizeInput = (req, res, next) => {
  if (req.body.name) {
    req.body.name = req.body.name.trim();
  }
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  next();
};

// ==============================================
// ✅ ROUTES
// ==============================================

// @desc    Register a new user with email and password
// @route   POST /api/auth/register
// @access  Public
router.post('/register', sanitizeInput, asyncHandler(async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    
    console.log('📝 Registration attempt:', { name, email, avatar });

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please add all fields: name, email, and password' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ 
        success: false,
        message: passwordError 
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    // Create user with normalized avatar
    const normalizedAvatar = normalizeAvatar(avatar);
    console.log('✅ Creating user with avatar:', normalizedAvatar);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      isAdmin: email.toLowerCase() === 'confique01@gmail.com',
      avatar: normalizedAvatar
    });

    if (user) {
      const avatarUrl = getAvatarUrl(user.avatar);
      console.log('✅ User created successfully with avatar:', avatarUrl);
      
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: avatarUrl,
          isAdmin: user.isAdmin,
        },
        token: generateToken(user._id),
        message: 'Registration successful'
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'Invalid user data' 
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: `Validation failed: ${messages.join(', ')}` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// @desc    Authenticate user with email and password & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please add email and password' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check if user has a password (OAuth users might not have one)
    if (!user.password) {
      return res.status(401).json({ 
        success: false,
        message: 'This email is registered with Google OAuth. Please use Google login.' 
      });
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const avatarUrl = getAvatarUrl(user.avatar);
    console.log('✅ Login successful, returning avatar:', avatarUrl);

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: avatarUrl,
        isAdmin: user.isAdmin,
      },
      token: generateToken(user._id),
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// Only enable Google OAuth routes if configured
if (isGoogleOAuthConfigured()) {
  console.log('Google OAuth is configured - enabling Google routes');
  
  router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  }));

  router.get('/google/callback', 
    passport.authenticate('google', {
      failureRedirect: process.env.FRONTEND_URL + '/login?error=google_auth_failed',
      session: true
    }), 
    (req, res) => {
      try {
        console.log('Google OAuth callback successful for user:', req.user?.email);
        
        if (!req.user) {
          console.error('Google OAuth callback failed - no user data');
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user_data`);
        }

        const token = generateTokenForGoogleUser(req.user);
        const avatarUrl = getAvatarUrl(req.user.avatar);
        
        // Build redirect URL with user data
        const redirectParams = new URLSearchParams({
          token: token,
          name: encodeURIComponent(req.user.name),
          email: encodeURIComponent(req.user.email),
          avatar: encodeURIComponent(avatarUrl),
          isAdmin: req.user.isAdmin ? 'true' : 'false',
          _id: req.user._id.toString()
        });

        const redirectUrl = `${process.env.FRONTEND_URL}/?${redirectParams.toString()}`;
        
        console.log('✅ Redirecting to frontend with OAuth success');
        res.redirect(redirectUrl);
      } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
      }
    }
  );
} else {
  console.log('Google OAuth not configured - skipping Google routes');
  
  router.get('/google', (req, res) => {
    res.status(501).json({ 
      success: false,
      message: 'Google OAuth is not configured on this server' 
    });
  });
}

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const avatarUrl = getAvatarUrl(user.avatar);
    console.log('👤 Profile fetched, avatar:', avatarUrl);

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: avatarUrl,
        isAdmin: user.isAdmin,
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// @desc    Get user data for showcase (minimal profile)
// @route   GET /api/auth/showcase-profile
// @access  Private
router.get('/showcase-profile', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name email avatar upvotedPosts bookmarkedPosts')
      .populate('upvotedPosts', 'title month')
      .populate('bookmarkedPosts', 'title month');
      
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const avatarUrl = getAvatarUrl(user.avatar);

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: avatarUrl,
        showcaseStats: {
          upvotedCount: user.upvotedPosts?.length || 0,
          bookmarkedCount: user.bookmarkedPosts?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Showcase profile fetch error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching showcase profile'
    });
  }
}));

// @desc    Check if user can submit to showcase (deadline & limits)
// @route   GET /api/auth/can-submit-showcase
// @access  Private
router.get('/can-submit-showcase', protect, asyncHandler(async (req, res) => {
  try {
    const SUBMISSION_DEADLINE = new Date('2025-10-31T23:59:59').getTime();
    const now = new Date().getTime();
    const isPostingEnabled = now < SUBMISSION_DEADLINE;

    const userShowcaseCount = await Post.countDocuments({ 
      userId: req.user._id, 
      type: 'showcase' 
    });
    
    const maxSubmissions = 5;
    const canSubmitMore = userShowcaseCount < maxSubmissions;

    res.json({
      success: true,
      canSubmit: isPostingEnabled && canSubmitMore,
      deadline: '2025-10-31T23:59:59',
      daysRemaining: Math.ceil((SUBMISSION_DEADLINE - now) / (1000 * 60 * 60 * 24)),
      submissionsCount: userShowcaseCount,
      maxSubmissions: maxSubmissions,
      reason: !isPostingEnabled ? 'Submissions closed' : 
             !canSubmitMore ? 'Submission limit reached' : 'Can submit'
    });
  } catch (error) {
    console.error('Can submit check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error checking submission status'
    });
  }
}));

// @desc    Check if user exists (for password reset flow)
// @route   POST /api/auth/check-user
// @access  Public
router.post('/check-user', asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'No account found with this email address' 
      });
    }

    res.json({
      success: true,
      exists: true,
      hasPassword: !!user.password,
      isOAuth: !user.password
    });
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error checking user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, asyncHandler(async (req, res) => {
  try {
    console.log('👋 User logged out:', req.user.email);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during logout'
    });
  }
}));

// Health check route
router.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Auth API is working!',
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;