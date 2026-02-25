const express = require('express');
const asyncHandler = require('express-async-handler');
const { Parser } = require('json2csv');
const User = require('../models/User');
const { Post, Registration } = require('../models/Post'); 
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Helper function to upload base64 images to Cloudinary
const uploadImage = async (image, folderName) => {
    if (!image) return null;
    try {
        const result = await cloudinary.uploader.upload(image, {
            folder: folderName || 'confique_uploads',
        });
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload failed:', error);
        return null;
    }
};

// --- USER PROFILE & ACTIONS ---

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-password')
        .populate('upvotedPosts', 'title month upvotes')
        .populate('bookmarkedPosts', 'title month upvotes logoUrl');

    if (user) {
        // ✅ Standardized avatar handling - always return string URL
        const avatarUrl = typeof user.avatar === 'object' ? user.avatar?.url : user.avatar;
        
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: avatarUrl || null,
            isAdmin: user.isAdmin,
            // Showcase-specific fields
            upvotedPosts: user.upvotedPosts || [],
            bookmarkedPosts: user.bookmarkedPosts || [],
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
    const { name, bio, website, linkedin, twitter } = req.body;
    
    // Basic validation
    if (name && name.length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters long' });
    }

    if (bio && bio.length > 500) {
        return res.status(400).json({ message: 'Bio must be less than 500 characters' });
    }
    
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { 
            name,
            bio,
            website,
            linkedin,
            twitter
        },
        { new: true }
    ).select('-password');

    res.json(user);
}));

// @desc    Update user avatar
// @route   PUT /api/users/profile/avatar
// @access  Private
router.put('/profile/avatar', protect, asyncHandler(async (req, res) => {
    try {
        const { avatarUrl } = req.body;
        
        if (!avatarUrl) {
            return res.status(400).json({ message: 'No avatar URL provided' });
        }

        console.log('🔄 Updating avatar for user:', req.user._id);

        // Get current user to check existing avatar
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Handle Cloudinary cleanup for old avatar if it exists
        if (user.avatar && typeof user.avatar === 'object' && user.avatar.url && user.avatar.url.includes('cloudinary') && user.avatar.publicId && user.avatar.publicId !== 'default_avatar') {
            try {
                await cloudinary.uploader.destroy(user.avatar.publicId);
                console.log('🗑️ Deleted old Cloudinary avatar:', user.avatar.publicId);
            } catch (cloudinaryErr) {
                console.error('Cloudinary deletion failed for old avatar:', cloudinaryErr);
            }
        }

        // Upload new avatar to Cloudinary if it's a base64 data URL
        let finalAvatarUrl = avatarUrl;
        let publicId = 'custom_avatar_' + Date.now();

        if (avatarUrl.startsWith('data:image')) {
            const imageUrl = await uploadImage(avatarUrl, 'confique_avatars');
            if (imageUrl) {
                finalAvatarUrl = imageUrl;
                // Extract publicId from Cloudinary URL
                const parts = imageUrl.split('/');
                publicId = `confique_avatars/${parts[parts.length - 1].split('.')[0]}`;
            } else {
                return res.status(500).json({ message: 'Failed to upload image to Cloudinary' });
            }
        }

        // ✅ Update user with avatar object (for database storage)
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { 
                avatar: {
                    url: finalAvatarUrl,
                    publicId: publicId
                }
            },
            { new: true }
        );

        console.log('✅ Avatar updated successfully');

        // Update avatar in all user's posts (use the URL string)
        await Post.updateMany(
            { userId: req.user._id }, 
            { $set: { authorAvatar: finalAvatarUrl } }
        );

        // Update avatar in all user's comments (use the URL string)
        await Post.updateMany(
            { 'commentData.userId': req.user._id },
            { $set: { 'commentData.$[elem].authorAvatar': finalAvatarUrl } },
            { arrayFilters: [{ 'elem.userId': req.user._id }] }
        );

        // ✅ FIXED: Update avatar in showcase comments
        await Post.updateMany(
            { 'showcaseComments.user': req.user._id },
            { $set: { 'showcaseComments.$[elem].authorAvatar': finalAvatarUrl } },
            { arrayFilters: [{ 'elem.user': req.user._id }] }
        );

        // ✅ Return avatar as string URL for frontend compatibility
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: finalAvatarUrl, // ✅ Return string URL instead of object
            isAdmin: updatedUser.isAdmin,
        });

    } catch (error) {
        console.error('❌ Avatar update error:', error);
        res.status(500).json({ 
            message: 'Failed to update avatar', 
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
}));

