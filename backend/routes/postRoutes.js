const express = require('express');
const asyncHandler = require('express-async-handler');
const { Post, Registration } = require('../models/Post');
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NodeCache = require('node-cache');

const router = express.Router();

// Initialize cache (optional - for performance)
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes TTL

// Helper function to upload images to Cloudinary
const uploadImage = async (image) => {
    if (!image) return null;
    try {
        const result = await cloudinary.uploader.upload(image, {
            folder: 'confique_posts',
        });
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload failed:', error);
        return null;
    }
};

// Helper function to extract Cloudinary public ID
const extractPublicId = (url) => {
    if (!url || !url.includes('cloudinary')) return null;
    
    try {
        const parts = url.split('/');
        const uploadIndex = parts.findIndex(part => part === 'upload');
        if (uploadIndex !== -1 && parts.length > uploadIndex + 1) {
            const pathAfterUpload = parts.slice(uploadIndex + 1).join('/');
            return pathAfterUpload.replace(/^v\d+\//, '').split('.')[0];
        }
    } catch (error) {
        console.error('Error extracting public ID from URL:', url, error);
    }
    return null;
};

// ✅ Helper function to populate showcase posts
const populateShowcasePost = async (post) => {
    if (post.type === 'showcase') {
        await post.populate('upvoters', 'name avatar');
        await post.populate('showcaseComments.user', 'name avatar');
    }
    return post;
};

// ✅ Helper function to transform showcase post for frontend
const transformShowcasePostForFrontend = (post) => {
    if (post.type !== 'showcase') return post;
    
    const transformed = post.toObject ? post.toObject() : { ...post };
    
    // Ensure consistent field names for frontend
    transformed.comments = transformed.showcaseComments || [];
    transformed.commentCount = transformed.commentCount || (transformed.showcaseComments ? transformed.showcaseComments.length : 0);
    
    return transformed;
};

// ==============================================
// ✅ BASIC VALIDATION FUNCTIONS (replaced express-validator)
// ==============================================

const validateMongoId = (id) => {
    return id && id.match(/^[0-9a-fA-F]{24}$/);
};

const validateText = (text, min = 1, max = 1000) => {
    return text && text.trim().length >= min && text.trim().length <= max;
};

const validatePostType = (type) => {
    const validTypes = ['confession', 'event', 'culturalEvent', 'news', 'showcase'];
    return validTypes.includes(type);
};

// ==============================================
// ✅ ROUTES
// ==============================================

// @desc    Get all posts (UPDATED WITH PROPER POPULATION)
// @route   GET /api/posts
// @access  Public (for approved posts), Private (for all posts as admin)
router.get('/', asyncHandler(async (req, res) => {
    let posts;
    let isAdmin = false;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('isAdmin');
            if (user && user.isAdmin) {
                isAdmin = true;
            }
        } catch (error) {
            console.log("Invalid or expired token for GET /api/posts, serving public content.");
        }
    }

    if (isAdmin) {
        posts = await Post.find().sort({ timestamp: -1 });
    } else {
        posts = await Post.find({ status: 'approved' }).sort({ timestamp: -1 });
    }

    // ✅ ONLY ADDITION: Populate showcase posts for frontend compatibility
    const populatedPosts = await Promise.all(
        posts.map(async (post) => {
            if (post.type === 'showcase') {
                await post.populate('upvoters', 'name avatar');
                await post.populate('showcaseComments.user', 'name avatar');
            }
            return transformShowcasePostForFrontend(post);
        })
    );

    res.json(populatedPosts);
}));

// @desc    Get all pending events (for admin approval)
// @route   GET /api/posts/pending-events
// @access  Private (Admin only)
router.get('/pending-events', protect, admin, asyncHandler(async (req, res) => {
    const pendingEvents = await Post.find({ type: { $in: ['event', 'culturalEvent'] }, status: 'pending' }).sort({ timestamp: 1 });
    res.json(pendingEvents);
}));

