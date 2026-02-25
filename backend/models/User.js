const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// New sub-schema for avatar to align with the new backend logic
const avatarSchema = new mongoose.Schema({
    url: { 
        type: String, 
        required: true,
        validate: {
            validator: function(url) {
                return url && url.length > 0;
            },
            message: 'Avatar URL cannot be empty'
        }
    },
    publicId: { 
        type: String, 
        required: true 
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Please provide a valid email address'
        }
    },
    password: {
        type: String,
        sparse: true,
        minlength: 6,
        validate: {
            validator: function(password) {
                // Only validate if password exists (for OAuth users)
                if (!password) return true;
                return password.length >= 6;
            },
            message: 'Password must be at least 6 characters long'
        }
    },
    phone: {
        type: String,
        sparse: true,
        default: null,
        trim: true
    },
    // FIX: Change avatar type to use the new schema
    avatar: {
        type: avatarSchema,
        default: {
            url: 'https://placehold.co/40x40/cccccc/000000?text=A',
            publicId: 'default_avatar'
        }
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    // ==============================================
    // NEW STARTUP SHOWCASE FIELDS
    // ==============================================
    
    // User profile enhancements for showcase
    bio: { 
        type: String,
        maxlength: 500,
        trim: true
    },
    website: { 
        type: String,
        trim: true,
        validate: {
            validator: function(website) {
                if (!website) return true;
                try {
                    new URL(website);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Please provide a valid website URL'
        }
    },
    linkedin: { 
        type: String,
        trim: true
    },
    twitter: { 
        type: String,
        trim: true
    },
    
    // Showcase engagement tracking
    upvotedPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    bookmarkedPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],

    // Showcase analytics
    showcaseStats: {
        postsCreated: { type: Number, default: 0 },
        totalUpvotesReceived: { type: Number, default: 0 },
        totalCommentsReceived: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now }
    }

}, {
    timestamps: true,
    collation: { locale: 'en', strength: 2 },
    toJSON: {
        transform: function(doc, ret) {
            // Remove sensitive information when converting to JSON
            delete ret.password;
            delete ret.googleId;
            return ret;
        }
    }
});

// Pre-save hook for password hashing (only if password is provided/modified)
userSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

// ==============================================
// NEW METHODS FOR STARTUP SHOWCASE
// ==============================================

// Add upvoted post
userSchema.methods.addUpvotedPost = function(postId) {
    if (!this.upvotedPosts.includes(postId)) {
        this.upvotedPosts.push(postId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Remove upvoted post
userSchema.methods.removeUpvotedPost = function(postId) {
    this.upvotedPosts = this.upvotedPosts.filter(
        id => id.toString() !== postId.toString()
    );
    return this.save();
};

// Add bookmarked post
userSchema.methods.addBookmarkedPost = function(postId) {
    if (!this.bookmarkedPosts.includes(postId)) {
        this.bookmarkedPosts.push(postId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Remove bookmarked post
userSchema.methods.removeBookmarkedPost = function(postId) {
    this.bookmarkedPosts = this.bookmarkedPosts.filter(
        id => id.toString() !== postId.toString()
    );
    return this.save();
};

// Check if user has upvoted a post
userSchema.methods.hasUpvoted = function(postId) {
    return this.upvotedPosts.some(id => id.toString() === postId.toString());
};

// Check if user has bookmarked a post
userSchema.methods.hasBookmarked = function(postId) {
    return this.bookmarkedPosts.some(id => id.toString() === postId.toString());
};

// Get user's showcase statistics (with caching)
userSchema.methods.getShowcaseStats = async function() {
    const Post = mongoose.model('Post');
    
    // Check if stats are recent (less than 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (this.showcaseStats.lastUpdated > oneHourAgo) {
        return this.showcaseStats;
    }

    const [
        postsCreated,
        totalUpvotesReceived,
        totalCommentsReceived
    ] = await Promise.all([
        Post.countDocuments({ userId: this._id, type: 'showcase' }),
        Post.aggregate([
            { $match: { userId: this._id, type: 'showcase' } },
            { $group: { _id: null, total: { $sum: '$upvotes' } } }
        ]),
        Post.aggregate([
            { $match: { userId: this._id, type: 'showcase' } },
            { $group: { _id: null, total: { $sum: '$commentCount' } } }
        ])
    ]);

    // Update cached stats
    this.showcaseStats = {
        postsCreated,
        totalUpvotesReceived: totalUpvotesReceived[0]?.total || 0,
        totalCommentsReceived: totalCommentsReceived[0]?.total || 0,
        lastUpdated: new Date()
    };

    await this.save();
    
    return this.showcaseStats;
};

// Update showcase stats (call this when posts/upvotes/comments change)
userSchema.methods.updateShowcaseStats = async function() {
    this.showcaseStats.lastUpdated = new Date(0); // Force refresh
    return this.getShowcaseStats();
};

// Get user's showcase posts with pagination
userSchema.methods.getShowcasePosts = async function(page = 1, limit = 10) {
    const Post = mongoose.model('Post');
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
        Post.find({ userId: this._id, type: 'showcase' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('upvoters', 'name avatar')
            .select('title description month upvotes comments commentCount createdAt status'),
        Post.countDocuments({ userId: this._id, type: 'showcase' })
    ]);

    return {
        posts,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

// Virtual for avatar URL (for backward compatibility)
userSchema.virtual('avatarUrl').get(function() {
    return typeof this.avatar === 'object' ? this.avatar.url : this.avatar;
});

// Static method to find users by showcase engagement
userSchema.statics.findTopShowcaseUsers = async function(limit = 10) {
    return this.aggregate([
        {
            $lookup: {
                from: 'posts',
                localField: '_id',
                foreignField: 'userId',
                as: 'showcasePosts'
            }
        },
        {
            $addFields: {
                showcasePostCount: {
                    $size: {
                        $filter: {
                            input: '$showcasePosts',
                            as: 'post',
                            cond: { $eq: ['$$post.type', 'showcase'] }
                        }
                    }
                },
                totalUpvotesReceived: {
                    $sum: {
                        $map: {
                            input: {
                                $filter: {
                                    input: '$showcasePosts',
                                    as: 'post',
                                    cond: { $eq: ['$$post.type', 'showcase'] }
                                }
                            },
                            as: 'post',
                            in: '$$post.upvotes'
                        }
                    }
                }
            }
        },
        {
            $sort: { 
                showcasePostCount: -1,
                totalUpvotesReceived: -1 
            }
        },
        {
            $limit: limit
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                showcasePostCount: 1,
                totalUpvotesReceived: 1,
                bio: 1
            }
        }
    ]);
};

// Indexes for better showcase performance
userSchema.index({ upvotedPosts: 1 });
userSchema.index({ bookmarkedPosts: 1 });
userSchema.index({ 'showcaseStats.postsCreated': -1 });
userSchema.index({ 'showcaseStats.totalUpvotesReceived': -1 });
userSchema.index({ createdAt: -1 }); // For recent users

module.exports = mongoose.model('User', userSchema);