// ==============================================
// SHOWCASE-SPECIFIC USER ROUTES (UPDATED)
// ==============================================

// @desc    Get user's liked showcase posts (UPDATED)
// @route   GET /api/users/liked-posts
// @access  Private
router.get('/liked-posts', protect, asyncHandler(async (req, res) => {
    try {
        // Find showcase posts where this user is in upvoters array
        const likedShowcasePosts = await Post.find({
            upvoters: req.user._id,
            type: 'showcase',
            status: 'approved'
        }).select('_id title');

        const likedPostIds = likedShowcasePosts.map(post => post._id.toString());

        res.json({
            success: true,
            likedPostIds: likedPostIds,
            count: likedPostIds.length
        });

    } catch (error) {
        console.error('❌ Error fetching liked posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch liked posts'
        });
    }
}));

// @desc    Get user's showcase posts (UPDATED)
// @route   GET /api/users/showcase-posts
// @access  Private
router.get('/showcase-posts', protect, asyncHandler(async (req, res) => {
    try {
        const posts = await Post.find({ 
            userId: req.user._id, 
            type: 'showcase' 
        })
        .sort({ createdAt: -1 })
        .populate('upvoters', 'name avatar')
        .select('title description month upvotes commentCount views createdAt status logoUrl bannerUrl');

        res.json({
            success: true,
            posts: posts,
            count: posts.length
        });
    } catch (error) {
        console.error('❌ Error fetching showcase posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch showcase posts'
        });
    }
}));

// @desc    Get user's upvoted showcase posts
// @route   GET /api/users/upvoted-showcase
// @access  Private
router.get('/upvoted-showcase', protect, asyncHandler(async (req, res) => {
    try {
        const upvotedPosts = await Post.find({
            upvoters: req.user._id,
            type: 'showcase',
            status: 'approved'
        })
        .select('title description month upvotes logoUrl bannerUrl createdAt author')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            posts: upvotedPosts,
            count: upvotedPosts.length
        });
    } catch (error) {
        console.error('❌ Error fetching upvoted showcase posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upvoted showcase posts'
        });
    }
}));

// @desc    Get user's bookmarked showcase posts
// @route   GET /api/users/bookmarked-showcase
// @access  Private
router.get('/bookmarked-showcase', protect, asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'bookmarkedPosts',
            match: { type: 'showcase', status: 'approved' },
            select: 'title description month upvotes logoUrl bannerUrl createdAt author'
        });

        res.json({
            success: true,
            posts: user.bookmarkedPosts || [],
            count: user.bookmarkedPosts?.length || 0
        });
    } catch (error) {
        console.error('❌ Error fetching bookmarked showcase posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookmarked showcase posts'
        });
    }
}));

