import React, { useState, useEffect } from 'react';
import './Showcase.css';
import { ArrowLeft, ExternalLink, ArrowRight, ThumbsUp } from 'lucide-react';

// --- Configuration ---
const INITIAL_VISIBLE_LIMIT = 1;
const placeholderAvatar = 'https://placehold.co/40x40/cccccc/000000?text=A';

// Utility to safely extract avatar URL
const extractAvatarUrl = (avatar) => {
    if (!avatar) return placeholderAvatar;
    if (typeof avatar === 'string' && avatar.startsWith('http')) return avatar;
    if (avatar && typeof avatar === 'object' && avatar.url) return avatar.url;
    return placeholderAvatar;
};

// REVISED: Comment Section Component with typing enabled for logged-out users
const CommentSection = ({ initialComments = [], onNewComment, currentUser, onRequireLogin }) => {
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_LIMIT);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // FIXED: Initialize and sync comments with proper transformation
    useEffect(() => {
        console.log('💬 Initial comments received:', initialComments);
        
        const safeComments = Array.isArray(initialComments) ? initialComments : [];
        
        // FIXED: Transform comments to match frontend expectations
        const transformedComments = safeComments.map(comment => {
            // Handle both backend comment structures
            if (comment.user && typeof comment.user === 'object') {
                // Comment from backend with populated user
                return {
                    id: comment._id || comment.id,
                    user: comment.user.name || comment.author,
                    author: comment.user.name || comment.author,
                    avatar: extractAvatarUrl(comment.user.avatar || comment.authorAvatar),
                    text: comment.text,
                    timestamp: comment.timestamp || comment.createdAt,
                    userId: comment.user._id || comment.userId
                };
            } else {
                // Comment from frontend or different structure
                return {
                    id: comment._id || comment.id,
                    user: comment.user || comment.author,
                    author: comment.author || comment.user,
                    avatar: extractAvatarUrl(comment.avatar || comment.authorAvatar),
                    text: comment.text,
                    timestamp: comment.timestamp,
                    userId: comment.userId
                };
            }
        });

        // Sort by timestamp (newest first)
        const sortedComments = [...transformedComments].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });
        
        console.log('💬 Transformed comments:', sortedComments.length);
        setComments(sortedComments);
    }, [initialComments]);

    const handlePostComment = async () => {
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        const text = newCommentText.trim();
        if (text === '' || isSubmitting) return;

        setIsSubmitting(true);

        try {
            // Optimistic UI update
            const tempComment = {
                id: `temp-${Date.now()}`,
                user: currentUser.name,
                author: currentUser.name,
                avatar: extractAvatarUrl(currentUser.avatar),
                text: text,
                timestamp: new Date().toISOString(),
                isOptimistic: true
            };

            setComments(prev => [tempComment, ...prev]);
            setNewCommentText('');

            // Call parent handler to save to API
            await onNewComment(text);
            
        } catch (error) {
            // Remove optimistic comment on error
            setComments(prev => prev.filter(comment => !comment.isOptimistic));
            console.error('Failed to post comment:', error);
            throw error; // Re-throw to let parent handle
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePostComment();
        }
    };
    
    const handleLoadMore = () => {
        setVisibleCount(comments.length);
    };
    
    const handleCollapseComments = () => {
        setVisibleCount(INITIAL_VISIBLE_LIMIT);
    };
    
    const isExpanded = visibleCount === comments.length && comments.length > INITIAL_VISIBLE_LIMIT;
    const displayedComments = comments.slice(0, visibleCount);
    const commentsToHide = comments.length - visibleCount;
    const showLoadMoreButton = comments.length > INITIAL_VISIBLE_LIMIT && visibleCount < comments.length;
    
    const formatTimestamp = (isoString) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "Just now";

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return (
        <div className="comment-section-wrapper">
            <div className="comment-header-bar">
                <ArrowLeft 
                    size={24} 
                    className={`back-arrow-icon ${isExpanded ? 'visible' : 'hidden'}`} 
                    onClick={handleCollapseComments} 
                />
                <h2 className="section-title comment-title-header">Comments ({comments.length})</h2>
            </div>

            <div className="comment-input-container-replicate">
                <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder={currentUser ? "Add a comment..." : "Add a comment..."}
                    className="comment-input-field"
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting} 
                    rows={1}
                />
                <button 
                    type="button" 
                    className="post-comment-btn-replicate" 
                    onClick={handlePostComment} 
                    disabled={newCommentText.trim() === '' || !currentUser || isSubmitting}
                >
                    {isSubmitting ? '...' : <ArrowRight size={28} />}
                </button>
            </div>

            <div className="comments-list-replicate">
                {displayedComments.map(comment => (
                    <div key={comment.id} className="comment-item-replicate">
                        <img 
                            src={extractAvatarUrl(comment.avatar)} 
                            alt={comment.user} 
                            className="comment-avatar-replicate" 
                            onError={(e) => e.target.src = placeholderAvatar}
                        />
                        <div className="comment-content-wrapper-replicate">
                            <div className="comment-user-header-replicate">
                                <span className="comment-user-replicate">{comment.user}</span>
                                <span className="comment-timestamp-replicate">
                                    {comment.isOptimistic ? 'Posting...' : formatTimestamp(comment.timestamp)}
                                </span>
                            </div>
                            <p className="comment-text-replicate">{comment.text}</p>
                        </div>
                    </div>
                ))}

                {showLoadMoreButton && (
                    <div className="load-more-wrapper">
                        <button 
                            onClick={handleLoadMore} 
                            className="more-comments-btn"
                        >
                            +{commentsToHide} more comment{commentsToHide > 1 ? 's' : ''}
                        </button>
                    </div>
                )}
                
                {comments.length === 0 && (
                    <p className="no-comments-replicate">No comments yet. Be the first!</p>
                )}
            </div>
        </div>
    );
};

