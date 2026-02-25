const express = require('express');
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configuration constants
const NOTIFICATION_CONFIG = {
    RETENTION_DAYS: 5,
    DEFAULT_LIMIT: 50,
    VALID_TYPES: ['upvote', 'comment', 'registration', 'report', 'system', 'showcase_upvote', 'showcase_comment'],
    SHOWCASE_TYPES: ['showcase_upvote', 'showcase_comment']
};

// Helper function to calculate expiration date
const getExpirationDate = () => {
    return new Date(Date.now() - NOTIFICATION_CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000);
};

// Helper function to build base query
const buildBaseQuery = (userId, additionalFilters = {}) => {
    return {
        recipient: userId,
        timestamp: { $gte: getExpirationDate() },
        ...additionalFilters
    };
};

// @desc    Get all notifications for the current user
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
    const notifications = await Notification.find(
        buildBaseQuery(req.user._id)
    )
    .sort({ timestamp: -1 })
    .limit(NOTIFICATION_CONFIG.DEFAULT_LIMIT);

    res.json(notifications);
}));

// ==============================================
// NEW STARTUP SHOWCASE NOTIFICATION ROUTES
// ==============================================

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, asyncHandler(async (req, res) => {
    // Validate notification ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndUpdate(
        { 
            _id: req.params.id, 
            recipient: req.user._id 
        },
        { 
            isRead: true,
            readAt: new Date()
        },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
}));

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', protect, asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        buildBaseQuery(req.user._id, { isRead: false }),
        { 
            isRead: true,
            readAt: new Date()
        }
    );

    res.json({ 
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount
    });
}));

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments(
        buildBaseQuery(req.user._id, { isRead: false })
    );

    res.json({ unreadCount: count });
}));

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
    // Validate notification ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid notification ID format' });
    }

    const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        recipient: req.user._id
    });

    if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
}));

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear-all
// @access  Private
router.delete('/clear-all', protect, asyncHandler(async (req, res) => {
    const result = await Notification.deleteMany(
        buildBaseQuery(req.user._id)
    );

    res.json({ 
        message: 'All notifications cleared',
        deletedCount: result.deletedCount
    });
}));

// @desc    Get notifications by type (for showcase filtering)
// @route   GET /api/notifications/type/:type
// @access  Private
router.get('/type/:type', protect, asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    if (!NOTIFICATION_CONFIG.VALID_TYPES.includes(type)) {
        return res.status(400).json({ 
            message: 'Invalid notification type',
            validTypes: NOTIFICATION_CONFIG.VALID_TYPES
        });
    }

    const notifications = await Notification.find(
        buildBaseQuery(req.user._id, { type })
    )
    .sort({ timestamp: -1 })
    .limit(NOTIFICATION_CONFIG.DEFAULT_LIMIT);

    res.json(notifications);
}));

// @desc    Get showcase-specific notifications
// @route   GET /api/notifications/showcase
// @access  Private
router.get('/showcase', protect, asyncHandler(async (req, res) => {
    const notifications = await Notification.find(
        buildBaseQuery(req.user._id, { 
            type: { $in: NOTIFICATION_CONFIG.SHOWCASE_TYPES } 
        })
    )
    .sort({ timestamp: -1 })
    .limit(NOTIFICATION_CONFIG.DEFAULT_LIMIT);

    res.json(notifications);
}));

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
    const stats = await Notification.aggregate([
        {
            $match: buildBaseQuery(req.user._id)
        },
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                unreadCount: {
                    $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                }
            }
        }
    ]);

    const totalStats = await Notification.aggregate([
        {
            $match: buildBaseQuery(req.user._id)
        },
        {
            $group: {
                _id: null,
                totalCount: { $sum: 1 },
                totalUnread: {
                    $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                }
            }
        }
    ]);

    res.json({
        byType: stats,
        total: totalStats[0] || { totalCount: 0, totalUnread: 0 }
    });
}));

module.exports = router;