// @desc    Get all registrations for a specific event
// @route   GET /api/posts/:id/registrations
// @access  Private (Event creator or Admin only)
router.get('/:id/registrations', protect, asyncHandler(async (req, res) => {
    const eventId = req.params.id;

    // Basic validation
    if (!validateMongoId(eventId)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid event ID' 
        });
    }

    const event = await Post.findById(eventId).select('userId type');

    if (!event) {
        res.status(404);
        throw new Error('Event not found');
    }

    if (!['event', 'culturalEvent'].includes(event.type)) {
        res.status(400);
        throw new Error('This is not an event.');
    }

    if (event.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view registrations for this event');
    }

    const registrations = await Registration.find({ eventId: event._id });
    res.json(registrations);
}));

// @desc    Get a single post by ID (UPDATED WITH POPULATION AND CACHING)
// @route   GET /api/posts/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
    const cacheKey = `post_${req.params.id}`;
    let post = cache.get(cacheKey);
    
    if (!post) {
        post = await Post.findById(req.params.id);
        
        if (post) {
            // ✅ ONLY ADDITION: Populate showcase data for showcase posts
            if (post.type === 'showcase') {
                await post.populate('upvoters', 'name avatar');
                await post.populate('showcaseComments.user', 'name avatar');
                
                // Track views for showcase posts
                post.views = (post.views || 0) + 1;
                await post.save();
                
                post = transformShowcasePostForFrontend(post);
            }
            
            // Cache for 5 minutes
            cache.set(cacheKey, post, 300);
        }
    }
    
    if (post) {
        res.json(post);
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
    const { _id: userId, name: authorNameFromUser, avatar: avatarFromUser } = req.user;
    
    // ✅ CONSISTENT: Use the same avatar helper as auth.js
    const getAvatarUrl = (avatar) => {
        if (!avatar) return 'https://placehold.co/40x40/cccccc/000000?text=A';
        if (typeof avatar === 'object' && avatar.url) return avatar.url;
        if (typeof avatar === 'string') return avatar;
        return 'https://placehold.co/40x40/cccccc/000000?text=A';
    };
    
    const authorAvatarFinal = getAvatarUrl(avatarFromUser);

    const {
        type,
        images,
        paymentQRCode,
        culturalPaymentQRCode,
        paymentMethod,
        ticketOptions,
        culturalPaymentMethod,
        availableDates,
        title,
        content,
        ...restOfPostData
    } = req.body;

    // Basic validation
    if (!type || !title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Type, title, and content are required'
        });
    }

    if (!validatePostType(type)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid post type'
        });
    }

    if (!validateText(title, 1, 100)) {
        return res.status(400).json({
            success: false,
            message: 'Title must be between 1 and 100 characters'
        });
    }

    if (!validateText(content, 1)) {
        return res.status(400).json({
            success: false,
            message: 'Content is required'
        });
    }

    // STARTUP SHOWCASE: Check submission deadline for showcase posts
    if (type === 'showcase') {
        const SUBMISSION_DEADLINE = new Date('2025-10-31T23:59:59').getTime();
        const now = new Date().getTime();
        if (now > SUBMISSION_DEADLINE) {
            return res.status(400).json({ 
                success: false,
                message: 'Submissions are closed for Startup Showcase. The deadline was October 31, 2025.' 
            });
        }
    }

    let imageUrls = [];
    if (images && Array.isArray(images) && images.length > 0) {
        imageUrls = await Promise.all(images.map(uploadImage));
    } else if (images && typeof images === 'string') {
        imageUrls = [await uploadImage(images)];
    }

    let qrCodeUrl = null;
    if (type === 'event' && paymentQRCode) {
        qrCodeUrl = await uploadImage(paymentQRCode);
    } else if (type === 'culturalEvent' && culturalPaymentQRCode) {
        qrCodeUrl = await uploadImage(culturalPaymentQRCode);
    }

    const newPostData = {
        ...restOfPostData,
        title,
        content,
        images: imageUrls.filter(url => url !== null),
        type,
        author: authorNameFromUser,
        authorAvatar: authorAvatarFinal,
        userId: userId,
        status: (type === 'event' || type === 'culturalEvent') ? 'pending' : 'approved',
        likes: 0,
        likedBy: [],
        commentData: [],
        timestamp: new Date(),
    };

    // STARTUP SHOWCASE: Set default values for showcase posts
    if (type === 'showcase') {
        newPostData.upvotes = 0;
        newPostData.upvoters = [];
        newPostData.comments = 0;
        newPostData.commentCount = 0;
        newPostData.showcaseComments = [];
        newPostData.month = restOfPostData.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
        newPostData.launchedDate = restOfPostData.launchedDate || new Date().toLocaleDateString('en-IN');
        newPostData.status = 'approved';
        newPostData.views = 0;
    }

    // ✅ PRESERVED: Original field cleanup logic
    if (type === 'event') {
        if (qrCodeUrl) newPostData.paymentQRCode = qrCodeUrl;
        newPostData.paymentMethod = ['link', 'qr'].includes(paymentMethod) ? paymentMethod : undefined;
        newPostData.ticketOptions = undefined;
        newPostData.culturalPaymentMethod = undefined;
        newPostData.culturalPaymentLink = undefined;
        newPostData.culturalPaymentQRCode = undefined;
        newPostData.availableDates = undefined;
    } else if (type === 'culturalEvent') {
        if (qrCodeUrl) newPostData.culturalPaymentQRCode = qrCodeUrl;
        newPostData.ticketOptions = ticketOptions;
        newPostData.culturalPaymentMethod = culturalPaymentMethod;
        newPostData.availableDates = availableDates;
        newPostData.price = undefined;
        newPostData.paymentMethod = undefined;
        newPostData.paymentLink = undefined;
        newPostData.paymentQRCode = undefined;
    } else if (type === 'showcase') {
        // Clean up showcase posts - remove event-specific fields
        newPostData.location = undefined;
        newPostData.eventStartDate = undefined;
        newPostData.eventEndDate = undefined;
        newPostData.price = undefined;
        newPostData.language = undefined;
        newPostData.duration = undefined;
        newPostData.registrationLink = undefined;
        newPostData.registrationOpen = undefined;
        newPostData.enableRegistrationForm = undefined;
        newPostData.registrationFields = undefined;
        newPostData.paymentMethod = undefined;
        newPostData.paymentLink = undefined;
        newPostData.paymentQRCode = undefined;
        newPostData.source = undefined;
        newPostData.ticketOptions = undefined;
        newPostData.culturalPaymentMethod = undefined;
        newPostData.culturalPaymentLink = undefined;
        newPostData.culturalPaymentQRCode = undefined;
        newPostData.availableDates = undefined;
    } else {
        // Regular posts cleanup
        newPostData.location = undefined;
        newPostData.eventStartDate = undefined;
        newPostData.eventEndDate = undefined;
        newPostData.price = undefined;
        newPostData.language = undefined;
        newPostData.duration = undefined;
        newPostData.registrationLink = undefined;
        newPostData.registrationOpen = undefined;
        newPostData.enableRegistrationForm = undefined;
        newPostData.registrationFields = undefined;
        newPostData.paymentMethod = undefined;
        newPostData.paymentLink = undefined;
        newPostData.paymentQRCode = undefined;
        newPostData.source = undefined;
        newPostData.ticketOptions = undefined;
        newPostData.culturalPaymentMethod = undefined;
        newPostData.culturalPaymentLink = undefined;
        newPostData.culturalPaymentQRCode = undefined;
        newPostData.availableDates = undefined;
    }

    try {
        const post = new Post(newPostData);
        const createdPost = await post.save();
        
        // Clear relevant caches
        cache.del('posts_all');
        
        // ✅ ONLY ADDITION: Populate the created post before returning
        const populatedPost = await populateShowcasePost(createdPost);
        const transformedPost = transformShowcasePostForFrontend(populatedPost);
        
        res.status(201).json({
            success: true,
            post: transformedPost
        });
    } catch (error) {
        console.error('❌ Post creation error details:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ 
                success: false,
                message: `Validation Failed: ${messages.join(', ')}` 
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Internal server error during post creation',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
}));

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private (Author or Admin only)
router.put('/:id', protect, asyncHandler(async (req, res) => {
    // Basic validation
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({ message: 'You are not authorized to update this post' });
    }

    const {
        type,
        title,
        content,
        images,
        status,
        paymentMethod,
        ticketOptions,
        culturalPaymentMethod,
        availableDates,
        ...rest
    } = req.body;

    // Validate input
    if (type && !validatePostType(type)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post type' 
        });
    }

    if (title && !validateText(title, 1, 100)) {
        return res.status(400).json({ 
            success: false,
            message: 'Title must be between 1 and 100 characters' 
        });
    }

    if (content && !validateText(content, 1)) {
        return res.status(400).json({ 
            success: false,
            message: 'Content is required' 
        });
    }

    // ✅ PRESERVED: Original image handling logic
    if (images !== undefined) {
        const oldImagePublicIds = post.images
            .map(url => extractPublicId(url))
            .filter(id => id);

        if (oldImagePublicIds.length > 0) {
            try { 
                await cloudinary.api.delete_resources(oldImagePublicIds); 
            } catch (cloudinaryErr) { 
                console.error('Cloudinary deletion failed for old images:', cloudinaryErr); 
            }
        }

        const newImageArray = Array.isArray(images) ? images : (images ? [images] : []);
        const newImageUrls = await Promise.all(newImageArray.map(uploadImage));
        post.images = newImageUrls.filter(url => url !== null);
    }

    // ✅ PRESERVED: Original QR code handling logic
    let newQrCodeUrl = undefined;
    let oldQrCodeUrl = post.type === 'event' ? post.paymentQRCode : post.culturalPaymentQRCode;
    let newQrCodeData = post.type === 'event' ? rest.paymentQRCode : rest.culturalPaymentQRCode;

    if (newQrCodeData !== undefined && newQrCodeData !== oldQrCodeUrl) {
        if (oldQrCodeUrl) {
            const publicId = extractPublicId(oldQrCodeUrl);
            if (publicId) {
                try { 
                    await cloudinary.uploader.destroy(publicId); 
                } catch (cloudinaryErr) { 
                    console.error('Cloudinary deletion failed for old QR code:', cloudinaryErr); 
                }
            }
        }
        newQrCodeUrl = newQrCodeData ? await uploadImage(newQrCodeData) : (newQrCodeData === '' ? null : undefined);
    }

    post.set({
        type: type !== undefined ? type : post.type,
        title: title !== undefined ? title : post.title,
        content: content !== undefined ? content : post.content,
        paymentMethod: ['link', 'qr'].includes(paymentMethod) ? paymentMethod : undefined,
        ticketOptions: post.type === 'culturalEvent' ? ticketOptions : undefined,
        culturalPaymentMethod: post.type === 'culturalEvent' ? culturalPaymentMethod : undefined,
        availableDates: post.type === 'culturalEvent' ? availableDates : undefined,
        ...rest,
    });

    if (req.user.isAdmin && status !== undefined) {
        post.status = status;
    }

    // ✅ PRESERVED: Original field cleanup logic
    if (post.type === 'event' && newQrCodeUrl !== undefined) {
        post.paymentQRCode = newQrCodeUrl;
    } else if (post.type === 'culturalEvent' && newQrCodeUrl !== undefined) {
        post.culturalPaymentQRCode = newQrCodeUrl;
    }

    if (post.type === 'event') {
        post.culturalPaymentMethod = undefined;
        post.culturalPaymentLink = undefined;
        post.culturalPaymentQRCode = undefined;
        post.availableDates = undefined;
    } else if (post.type === 'culturalEvent') {
        post.price = undefined;
        post.paymentMethod = undefined;
        post.paymentLink = undefined;
        post.paymentQRCode = undefined;
    } else if (post.type === 'showcase') {
        // Clean up showcase posts
        post.location = undefined;
        post.eventStartDate = undefined;
        post.eventEndDate = undefined;
        post.price = undefined;
        post.language = undefined;
        post.duration = undefined;
        post.registrationLink = undefined;
        post.registrationOpen = undefined;
        post.enableRegistrationForm = undefined;
        post.registrationFields = undefined;
        post.paymentMethod = undefined;
        post.paymentLink = undefined;
        post.paymentQRCode = undefined;
        post.source = undefined;
        post.ticketOptions = undefined;
        post.culturalPaymentMethod = undefined;
        post.culturalPaymentLink = undefined;
        post.culturalPaymentQRCode = undefined;
        post.availableDates = undefined;
    } else {
        // Regular posts cleanup
        post.location = undefined;
        post.eventStartDate = undefined;
        post.eventEndDate = undefined;
        post.price = undefined;
        post.language = undefined;
        post.duration = undefined;
        post.registrationLink = undefined;
        post.registrationOpen = undefined;
        post.enableRegistrationForm = undefined;
        post.registrationFields = undefined;
        post.paymentMethod = undefined;
        post.paymentLink = undefined;
        post.paymentQRCode = undefined;
        post.source = undefined;
        post.ticketOptions = undefined;
        post.culturalPaymentMethod = undefined;
        post.culturalPaymentLink = undefined;
        post.culturalPaymentQRCode = undefined;
        post.availableDates = undefined;
    }

    try {
        const updatedPost = await post.save();
        
        // Clear caches
        cache.del(`post_${req.params.id}`);
        cache.del('posts_all');
        
        res.json({
            success: true,
            post: updatedPost
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ 
                success: false,
                message: `Validation Failed during update: ${messages.join(', ')}` 
            });
        }
        throw error;
    }
}));