// FIXED: Main Project Details Page Component with persistent upvote state
const ProjectDetailsPage = ({ project, onGoBack, currentUser, onRequireLogin, onAddComment, API_URL, onUpvote, likedIdeas }) => {
    const [upvotes, setUpvotes] = useState(project.upvotes || project.likes || 0);
    const [isUpvoted, setIsUpvoted] = useState(false);
    const [commentCount, setCommentCount] = useState(
        project.commentCount || (Array.isArray(project.comments) ? project.comments.length : 0)
    );
    const [isUpvoting, setIsUpvoting] = useState(false);
    const [localComments, setLocalComments] = useState(project.comments || []);

    console.log('📊 ProjectDetailsPage - Project data:', {
        id: project.id,
        upvotes: project.upvotes,
        commentCount: project.commentCount,
        commentsLength: project.comments?.length,
        liked: likedIdeas.has(project.id)
    });

    // FIXED: Improved sync with proper upvote state persistence
    useEffect(() => {
        console.log('🔄 Syncing project data:', project.name);
        
        setUpvotes(project.upvotes || project.likes || 0);
        
        // FIXED: Check if current user has already upvoted this project
        const userHasUpvoted = likedIdeas.has(project.id);
        console.log('🔍 User upvote status:', { userId: currentUser?.id, projectId: project.id, userHasUpvoted });
        setIsUpvoted(userHasUpvoted);
        
        const calculatedCount = project.commentCount || (Array.isArray(project.comments) ? project.comments.length : 0);
        setCommentCount(calculatedCount);
        setLocalComments(project.comments || []);
        
        console.log('✅ Synced project data:', {
            upvotes: project.upvotes,
            isUpvoted: userHasUpvoted,
            commentCount: calculatedCount,
            comments: project.comments?.length
        });
    }, [project, likedIdeas, currentUser]);

    // FIXED: Enhanced upvote handler with proper state persistence
    const handleUpvote = async () => {
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        if (isUpvoting) return;

        console.log(`🔼 Upvoting project ${project.id}, current upvotes: ${upvotes}, isUpvoted: ${isUpvoted}`);

        setIsUpvoting(true);
        
        // Store previous state for rollback
        const previousUpvotes = upvotes;
        const previousIsUpvoted = isUpvoted;
        
        // FIXED: Clear and consistent optimistic update
        if (isUpvoted) {
            // User is unvoting (removing their upvote)
            setUpvotes(prev => Math.max(0, prev - 1));
            setIsUpvoted(false);
            console.log('🔽 Removing upvote - new count:', upvotes - 1);
        } else {
            // User is upvoting (adding their upvote)
            setUpvotes(prev => prev + 1);
            setIsUpvoted(true);
            console.log('🔼 Adding upvote - new count:', upvotes + 1);
        }

        try {
            // Call parent upvote handler which should handle the backend logic
            // The parent should return the updated state
            const result = await onUpvote(project.id);
            console.log('✅ Upvote API call successful:', result);
            
            // FIXED: Sync with actual backend response if available
            if (result && typeof result.upvotes !== 'undefined') {
                setUpvotes(result.upvotes);
            }
            if (result && typeof result.upvoted !== 'undefined') {
                setIsUpvoted(result.upvoted);
            }
            
        } catch (error) {
            // Revert on error
            console.error('❌ Upvote failed, reverting:', error);
            setUpvotes(previousUpvotes);
            setIsUpvoted(previousIsUpvoted);
            
            // Show error message to user
            alert('Failed to update vote. Please try again.');
        } finally {
            setIsUpvoting(false);
        }
    };

    // FIXED: Optimized comment handler with better state management
    const handleNewCommentPosted = async (commentText) => {
        try {
            console.log('💬 Posting new comment, current count:', commentCount);
            
            // Optimistically update count
            setCommentCount(prev => prev + 1);
            
            const newComment = await onAddComment(project.id, commentText);
            console.log('✅ Comment posted successfully:', newComment);
            
        } catch(error) {
            // Rollback on error
            console.error('❌ Comment failed, rolling back:', error);
            setCommentCount(prev => Math.max(0, prev - 1));
            throw error;
        }
    };

    if (!project) {
        return (
            <div className="project-details-container">
                <h1 className="project-name">Project Not Found</h1>
                <button className="back-button" onClick={onGoBack}>
                    <ArrowLeft size={20} /> 
                </button>
            </div>
        );
    }

    const handleVisitWebsite = () => {
        if (project.websiteLink && project.websiteLink.trim()) {
            const url = project.websiteLink.startsWith('http') ? project.websiteLink : `https://${project.websiteLink}`;
            window.open(url, '_blank');
        }
    };
    
    const hasWebsiteLink = project.websiteLink && project.websiteLink.trim().length > 0;
    const displayedUpvoters = (project.upvoters || []).slice(0, 5);
    const bannerSource = project.bannerUrl || project.banner || "https://assets.website-files.com/62c93d9b418a09618b6e6cf1/62d85b19c6e5a4f48348b47e_Hero%20Bg.png";

    return (
        <div className="project-details-container">
            {/* Back Button */}
            <button className="back-button" onClick={onGoBack}>
                <ArrowLeft size={20} /> 
            </button>

            <div className="project-header">
                <div className="project-info">
                    <img 
                        src={project.logo} 
                        alt={`${project.name} logo`} 
                        className="project-logo" 
                        onError={(e) => e.target.src = "https://placehold.co/60x60/cccccc/000000?text=L"}
                    />
                    <div className="project-text">
                        <h1 className="project-name">{project.name}</h1>
                        <p className="project-tagline">{project.description}</p>
                    </div>
                </div>
                {/* UPVOTE BUTTON - Now properly persists state between upvote/unvote */}
                <button 
                    className={`project-upvote-btn ${isUpvoted ? 'upvoted' : ''} ${isUpvoting ? 'loading' : ''}`}
                    onClick={handleUpvote}
                    disabled={isUpvoting}
                    title={isUpvoted ? 'Click to remove upvote' : 'Click to upvote'}
                >
                    <ThumbsUp 
                        size={16} 
                        fill={isUpvoted ? 'white' : 'none'}
                        style={{ marginRight: '8px' }}
                    />
                    {isUpvoting ? '...' : (isUpvoted ? 'Upvoted' : 'Upvote')}
                    {upvotes > 0 && <span className="upvote-count-badge">{upvotes}</span>}
                </button>
            </div>

            <div className="project-meta-data">
                <div className="meta-item">
                    <span className="meta-date">{project.launchedDate}</span>
                    <span className="meta-label">Launched On</span>
                </div>
                <div className="meta-item">
                    <span className="meta-count">{commentCount}</span>
                    <span className="meta-label">Comments</span>
                </div>
                {hasWebsiteLink ? (
                    <button className="meta-link-btn" onClick={handleVisitWebsite}>
                        <ExternalLink size={16} /> Visit Website
                    </button>
                ) : (
                    <div className="meta-item no-link-item">
                        <span className="meta-date" style={{ color: 'white' }}>—</span>
                        <span className="meta-label">No website provided</span>
                    </div>
                )}
            </div>
     
            <div className="section-divider"></div>

            {/* UPVOTER SECTION - Now shows real-time upvote count */}
            <div className="section-upvoters">
                <div className="upvoters-header-row">
                    <h2 className="section-title">{upvotes} Upvoter{upvotes !== 1 ? 's' : ''}</h2> 
                    {displayedUpvoters.length > 0 && (
                        <div className="upvoters-list-inline">
                            {displayedUpvoters.map((upvoter, index) => (
                                <img 
                                    key={index} 
                                    src={extractAvatarUrl(upvoter.avatar)} 
                                    alt="Upvoter" 
                                    className="upvoter-avatar" 
                                    onError={(e) => e.target.src = placeholderAvatar}
                                />
                            ))}
                            {(project.upvoters && project.upvoters.length) > displayedUpvoters.length && (
                                <span className="more-upvoters-count">+{project.upvoters.length - displayedUpvoters.length}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
     
            <div className="section-divider"></div>

            <div className="section-description">
                <h2 className="section-title">Description</h2>
                <div className="description-text">
                    <p className="concept-label">Concept:</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{project.fullDescription || project.description}</p>
                </div>
            </div>
     
            <div className="section-divider"></div>
     
            <div className="section-features-in">
                <h2 className="section-title">Banner</h2>
                <div className="features-banner">
                    <img 
                        src={bannerSource} 
                        alt={`Banner for ${project.name}`} 
                        onError={(e) => e.target.src = "https://placehold.co/800x450/cccccc/000000?text=Banner+Image"}
                    />
                </div>
            </div>

            <div className="section-divider"></div>
     
            <CommentSection 
                initialComments={localComments}
                onNewComment={handleNewCommentPosted}
                currentUser={currentUser}
                onRequireLogin={onRequireLogin}
            />
        </div>
    );
};

export default ProjectDetailsPage;