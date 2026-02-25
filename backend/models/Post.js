const mongoose = require('mongoose');

// Sub-schema for cultural event ticket options
const ticketOptionSchema = new mongoose.Schema({
    ticketType: { type: String, required: true },
    ticketPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

// Sub-schema for comments (for confession/event posts)
const commentSchema = new mongoose.Schema({
    author: { type: String, required: true },
    authorAvatar: { type: String, default: 'https://placehold.co/40x40/cccccc/000000?text=A' },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

// ✅ FIXED: Showcase comments schema with proper structure
const showcaseCommentSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    text: { 
        type: String, 
        required: true,
        maxlength: 1000,
        trim: true
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    author: { 
        type: String,
        required: true
    },
    authorAvatar: { 
        type: String,
        default: 'https://placehold.co/40x40/cccccc/000000?text=A'
    },
    // ✅ ADD: Alias field for frontend compatibility
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { _id: true, timestamps: true });

// A separate schema for Registrations (not embedded in Post)
const registrationSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    transactionId: { type: String },
    paymentScreenshot: { type: String },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    bookingDates: [{ type: String }],
    selectedTickets: [{
        ticketType: { type: String },
        ticketPrice: { type: Number },
        quantity: { type: Number },
    }],
    totalPrice: { type: Number },
    paymentStatus: {
        type: String,
        enum: ['pending', 'under_review', 'confirmed', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

// ✅ FIXED: Main Post Schema with better validation
const postSchema = new mongoose.Schema({
    // General Post Fields (applicable to all types)
    type: {
        type: String,
        required: true,
        enum: ['confession', 'event', 'culturalEvent', 'news', 'showcase'],
    },
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    content: { 
        type: String, 
        required: true,
        trim: true
    },
    images: [{ type: String }],
    author: { 
        type: String, 
        required: true,
        trim: true
    },
    authorAvatar: { 
        type: String, 
        default: 'https://placehold.co/40x40/cccccc/000000?text=A' 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    likes: { 
        type: Number, 
        default: 0 
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: { 
        type: Number, 
        default: 0 
    },
    commentData: [commentSchema],

    // Event-specific Fields
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'approved' 
    },
    source: { type: String },
    location: { type: String },
    eventStartDate: { type: Date },
    eventEndDate: { type: Date },
    price: { type: Number, default: 0 },
    language: { type: String },
    duration: { type: String },
    ticketsNeeded: { type: String },
    venueAddress: { type: String },
    registrationLink: { type: String },
    registrationOpen: { type: Boolean, default: true },
    enableRegistrationForm: { type: Boolean, default: false },
    registrationFields: { type: String },
    paymentMethod: { type: String, enum: ['link', 'qr'] },
    paymentLink: { type: String },
    paymentQRCode: { type: String },

    // Cultural Event-specific Fields
    ticketOptions: [ticketOptionSchema],
    culturalPaymentMethod: { type: String, enum: ['link', 'qr', 'qr-screenshot'] },
    culturalPaymentLink: { type: String },
    culturalPaymentQRCode: { type: String },
    availableDates: [{ type: String }],

    // ==============================================
    // ✅ FIXED: STARTUP SHOWCASE FIELDS
    // ==============================================
    
    // Basic showcase fields
    description: { 
        type: String,
        maxlength: 200,
        trim: true
    },
    fullDescription: { 
        type: String,
        maxlength: 5000,
        trim: true
    },
    websiteLink: { 
        type: String,
        trim: true
    },
    
    // Visual assets
    logoUrl: { 
        type: String
    },
    bannerUrl: { 
        type: String
    },
    
    // Showcase-specific metadata
    month: { 
        type: String
    },
    launchedDate: { 
        type: String,
        trim: true,
        default: 'Coming Soon'
    },
    
    // Engagement metrics
    upvotes: { 
        type: Number, 
        default: 0,
        min: 0
    },
    upvoters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Showcase comments (different from regular comments)
    showcaseComments: {
        type: [showcaseCommentSchema],
        default: []
    },
    commentCount: { 
        type: Number, 
        default: 0,
        min: 0
    },

    // Showcase analytics
    views: {
        type: Number,
        default: 0
    }

}, { 
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // ✅ FIXED: Provide consistent field names for frontend
            if (ret.type === 'showcase') {
                // Alias showcaseComments as comments for frontend compatibility
                ret.comments = ret.showcaseComments || [];
                ret.commentCount = ret.commentCount || (ret.showcaseComments ? ret.showcaseComments.length : 0);
            }
            ret.isShowcase = ret.type === 'showcase';
            return ret;
        }
    }
});

// ✅ FIXED: Virtual field to provide consistent comments array for frontend
postSchema.virtual('commentsArray').get(function() {
    if (this.type === 'showcase') {
        return this.showcaseComments || [];
    } else {
        return this.commentData || [];
    }
});

// ✅ FIXED: Pre-save hook with better initialization
postSchema.pre('save', function(next) {
    // Update regular comment count
    if (this.isModified('commentData')) {
        this.comments = this.commentData.length;
    }
    
    // Update showcase comment count
    if (this.isModified('showcaseComments')) {
        this.commentCount = this.showcaseComments.length;
    }
    
    // Ensure arrays are initialized
    if (this.type === 'showcase') {
        if (!this.upvoters) this.upvoters = [];
        if (!this.showcaseComments) this.showcaseComments = [];
        if (!this.likedBy) this.likedBy = [];
    } else {
        if (!this.likedBy) this.likedBy = [];
        if (!this.commentData) this.commentData = [];
    }
    
    // Set default values for showcase posts
    if (this.type === 'showcase') {
        if (!this.month) {
            this.month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
        }
        if (!this.launchedDate) {
            this.launchedDate = 'Coming Soon';
        }
    }
    
    next();
});

// Virtual for checking if post is a showcase
postSchema.virtual('isShowcase').get(function() {
    return this.type === 'showcase';
});

// Virtual for formatted launch date
postSchema.virtual('formattedLaunchDate').get(function() {
    if (!this.launchedDate) return 'Coming Soon';
    return this.launchedDate;
});

// ==============================================
// ✅ FIXED: METHODS FOR STARTUP SHOWCASE
// ==============================================

// Add upvote to showcase
postSchema.methods.addUpvote = function(userId) {
    if (!this.upvoters.includes(userId)) {
        this.upvoters.push(userId);
        this.upvotes += 1;
        return this.save();
    }
    return Promise.resolve(this);
};

// Remove upvote from showcase
postSchema.methods.removeUpvote = function(userId) {
    const userIndex = this.upvoters.findIndex(
        upvoterId => upvoterId.toString() === userId.toString()
    );
    if (userIndex > -1) {
        this.upvoters.splice(userIndex, 1);
        this.upvotes = Math.max(0, this.upvotes - 1);
        return this.save();
    }
    return Promise.resolve(this);
};

// Check if user has upvoted
postSchema.methods.hasUpvoted = function(userId) {
    return this.upvoters.some(
        upvoterId => upvoterId.toString() === userId.toString()
    );
};

// Add showcase comment
postSchema.methods.addShowcaseComment = function(commentData) {
    if (!this.showcaseComments) {
        this.showcaseComments = [];
    }
    
    this.showcaseComments.push(commentData);
    this.commentCount = this.showcaseComments.length;
    return this.save();
};

// Remove showcase comment
postSchema.methods.removeShowcaseComment = function(commentId) {
    if (!this.showcaseComments) return Promise.resolve(this);
    
    const commentIndex = this.showcaseComments.findIndex(
        comment => comment._id.toString() === commentId.toString()
    );
    if (commentIndex > -1) {
        this.showcaseComments.splice(commentIndex, 1);
        this.commentCount = Math.max(0, this.commentCount - 1);
        return this.save();
    }
    return Promise.resolve(this);
};

// Increment view count
postSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Get showcase statistics
postSchema.methods.getShowcaseStats = function() {
    if (this.type !== 'showcase') {
        return null;
    }
    
    return {
        upvotes: this.upvotes,
        comments: this.commentCount,
        views: this.views,
        engagementRate: this.views > 0 ? ((this.upvotes + this.commentCount) / this.views * 100).toFixed(2) : 0
    };
};

// Static method to find top showcase posts
postSchema.statics.findTopShowcases = function(limit = 10, month = null) {
    const matchStage = { type: 'showcase', status: 'approved' };
    if (month) {
        matchStage.month = month;
    }
    
    return this.aggregate([
        { $match: matchStage },
        { $sort: { upvotes: -1, commentCount: -1 } },
        { $limit: limit },
        {
            $project: {
                title: 1,
                description: 1,
                logoUrl: 1,
                upvotes: 1,
                commentCount: 1,
                views: 1,
                month: 1,
                launchedDate: 1,
                author: 1,
                authorAvatar: 1,
                upvoters: 1,
                showcaseComments: 1
            }
        }
    ]);
};

// Static method to find showcases by month
postSchema.statics.findShowcasesByMonth = function(month) {
    return this.find({ 
        type: 'showcase', 
        month: month,
        status: 'approved' 
    })
    .sort({ upvotes: -1, createdAt: -1 })
    .populate('upvoters', 'name avatar')
    .populate('showcaseComments.user', 'name avatar');
};

// Static method to get showcase analytics
postSchema.statics.getShowcaseAnalytics = function(month = null) {
    const matchStage = { type: 'showcase', status: 'approved' };
    if (month) {
        matchStage.month = month;
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalShowcases: { $sum: 1 },
                totalUpvotes: { $sum: '$upvotes' },
                totalComments: { $sum: '$commentCount' },
                totalViews: { $sum: '$views' },
                averageUpvotes: { $avg: '$upvotes' },
                averageComments: { $avg: '$commentCount' },
                averageViews: { $avg: '$views' }
            }
        }
    ]);
};

// Static method to get user's showcase posts
postSchema.statics.findUserShowcases = function(userId) {
    return this.find({ 
        type: 'showcase', 
        userId: userId 
    })
    .sort({ createdAt: -1 })
    .populate('upvoters', 'name avatar');
};

// Static method to check if user can upvote (not their own post)
postSchema.statics.canUserUpvote = async function(postId, userId) {
    const post = await this.findById(postId);
    if (!post) throw new Error('Post not found');
    if (post.userId.toString() === userId.toString()) {
        throw new Error('You cannot upvote your own post');
    }
    return !post.upvoters.includes(userId);
};

// ✅ FIXED: Indexes for better showcase performance
postSchema.index({ type: 1, month: 1, status: 1 });
postSchema.index({ type: 1, upvotes: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ type: 1, userId: 1 });
postSchema.index({ type: 1, 'showcaseComments.timestamp': -1 });
postSchema.index({ type: 1, views: -1 });
postSchema.index({ type: 1, upvoters: 1 });
postSchema.index({ type: 1, commentCount: -1 });

// ✅ FIXED: Compound indexes for common queries
postSchema.index({ type: 1, status: 1, month: 1, upvotes: -1 });
postSchema.index({ type: 1, status: 1, createdAt: -1 });
postSchema.index({ userId: 1, type: 1, createdAt: -1 });

const PostModel = mongoose.model('Post', postSchema);
const RegistrationModel = mongoose.model('Registration', registrationSchema);

module.exports = {
    Post: PostModel,
    Registration: RegistrationModel,
};