// @desc    Bookmark a showcase post (UPDATED)
// @route   POST /api/users/bookmark/:postId
// @access  Private
router.post('/bookmark/:postId', protect, asyncHandler(async (req, res) => {
    try {
        const postId = req.params.postId;
        
        // Validate postId format
        if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid post ID format' 
            });
        }

        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({ 
                success: false,
                message: 'Post not found' 
            });
        }

        if (post.type !== 'showcase') {
            return res.status(400).json({ 
                success: false,
                message: 'Only showcase posts can be bookmarked' 
            });
        }

        const user = await User.findById(req.user._id);
        
        // Initialize bookmarkedPosts array if it doesn't exist
        if (!user.bookmarkedPosts) {
            user.bookmarkedPosts = [];
        }
        
        const isBookmarked = user.bookmarkedPosts.some(
            bookmarkedId => bookmarkedId.toString() === postId
        );

        if (isBookmarked) {
            // Remove bookmark
            user.bookmarkedPosts = user.bookmarkedPosts.filter(
                bookmarkedId => bookmarkedId.toString() !== postId
            );
        } else {
            // Add bookmark
            user.bookmarkedPosts.push(postId);
        }

        await user.save();
        
        res.json({ 
            success: true,
            bookmarked: !isBookmarked,
            bookmarkedPosts: user.bookmarkedPosts,
            message: isBookmarked ? 'Post removed from bookmarks' : 'Post bookmarked successfully'
        });
    } catch (error) {
        console.error('❌ Bookmark error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update bookmark'
        });
    }
}));

// @desc    Check if user has bookmarked a post
// @route   GET /api/users/check-bookmark/:postId
// @access  Private
router.get('/check-bookmark/:postId', protect, asyncHandler(async (req, res) => {
    try {
        const postId = req.params.postId;
        
        // Validate postId format
        if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ 
                success: false,
                bookmarked: false, 
                message: 'Invalid post ID' 
            });
        }

        const user = await User.findById(req.user._id);
        const isBookmarked = user.bookmarkedPosts?.includes(postId) || false;
        
        res.json({ 
            success: true,
            bookmarked: isBookmarked 
        });
    } catch (error) {
        console.error('❌ Check bookmark error:', error);
        res.status(500).json({
            success: false,
            bookmarked: false,
            message: 'Failed to check bookmark status'
        });
    }
}));

// @desc    Get user's showcase statistics (UPDATED)
// @route   GET /api/users/showcase-stats
// @access  Private
router.get('/showcase-stats', protect, asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        const [
            totalPosts,
            totalUpvotes,
            totalComments,
            totalViews,
            upvotedPostsCount,
            bookmarkedPostsCount
        ] = await Promise.all([
            // Total showcase posts created by user
            Post.countDocuments({ userId, type: 'showcase' }),
            
            // Total upvotes received on user's showcase posts
            Post.aggregate([
                { $match: { userId, type: 'showcase' } },
                { $group: { _id: null, total: { $sum: '$upvotes' } } }
            ]),
            
            // Total comments received on user's showcase posts
            Post.aggregate([
                { $match: { userId, type: 'showcase' } },
                { $group: { _id: null, total: { $sum: '$commentCount' } } }
            ]),
            
            // Total views on user's showcase posts
            Post.aggregate([
                { $match: { userId, type: 'showcase' } },
                { $group: { _id: null, total: { $sum: '$views' } } }
            ]),
            
            // Number of posts user has upvoted
            Post.countDocuments({ upvoters: userId, type: 'showcase' }),
            
            // Number of posts user has bookmarked
            User.findById(userId).select('bookmarkedPosts')
        ]);

        res.json({
            success: true,
            stats: {
                postsCreated: totalPosts,
                totalUpvotesReceived: totalUpvotes[0]?.total || 0,
                totalCommentsReceived: totalComments[0]?.total || 0,
                totalViews: totalViews[0]?.total || 0,
                postsUpvoted: upvotedPostsCount,
                postsBookmarked: bookmarkedPostsCount.bookmarkedPosts?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching showcase stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch showcase statistics'
        });
    }
}));

// @desc    Get user's showcase submission status
// @route   GET /api/users/showcase-submission-status
// @access  Private
router.get('/showcase-submission-status', protect, asyncHandler(async (req, res) => {
    try {
        const SUBMISSION_DEADLINE = new Date('2025-10-31T23:59:59').getTime();
        const now = new Date().getTime();
        const isPostingEnabled = now < SUBMISSION_DEADLINE;
        
        // Check if user has already submitted for current month
        const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const existingSubmission = await Post.findOne({
            userId: req.user._id,
            type: 'showcase',
            month: currentMonth
        });

        res.json({
            success: true,
            isPostingEnabled,
            hasSubmitted: !!existingSubmission,
            deadline: '2025-10-31T23:59:59',
            daysRemaining: Math.ceil((SUBMISSION_DEADLINE - now) / (1000 * 60 * 60 * 24)),
            currentMonth: currentMonth,
            existingSubmissionId: existingSubmission?._id
        });
    } catch (error) {
        console.error('❌ Error fetching submission status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submission status'
        });
    }
}));

