const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// Token verification with better error handling
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        // Differentiate between different JWT errors
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        } else {
            throw new Error('Token verification failed');
        }
    }
};

// @desc    Protect routes for authenticated users
// @access  Private
const protect = asyncHandler(async (req, res, next) => {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // Verify token with enhanced error handling
            const decoded = verifyToken(token);
            
            // Find user by ID and attach to request object
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                console.error("[Auth Middleware] User not found for ID:", decoded.id);
                res.status(401);
                throw new Error('Not authorized, user not found');
            }
            
            // Add user session info for logging/analytics
            req.userSession = {
                userId: req.user._id,
                isAdmin: req.user.isAdmin,
                timestamp: new Date()
            };
            
            console.log(`[Auth] User ${req.user._id} authenticated successfully`);
            next();
            
        } catch (error) {
            console.error("[Auth Middleware] Authentication failed:", error.message);
            
            // Provide more specific error messages for frontend
            if (error.message === 'Token expired') {
                res.status(401);
                throw new Error('SESSION_EXPIRED');
            } else if (error.message === 'Invalid token') {
                res.status(401);
                throw new Error('INVALID_TOKEN');
            } else {
                res.status(401);
                throw new Error('AUTHENTICATION_FAILED');
            }
        }
    } else {
        console.error("[Auth Middleware] No token provided");
        res.status(401);
        throw new Error('NO_TOKEN_PROVIDED');
    }
});

// @desc    Optional authentication - attaches user if token exists, but doesn't require it
// @access  Optional
const optional = asyncHandler(async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = verifyToken(token);
            req.user = await User.findById(decoded.id).select('-password');
            
            if (req.user) {
                req.userSession = {
                    userId: req.user._id,
                    isAdmin: req.user.isAdmin,
                    timestamp: new Date()
                };
                console.log(`[Auth] Optional auth - User ${req.user._id} authenticated`);
            }
        } catch (error) {
            // For optional auth, we just log the error but don't block the request
            console.warn("[Auth Middleware] Optional authentication failed:", error.message);
            // Continue without user context
        }
    }
    
    next();
});

// @desc    Restrict access to only administrators
// @access  Private (Admin only)
const admin = asyncHandler(async (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        console.log(`[Auth] Admin access granted for user ${req.user._id}`);
        next();
    } else {
        console.warn(`[Auth] Admin access denied for user ${req.user?._id || 'unknown'}`);
        res.status(403);
        throw new Error('Not authorized as an administrator');
    }
});

// @desc    Restrict access to showcase participants or admins
// @access  Private (Showcase participants or Admin)
const showcaseParticipantOrAdmin = asyncHandler(async (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Authentication required');
    }
    
    // Allow admins
    if (req.user.isAdmin) {
        return next();
    }
    
    // Check if user has showcase posts (basic participation check)
    const { Post } = require('../models/Post');
    const showcasePostCount = await Post.countDocuments({
        userId: req.user._id,
        type: 'showcase'
    });
    
    if (showcasePostCount > 0) {
        console.log(`[Auth] Showcase participant access granted for user ${req.user._id}`);
        next();
    } else {
        console.warn(`[Auth] Showcase access denied for user ${req.user._id}`);
        res.status(403);
        throw new Error('Not authorized - showcase participation required');
    }
});

// @desc    Restrict access to showcase post owners or admins
// @access  Private (Showcase post owner or Admin)
const showcaseOwnerOrAdmin = asyncHandler(async (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Authentication required');
    }
    
    // Allow admins
    if (req.user.isAdmin) {
        return next();
    }
    
    const { Post } = require('../models/Post');
    const postId = req.params.id || req.params.postId;
    
    if (!postId) {
        res.status(400);
        throw new Error('Post ID is required');
    }
    
    // Validate post ID format
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        res.status(400);
        throw new Error('Invalid post ID format');
    }
    
    const post = await Post.findById(postId);
    
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }
    
    // Check if it's a showcase post
    if (post.type !== 'showcase') {
        res.status(400);
        throw new Error('This endpoint is only for showcase posts');
    }
    
    // Check if user owns the showcase post
    if (post.userId.toString() === req.user._id.toString()) {
        console.log(`[Auth] Showcase owner access granted for user ${req.user._id}`);
        next();
    } else {
        console.warn(`[Auth] Showcase owner access denied for user ${req.user._id}`);
        res.status(403);
        throw new Error('Not authorized - you do not own this showcase post');
    }
});

// @desc    Check if user owns the resource or is admin
// @access  Private (Resource owner or Admin)
const ownerOrAdmin = (resourceUserIdField = 'userId') => {
    return asyncHandler(async (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('Authentication required');
        }
        
        // Allow admins
        if (req.user.isAdmin) {
            return next();
        }
        
        // Get resource from request (could be req.post, req.idea, etc.)
        const resource = req.post || req.idea || req.resource;
        
        if (!resource) {
            res.status(404);
            throw new Error('Resource not found');
        }
        
        // Check if user owns the resource
        const resourceUserId = resource[resourceUserIdField] || resource.userId;
        
        if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
            console.log(`[Auth] Resource owner access granted for user ${req.user._id}`);
            next();
        } else {
            console.warn(`[Auth] Resource access denied for user ${req.user._id}`);
            res.status(403);
            throw new Error('Not authorized to access this resource');
        }
    });
};

// @desc    Log all authenticated requests for analytics
// @access  Private
const requestLogger = asyncHandler(async (req, res, next) => {
    if (req.user) {
        console.log(`[Request] ${req.method} ${req.originalUrl} - User: ${req.user._id} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
        
        // Log showcase-specific actions
        if (req.originalUrl.includes('/showcase') || req.originalUrl.includes('/upvote')) {
            console.log(`[Showcase Action] User ${req.user._id} - ${req.method} ${req.originalUrl}`);
        }
    }
    next();
});

module.exports = { 
    protect, 
    admin, 
    optional,
    showcaseParticipantOrAdmin,
    showcaseOwnerOrAdmin,
    ownerOrAdmin,
    requestLogger
};