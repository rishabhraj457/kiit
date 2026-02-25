const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    message: { 
        type: String, 
        required: true,
        maxlength: 500,
        trim: true
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    type: { 
        type: String, 
        enum: [
            // General types
            'warning', 'success', 'info', 'report', 'registration', 'like', 'comment',
            // Showcase-specific types
            'showcase_upvote', 'showcase_comment', 'showcase_featured', 'showcase_approved', 'showcase_system',
            'showcase_bookmark', 'showcase_new_idea', 'showcase_winner'
        ], 
        default: 'info',
        index: true // Add index for faster filtering by type
    },
    
    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
        index: true
    },
    
    isRead: { 
        type: Boolean, 
        default: false,
        index: true // Index for unread notifications query
    },
    
    reporter: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    postId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post' 
    },
    
    reportReason: { 
        type: String,
        maxlength: 200
    },

    // ADD THESE 3 FIELDS FOR SHOWCASE:
    relatedUser: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }, // User who performed the action (e.g., upvoted, commented)
    
    relatedPost: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post' 
    }, // The showcase post this notification is about
    
    readAt: { 
        type: Date 
    }, // When the notification was read

    // Additional fields for better notification handling
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    actionUrl: {
        type: String,
        trim: true
    }, // URL to navigate when notification is clicked
    
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    } // Flexible field for additional data (upvote count, comment text snippet, etc.)

}, { 
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Add virtual fields when converting to JSON
            ret.isShowcaseNotification = ret.type && ret.type.startsWith('showcase_');
            return ret;
        }
    }
});

// Virtual for checking if notification is showcase-related
notificationSchema.virtual('isShowcaseNotification').get(function() {
    return this.type && this.type.startsWith('showcase_');
});

// Virtual for time since notification was created
notificationSchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diffInMs = now - this.timestamp;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return this.timestamp.toLocaleDateString();
});

// ==============================================
// NEW METHODS FOR NOTIFICATION MANAGEMENT
// ==============================================

// Mark notification as read
notificationSchema.methods.markAsRead = function() {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Check if notification is expired (older than retention period)
notificationSchema.methods.isExpired = function(retentionDays = 5) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - retentionDays);
    return this.timestamp < expirationDate;
};

// Get notification context (for display purposes)
notificationSchema.methods.getContext = function() {
    const context = {
        type: this.type,
        isRead: this.isRead,
        timeAgo: this.timeAgo,
        isShowcase: this.isShowcaseNotification
    };

    // Add type-specific context
    if (this.type === 'showcase_upvote') {
        context.action = 'upvoted your idea';
        context.icon = '👍';
    } else if (this.type === 'showcase_comment') {
        context.action = 'commented on your idea';
        context.icon = '💬';
    } else if (this.type === 'showcase_featured') {
        context.action = 'Your idea was featured!';
        context.icon = '⭐';
    } else if (this.type === 'showcase_approved') {
        context.action = 'Your idea was approved';
        context.icon = '✅';
    }

    return context;
};

// ==============================================
// STATIC METHODS FOR NOTIFICATION QUERIES
// ==============================================

// Find unread notifications for a user
notificationSchema.statics.findUnreadForUser = function(userId, limit = 50) {
    return this.find({
        recipient: userId,
        isRead: false
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('relatedUser', 'name avatar')
    .populate('relatedPost', 'title description logoUrl')
    .populate('postId', 'title');
};

// Find showcase notifications for a user
notificationSchema.statics.findShowcaseNotifications = function(userId, limit = 50) {
    return this.find({
        recipient: userId,
        type: { $regex: /^showcase_/, $options: 'i' }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('relatedUser', 'name avatar')
    .populate('relatedPost', 'title description logoUrl month');
};

// Get notification statistics for a user
notificationSchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        {
            $match: {
                recipient: mongoose.Types.ObjectId(userId),
                timestamp: { 
                    $gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // Last 5 days
                }
            }
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
};

// Clean up expired notifications (older than retention period)
notificationSchema.statics.cleanupExpired = function(retentionDays = 5) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - retentionDays);
    
    return this.deleteMany({
        timestamp: { $lt: expirationDate }
    });
};

// Create showcase notification helper
notificationSchema.statics.createShowcaseNotification = function(data) {
    const {
        recipient,
        type,
        message,
        relatedUser,
        relatedPost,
        postId,
        priority = 'medium',
        actionUrl = null,
        metadata = {}
    } = data;

    return this.create({
        recipient,
        type,
        message,
        relatedUser,
        relatedPost,
        postId: postId || relatedPost, // Use relatedPost as fallback for postId
        priority,
        actionUrl,
        metadata
    });
};

// Indexes for better performance
notificationSchema.index({ recipient: 1, timestamp: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, timestamp: -1 });
notificationSchema.index({ recipient: 1, type: 1, timestamp: -1 });
notificationSchema.index({ timestamp: 1 }); // For cleanup operations
notificationSchema.index({ type: 1, timestamp: -1 }); // For type-based queries

module.exports = mongoose.model('Notification', notificationSchema);