// @desc    Get user's showcase engagement analytics
// @route   GET /api/users/showcase-analytics
// @access  Private
router.get('/showcase-analytics', protect, asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        const [
            userShowcasePosts,
            totalUpvotesReceived,
            totalCommentsReceived,
            userUpvotedPosts,
            userBookmarkedPosts
        ] = await Promise.all([
            // User's showcase posts with engagement data
            Post.find({ userId, type: 'showcase' })
                .select('title upvotes commentCount views createdAt month status'),
            
            // Total upvotes received
            Post.aggregate([
                { $match: { userId, type: 'showcase' } },
                { $group: { _id: null, totalUpvotes: { $sum: '$upvotes' } } }
            ]),
            
            // Total comments received
            Post.aggregate([
                { $match: { userId, type: 'showcase' } },
                { $group: { _id: null, totalComments: { $sum: '$commentCount' } } }
            ]),
            
            // Posts user has upvoted
            Post.find({ upvoters: userId, type: 'showcase' }).countDocuments(),
            
            // Posts user has bookmarked
            User.findById(userId).select('bookmarkedPosts')
        ]);

        const analytics = {
            postsCreated: userShowcasePosts.length,
            totalUpvotesReceived: totalUpvotesReceived[0]?.totalUpvotes || 0,
            totalCommentsReceived: totalCommentsReceived[0]?.totalComments || 0,
            postsUpvoted: userUpvotedPosts,
            postsBookmarked: userBookmarkedPosts.bookmarkedPosts?.length || 0,
            posts: userShowcasePosts.map(post => ({
                title: post.title,
                upvotes: post.upvotes,
                comments: post.commentCount,
                views: post.views || 0,
                createdAt: post.createdAt,
                month: post.month,
                status: post.status
            }))
        };

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        console.error('❌ Error fetching showcase analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch showcase analytics'
        });
    }
}));

// @desc    Check if user profile is complete for showcase submission
// @route   GET /api/users/profile-complete
// @access  Private
router.get('/profile-complete', protect, asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        const profileComplete = {
            hasName: !!user.name && user.name.trim().length > 0,
            hasAvatar: !!user.avatar && (typeof user.avatar === 'string' || user.avatar.url),
            hasEmail: !!user.email,
            isComplete: false
        };
        
        profileComplete.isComplete = profileComplete.hasName && profileComplete.hasAvatar && profileComplete.hasEmail;

        res.json({
            success: true,
            profileComplete,
            missingFields: [
                !profileComplete.hasName && 'name',
                !profileComplete.hasAvatar && 'avatar',
                !profileComplete.hasEmail && 'email'
            ].filter(Boolean)
        });
    } catch (error) {
        console.error('❌ Error checking profile completion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check profile completion'
        });
    }
}));

// --- EVENT REGISTRATIONS ---

// @desc    Get all event IDs a user is registered for
// @route   GET /api/users/my-events-registrations
// @access  Private
router.get('/my-events-registrations', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const registeredEvents = await Registration.find({ userId: userId }).select('eventId');
    const registeredEventIds = registeredEvents.map(reg => reg.eventId);
    res.json({ registeredEventIds });
}));

// @desc    Get registration counts for events created by the logged-in user
// @route   GET /api/users/my-events/registration-counts
// @access  Private
router.get('/my-events/registration-counts', protect, asyncHandler(async (req, res) => {
    const myEvents = await Post.find({ userId: req.user._id, type: { $in: ['event', 'culturalEvent'] } });
    const registrationCounts = {};
    
    await Promise.all(myEvents.map(async (event) => {
        const count = await Registration.countDocuments({ eventId: event._id });
        registrationCounts[event._id] = count;
    }));

    res.status(200).json({ registrations: registrationCounts });
}));