// @desc    Approve a pending event
// @route   PUT /api/posts/approve-event/:id
// @access  Private (Admin only)
router.put('/approve-event/:id', protect, admin, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid event ID' 
        });
    }

    const event = await Post.findById(req.params.id);

    if (event) {
        if (!['event', 'culturalEvent'].includes(event.type)) {
            return res.status(400).json({ message: 'Only events and cultural events can be approved through this route' });
        }
        event.status = 'approved';
        const updatedEvent = await event.save();
        
        // Clear caches
        cache.del(`post_${req.params.id}`);
        cache.del('posts_all');
        
        res.json(updatedEvent);
    } else {
        res.status(404).json({ message: 'Event not found' });
    }
}));

// @desc    Reject and delete a pending event
// @route   DELETE /api/posts/reject-event/:id
// @access  Private (Admin only)
router.delete('/reject-event/:id', protect, admin, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid event ID' 
        });
    }

    const event = await Post.findById(req.params.id);

    if (event) {
        if (!['event', 'culturalEvent'].includes(event.type)) {
            return res.status(400).json({ message: 'Only events and cultural events can be rejected through this route' });
        }
        const publicIdsToDelete = [];
        
        if (event.images && event.images.length > 0) {
            event.images.forEach(url => {
                const publicId = extractPublicId(url);
                if (publicId) publicIdsToDelete.push(publicId);
            });
        }
        
        const qrCodeUrl = event.type === 'event' ? event.paymentQRCode : event.culturalPaymentQRCode;
        if (qrCodeUrl) {
            const publicId = extractPublicId(qrCodeUrl);
            if (publicId) publicIdsToDelete.push(publicId);
        }

        if (publicIdsToDelete.length > 0) {
            try {
                await cloudinary.api.delete_resources(publicIdsToDelete);
            } catch (cloudinaryErr) {
                console.error('Cloudinary deletion failed for some resources:', cloudinaryErr);
            }
        }
        
        await event.deleteOne();
        await Registration.deleteMany({ eventId: event._id });
        
        // Clear caches
        cache.del(`post_${req.params.id}`);
        cache.del('posts_all');
        
        res.json({ message: 'Event rejected and removed' });
    } else {
        res.status(404).json({ message: 'Event not found' });
    }
}));

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private (Author or Admin only)
router.delete('/:id', protect, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const post = await Post.findById(req.params.id);
    if (post) {
        if (post.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'You are not authorized to delete this post' });
        }
        
        const publicIdsToDelete = [];
        if (post.images && post.images.length > 0) {
            post.images.forEach(url => {
                const publicId = extractPublicId(url);
                if (publicId) publicIdsToDelete.push(publicId);
            });
        }
        
        const qrCodeUrl = post.type === 'event' ? post.paymentQRCode : post.culturalPaymentQRCode;
        if (qrCodeUrl) {
            const publicId = extractPublicId(qrCodeUrl);
            if (publicId) publicIdsToDelete.push(publicId);
        }
        
        if (publicIdsToDelete.length > 0) {
            try {
                await cloudinary.api.delete_resources(publicIdsToDelete);
            } catch (cloudinaryErr) {
                console.error('Cloudinary deletion failed for some resources:', cloudinaryErr);
            }
        }
        
        await post.deleteOne();
        if (post.type === 'event' || post.type === 'culturalEvent') {
            await Registration.deleteMany({ eventId: post._id });
        }
        
        // Clear caches
        cache.del(`post_${req.params.id}`);
        cache.del('posts_all');
        
        res.json({ message: 'Post removed' });
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// @desc    Add a comment to a post (for regular posts)
// @route   POST /api/posts/:id/comments
// @access  Private
router.post('/:id/comments', protect, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    if (post) {
        if (!validateText(text, 1, 1000)) {
            return res.status(400).json({ message: 'Comment text must be between 1 and 1000 characters' });
        }
        
        // ✅ CONSISTENT: Use the same avatar helper
        const getAvatarUrl = (avatar) => {
            if (!avatar) return 'https://placehold.co/40x40/cccccc/000000?text=A';
            if (typeof avatar === 'object' && avatar.url) return avatar.url;
            if (typeof avatar === 'string') return avatar;
            return 'https://placehold.co/40x40/cccccc/000000?text=A';
        };
        
        const userAvatar = getAvatarUrl(req.user.avatar);
        
        const newComment = {
            author: req.user.name,
            authorAvatar: userAvatar,
            text,
            timestamp: new Date(),
            userId: req.user._id,
        };
        post.commentData.push(newComment);
        post.comments = post.commentData.length;
        await post.save();
        
        // Clear cache
        cache.del(`post_${req.params.id}`);
        
        res.status(201).json(post.commentData);
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// @desc    Like a post (for regular posts)
// @route   PUT /api/posts/:id/like
// @access  Private
router.put('/:id/like', protect, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const post = await Post.findById(req.params.id);
    if (post) {
        if (post.likedBy.includes(req.user._id)) {
            return res.status(400).json({ message: 'You have already liked this post' });
        }
        post.likes += 1;
        post.likedBy.push(req.user._id);
        await post.save();
        
        // Clear cache
        cache.del(`post_${req.params.id}`);
        
        res.json({ likes: post.likes, likedBy: post.likedBy });
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// @desc    Unlike a post (for regular posts)
// @route   PUT /api/posts/:id/unlike
// @access  Private
router.put('/:id/unlike', protect, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const post = await Post.findById(req.params.id);
    if (post) {
        if (!post.likedBy.includes(req.user._id)) {
            return res.status(400).json({ message: 'You have not liked this post' });
        }
        if (post.likes > 0) {
            post.likes -= 1;
        }
        post.likedBy = post.likedBy.filter(userId => userId.toString() !== req.user._id.toString());
        await post.save();
        
        // Clear cache
        cache.del(`post_${req.params.id}`);
        
        res.json({ likes: post.likes, likedBy: post.likedBy });
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// @desc    Report a post
// @route   POST /api/posts/:id/report
// @access  Private
router.post('/:id/report', protect, asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const { reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (post) {
        if (!validateText(reason, 1, 500)) {
            return res.status(400).json({ message: 'Report reason must be between 1 and 500 characters' });
        }
        const notification = new Notification({
            message: `Post "${post.title}" has been reported by ${req.user.name} for: ${reason}`,
            reporter: req.user._id,
            postId: post._id,
            reportReason: reason,
            type: 'report',
            timestamp: new Date(),
        });
        await notification.save();
        res.status(201).json({ message: 'Post reported successfully' });
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// ==============================================
// ✅ SHOWCASE-SPECIFIC ROUTES (NEW FUNCTIONALITY)
// ==============================================

// @desc    Upvote a showcase post (NEW ROUTE)
// @route   PUT /api/posts/:id/upvote
// @access  Private
router.put('/:id/upvote', protect, asyncHandler(async (req, res) => {
    // Basic validation
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid post ID'
        });
    }

    console.log('🔼 Upvote request received for post:', req.params.id, 'from user:', req.user._id);
    
    const post = await Post.findById(req.params.id);
    
    if (!post) {
        return res.status(404).json({ 
            success: false,
            message: 'Post not found' 
        });
    }

    if (post.type !== 'showcase') {
        return res.status(400).json({ 
            success: false,
            message: 'Only showcase posts can be upvoted' 
        });
    }

    // Prevent users from upvoting their own posts
    if (post.userId.toString() === req.user._id.toString()) {
        return res.status(400).json({
            success: false,
            message: 'You cannot upvote your own post'
        });
    }

    const hasUpvoted = post.upvoters.some(upvoterId => 
        upvoterId.toString() === req.user._id.toString()
    );

    if (hasUpvoted) {
        // Remove upvote
        post.upvotes = Math.max(0, post.upvotes - 1);
        post.upvoters = post.upvoters.filter(
            userId => userId.toString() !== req.user._id.toString()
        );
    } else {
        // Add upvote
        post.upvotes += 1;
        post.upvoters.push(req.user._id);

        // Create notification for post creator
        try {
            const notification = new Notification({
                user: post.userId,
                type: 'upvote',
                message: `${req.user.name} upvoted your startup idea "${post.title}"`,
                relatedPost: post._id,
                relatedUser: req.user._id
            });
            await notification.save();
        } catch (notifError) {
            console.error('❌ Failed to create notification:', notifError);
        }
    }

    try {
        await post.save();
        await post.populate('upvoters', 'name avatar');
        
        // Clear cache
        cache.del(`post_${req.params.id}`);
        
        res.json({
            success: true,
            upvotes: post.upvotes,
            upvoters: post.upvoters,
            hasUpvoted: !hasUpvoted,
            postId: post._id
        });
        
    } catch (saveError) {
        console.error('❌ Failed to save upvote:', saveError);
        res.status(500).json({ 
            success: false,
            message: 'Failed to save upvote',
            error: saveError.message 
        });
    }
}));

// @desc    Add comment to showcase post (NEW ROUTE)
// @route   POST /api/posts/:id/showcase-comments
// @access  Private
router.post('/:id/showcase-comments', protect, asyncHandler(async (req, res) => {
    // Basic validation
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid post ID'
        });
    }

    const { text } = req.body;

    if (!validateText(text, 1, 1000)) {
        return res.status(400).json({
            success: false,
            message: 'Comment must be between 1 and 1000 characters'
        });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
        return res.status(404).json({ 
            success: false,
            message: 'Post not found' 
        });
    }

    if (post.type !== 'showcase') {
        return res.status(400).json({ 
            success: false,
            message: 'Only showcase posts can use this comment endpoint' 
        });
    }

    // ✅ CONSISTENT: Use the same avatar helper
    const getAvatarUrl = (avatar) => {
        if (!avatar) return 'https://placehold.co/40x40/cccccc/000000?text=A';
        if (typeof avatar === 'object' && avatar.url) return avatar.url;
        if (typeof avatar === 'string') return avatar;
        return 'https://placehold.co/40x40/cccccc/000000?text=A';
    };

    const userAvatar = getAvatarUrl(req.user.avatar);

    const comment = {
        user: req.user._id,
        text: text.trim(),
        timestamp: new Date(),
        author: req.user.name,
        authorAvatar: userAvatar
    };

    if (!post.showcaseComments) {
        post.showcaseComments = [];
    }
    
    post.showcaseComments.push(comment);
    post.commentCount = post.showcaseComments.length;

    try {
        await post.save();

        // Create notification for post creator
        if (post.userId.toString() !== req.user._id.toString()) {
            try {
                const notification = new Notification({
                    user: post.userId,
                    type: 'comment',
                    message: `${req.user.name} commented on your startup idea "${post.title}"`,
                    relatedPost: post._id,
                    relatedUser: req.user._id
                });
                await notification.save();
            } catch (notifError) {
                console.error('❌ Failed to create notification:', notifError);
            }
        }

        await post.populate('showcaseComments.user', 'name avatar');
        
        const newComment = post.showcaseComments[post.showcaseComments.length - 1];
        
        const populatedComment = {
            _id: newComment._id,
            id: newComment._id,
            user: {
                _id: req.user._id,
                name: req.user.name,
                avatar: userAvatar
            },
            text: newComment.text,
            timestamp: newComment.timestamp,
            author: req.user.name,
            authorAvatar: userAvatar
        };

        // Clear cache
        cache.del(`post_${req.params.id}`);
        
        res.status(201).json({
            success: true,
            comment: populatedComment,
            post: transformShowcasePostForFrontend(post),
            commentCount: post.commentCount
        });
        
    } catch (saveError) {
        console.error('❌ Failed to save comment:', saveError);
        res.status(500).json({ 
            success: false,
            message: 'Failed to save comment',
            error: saveError.message 
        });
    }
}));

// @desc    Get showcase post comments with pagination (NEW ROUTE)
// @route   GET /api/posts/:id/showcase-comments
// @access  Public
router.get('/:id/showcase-comments', asyncHandler(async (req, res) => {
    if (!validateMongoId(req.params.id)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid post ID' 
        });
    }

    const { page = 1, limit = 10 } = req.query;
    const post = await Post.findById(req.params.id)
        .populate('showcaseComments.user', 'name avatar')
        .select('showcaseComments commentCount');

    if (!post) {
        return res.status(404).json({ 
            success: false,
            message: 'Post not found' 
        });
    }

    if (post.type !== 'showcase') {
        return res.status(400).json({ 
            success: false,
            message: 'Only showcase posts can use this comment endpoint' 
        });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const comments = post.showcaseComments.slice(startIndex, endIndex);
    const totalComments = post.showcaseComments.length;

    res.json({
        success: true,
        comments: comments,
        totalPages: Math.ceil(totalComments / limit),
        currentPage: parseInt(page),
        totalComments,
        postId: post._id
    });
}));

// @desc    Get top showcase posts
// @route   GET /api/posts/showcase/top
// @access  Public
router.get('/showcase/top', asyncHandler(async (req, res) => {
    const { limit = 10, month = null } = req.query;
    
    const topShowcases = await Post.findTopShowcases(parseInt(limit), month);
    
    res.json({
        success: true,
        posts: topShowcases,
        count: topShowcases.length
    });
}));

// @desc    Get showcase analytics
// @route   GET /api/posts/showcase/analytics
// @access  Private (Admin only)
router.get('/showcase/analytics', protect, admin, asyncHandler(async (req, res) => {
    const { month = null } = req.query;
    
    const analytics = await Post.getShowcaseAnalytics(month);
    
    res.json({
        success: true,
        analytics: analytics[0] || {},
        month: month || 'all'
    });
}));

module.exports = router;