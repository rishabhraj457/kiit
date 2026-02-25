const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user.id); // user.id is MongoDB _id
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy({
    // options for google strategy
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Use environment variable for callback URL
    callbackURL: process.env.REDIRECT_URI || 'https://confique.onrender.com/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('=== GOOGLE OAUTH PROFILE ===');
      console.log('Profile ID:', profile.id);
      console.log('Profile Email:', profile.emails?.[0]?.value);
      console.log('Profile Name:', profile.displayName);
      console.log('Callback URL:', process.env.REDIRECT_URI);

      // Check if user already exists in our db
      let currentUser = await User.findOne({ googleId: profile.id });

      if (currentUser) {
        // User already exists, log them in
        console.log('User already exists:', currentUser.email);
        done(null, currentUser);
      } else {
        // Safely access user data from profile object with fallbacks
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        
        if (!email) {
          // Handle case where no email is provided by Google.
          console.error('Google profile does not contain an email address');
          return done(new Error('Google profile does not contain an email address.'), null);
        }

        // Check if user exists with same email but different Google ID
        const existingUserWithEmail = await User.findOne({ email });
        if (existingUserWithEmail) {
          // Merge accounts: add Google ID to existing user
          existingUserWithEmail.googleId = profile.id;
          if (!existingUserWithEmail.avatar || existingUserWithEmail.avatar.url.includes('placehold.co')) {
            existingUserWithEmail.avatar = {
              url: profile.photos && profile.photos.length > 0 
                ? profile.photos[0].value 
                : 'https://placehold.co/40x40/cccccc/000000?text=A',
              publicId: 'google_avatar_' + profile.id
            };
          }
          await existingUserWithEmail.save();
          console.log('Merged Google account with existing user:', existingUserWithEmail.email);
          done(null, existingUserWithEmail);
          return;
        }

        // Create new user with Google OAuth - ✅ USE OBJECT FORMAT
        const newUser = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          // ✅ CORRECT: Use object format for avatar
          avatar: {
            url: profile.photos && profile.photos.length > 0 
              ? profile.photos[0].value 
              : 'https://placehold.co/40x40/cccccc/000000?text=A',
            publicId: 'google_avatar_' + profile.id
          },
          isAdmin: email === 'confique01@gmail.com', // Admin check
        });

        console.log('New user created via Google OAuth:', newUser.email);
        done(null, newUser);
      }
    } catch (err) {
      console.error('Error during Google OAuth callback:', err);
      // Pass the error to done to indicate a failure
      done(err, null);
    }
  })
);

// Helper to generate JWT for Google users after successful authentication
const generateTokenForGoogleUser = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Helper to check if Google OAuth is configured
const isGoogleOAuthConfigured = () => {
  return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
};

module.exports = { 
  passport, 
  generateTokenForGoogleUser,
  isGoogleOAuthConfigured 
};