// @desc    Register for an event
// @route   POST /api/users/register-event/:eventId
// @access  Private
router.post('/register-event/:eventId', protect, asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user._id;

    // Validate eventId format
    if (!eventId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid event ID format' });
    }

    const event = await Post.findById(eventId);
    if (!event) {
        res.status(404);
        throw new Error('Event not found');
    }

    const isAlreadyRegistered = await Registration.findOne({ eventId: eventId, userId: userId });
    if (isAlreadyRegistered) {
        res.status(400);
        throw new Error('You are already registered for this event');
    }

    const { 
        name, 
        email, 
        phone, 
        transactionId,
        bookingDates,
        selectedTickets,
        totalPrice,
        ...customFields
    } = req.body;

    // Basic validation
    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
    }

    const newRegistrationData = {
        eventId,
        userId,
        name,
        email,
        phone,
        transactionId,
        customFields,
        bookingDates,
        selectedTickets,
        totalPrice
    };
    
    const newRegistration = await Registration.create(newRegistrationData);
    
    const eventCreator = await User.findById(event.userId);
    if(eventCreator) {
        const newNotification = new Notification({
            recipient: eventCreator._id,
            message: `${req.user.name} has registered for your event "${event.title}"!`,
            postId: event._id,
            type: 'registration',
            timestamp: new Date(),
        });
        await newNotification.save();
    }

    res.status(201).json({ message: 'Registration successful', registration: newRegistration });
}));

// @desc    Export registrations for a specific event to a CSV file
// @route   GET /api/users/export-registrations/:eventId
// @access  Private (Event host or Admin)
router.get('/export-registrations/:eventId', protect, asyncHandler(async (req, res) => {
    try {
        const { eventId } = req.params;
        
        // Validate eventId format
        if (!eventId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid event ID format' });
        }

        console.log('🔍 Export request received for event:', eventId);
        console.log('👤 Request from user:', req.user._id, req.user.name);

        const event = await Post.findById(eventId);
        if (!event) {
            console.log('❌ Event not found:', eventId);
            return res.status(404).json({ message: 'Event not found.' });
        }

        console.log('📝 Event found:', event.title, 'by user:', event.userId);
        
        // Check authorization
        if (event.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            console.log('🚫 Unauthorized access attempt');
            return res.status(403).json({ message: 'Not authorized to export this data.' });
        }

        console.log('✅ User authorized, fetching registrations...');
        const registrations = await Registration.find({ eventId }).lean();
        console.log(`📊 Found ${registrations.length} registrations`);

        if (registrations.length === 0) {
            console.log('ℹ️ No registrations found for event');
            return res.status(404).json({ message: 'No registrations found for this event.' });
        }

        const headers = new Set(['Name', 'Email', 'Phone', 'Transaction ID', 'Registered At', 'Booking Dates', 'Total Price', 'Ticket Type', 'Ticket Quantity', 'Ticket Price']);
        const flattenedData = [];
        
        registrations.forEach(reg => {
            const baseData = {
                'Name': reg.name || '',
                'Email': reg.email || '',
                'Phone': reg.phone || '',
                'Transaction ID': reg.transactionId || '',
                'Registered At': reg.createdAt ? reg.createdAt.toISOString() : '',
                'Booking Dates': (reg.bookingDates || []).join(', '),
                'Total Price': reg.totalPrice || '',
            };
            
            if (reg.customFields) {
                for (const key in reg.customFields) {
                    if (Object.prototype.hasOwnProperty.call(reg.customFields, key)) {
                        baseData[key] = reg.customFields[key] || '';
                        headers.add(key);
                    }
                }
            }
            
            if (event.type === 'culturalEvent' && reg.selectedTickets && reg.selectedTickets.length > 0) {
                reg.selectedTickets.forEach(ticket => {
                    flattenedData.push({
                        ...baseData,
                        'Ticket Type': ticket.ticketType || '',
                        'Ticket Quantity': ticket.quantity || '',
                        'Ticket Price': ticket.ticketPrice || '',
                    });
                });
            } else {
                flattenedData.push({
                    ...baseData,
                    'Ticket Type': '',
                    'Ticket Quantity': '',
                    'Ticket Price': '',
                });
            }
        });

        const finalHeaders = Array.from(headers);
        const json2csvParser = new Parser({ fields: finalHeaders });
        const csv = json2csvParser.parse(flattenedData);
        
        console.log('✅ CSV generated successfully');
        res.header('Content-Type', 'text/csv');
        const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
        res.attachment(`registrations_${safeTitle}_${eventId}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('❌ CSV export error:', error);
        res.status(500).json({ 
            message: 'Error generating CSV file.',
            error: error.message 
        });
    }
}));

// --- ADMIN ROUTES ---

// @desc    Admin endpoint to get all reported posts
// @route   GET /api/users/admin/reported-posts
// @access  Private, Admin
router.get('/admin/reported-posts', protect, admin, asyncHandler(async (req, res) => {
    const reportedPosts = await Notification.find({ type: 'report' })
        .populate('reporter', 'name email')
        .populate('postId', 'title content');
    res.json(reportedPosts);
}));

// @desc    Admin endpoint to get all registrations for a specific event
// @route   GET /api/users/admin/registrations/:eventId
// @access  Private, Admin
router.get('/admin/registrations/:eventId', protect, asyncHandler(async (req, res) => {
    const eventId = req.params.eventId;
    
    // Validate eventId format
    if (!eventId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid event ID format' });
    }

    const event = await Post.findById(eventId);
    
    if (!event) {
        return res.status(404).json({ message: 'Event not found' });
    }

    if (event.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        return res.status(403).json({ message: 'You are not authorized to view this data.' });
    }
    
    const registrations = await Registration.find({ eventId: event._id });
    res.json(registrations);
}));

// @desc    Admin endpoint to delete a post and its reports
// @route   DELETE /api/users/admin/delete-post/:id
// @access  Private, Admin
router.delete('/admin/delete-post/:id', protect, admin, asyncHandler(async (req, res) => {
    const postId = req.params.id;
    
    // Validate postId format
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid post ID format' });
    }

    const post = await Post.findById(postId);

    if (post) {
        await post.deleteOne();
        await Notification.deleteMany({ postId: postId });
        await Registration.deleteMany({ eventId: postId });
        res.json({ message: 'Post and associated data removed' });
    } else {
        res.status(404).json({ message: 'Post not found' });
    }
}));

// Test route for debugging
router.get('/test-avatar-fix', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    res.json({
        currentAvatar: user.avatar,
        avatarType: typeof user.avatar,
        isObject: user.avatar && typeof user.avatar === 'object',
        hasUrl: user.avatar && user.avatar.url,
        // Test both formats
        stringUrl: user.avatar?.url || user.avatar,
        rawAvatar: user.avatar
    });
}));

// Debug route to test avatar update with simple data
router.put('/test-simple-avatar', protect, asyncHandler(async (req, res) => {
    try {
        const { avatarUrl } = req.body;
        
        if (!avatarUrl) {
            return res.status(400).json({ message: 'No avatar URL provided' });
        }

        console.log('🧪 Testing simple avatar update with:', avatarUrl);

        // Simple update without Cloudinary processing
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { 
                avatar: {
                    url: avatarUrl,
                    publicId: 'test_avatar'
                }
            },
            { new: true }
        );

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: avatarUrl, // Return as string
            isAdmin: updatedUser.isAdmin,
        });

    } catch (error) {
        console.error('❌ Test avatar update error:', error);
        res.status(500).json({ 
            message: 'Test failed', 
            error: error.message 
        });
    }
}));

module.exports = router;