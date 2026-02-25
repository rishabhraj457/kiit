import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Showcase.css';
import { Search, X, Image as ImageIcon, ThumbsUp, AlertCircle, Trash2, MoreVertical, ArrowLeft, ExternalLink, ArrowRight } from 'lucide-react';

// IMPORT YOUR BANNER IMAGE HERE
import StartupBanner from './assets/showcase-2.png';

// Default API URL for production
const DEFAULT_API_URL = "https://confique.onrender.com";

// --- Configuration for ProjectDetailsPage components ---
const INITIAL_VISIBLE_LIMIT = 1;
const placeholderAvatar = 'https://placehold.co/40x40/cccccc/000000?text=A';

// Utility to safely extract avatar URL
const extractAvatarUrl = (avatar) => {
    if (!avatar) return placeholderAvatar;
    if (typeof avatar === 'string' && avatar.startsWith('http')) return avatar;
    if (avatar && typeof avatar === 'object' && avatar.url) return avatar.url;
    return placeholderAvatar;
};

// Loading Component
const LoadingSpinner = ({ message = "Loading ideas..." }) => (
    <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{message}</p>
    </div>
);

// === AddIdeaModal Component (Unchanged) ===
const AddIdeaModal = ({ isOpen, onClose, onSubmit, activeMonth, currentUser, onRequireLogin }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        websiteLink: '',
        launchedDate: '', 
        logoUrl: '',
        bannerUrl: '',
        fullDescription: '', 
    });

    const [validationError, setValidationError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && !currentUser) {
            onRequireLogin();
            onClose();
        }
    }, [isOpen, currentUser, onRequireLogin, onClose]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e, fieldName) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setFormData((prev) => ({ ...prev, [fieldName]: reader.result }));
                setValidationError('');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            setValidationError('Please log in to submit an idea.');
            return;
        }

        if (!formData.logoUrl) {
            setValidationError('Please upload an Idea Logo. It is mandatory.');
            return;
        }
        if (!formData.bannerUrl) {
            setValidationError('Please upload a Banner Image. It is mandatory.');
            return;
        }
        if (!formData.launchedDate.trim()) {
            setValidationError('Launch On / Status (e.g., YYYY-MM-DD or Coming Soon) is mandatory.');
            return;
        }

        setIsSubmitting(true);
        setValidationError('');
        
        try {
            await onSubmit({
                ...formData,
                month: activeMonth,
                userId: currentUser._id,
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
            });
            
            setFormData({
                title: '',
                description: '',
                websiteLink: '',
                launchedDate: '',
                logoUrl: '',
                bannerUrl: '',
                fullDescription: '',
            });
            onClose();
        } catch (error) {
            console.error('Submission error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content add-idea-modal">
                <div className="modal-header">
                    <h2 className="modal-title">Add Your Startup Idea for {activeMonth}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>
                {!currentUser ? (
                    <div className="login-required-message">
                        <p>Please log in to submit your startup idea.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="modal-form">
                        <div className="form-group">
                            <label className="form-label">Idea Title</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="e.g., Behale"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Short Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="form-textarea"
                                placeholder="e.g., Time to replace your unhealthy food choices..."
                                required
                                disabled={isSubmitting}
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Description</label>
                            <textarea
                                name="fullDescription"
                                value={formData.fullDescription}
                                onChange={handleChange}
                                className="form-textarea"
                                placeholder="Provide a detailed explanation of your idea, concept, and target market."
                                required
                                disabled={isSubmitting}
                            ></textarea>
                        </div>
                        <div className="form-group"> 
                            <label className="form-label">Launched On / Status * (Required)</label>
                            <input
                                type="text"
                                name="launchedDate"
                                value={formData.launchedDate}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="YYYY-MM-DD or Coming Soon"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Website Link</label>
                            <input
                                type="url"
                                name="websiteLink"
                                value={formData.websiteLink}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="https://www.your-idea.com (Optional)"
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        {validationError && (
                            <div className="validation-error-message">
                                <AlertCircle size={16} />
                                {validationError}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Idea Logo *</label>
                            <div className="image-upload-container small-preview">
                                {formData.logoUrl ? (
                                    <div className="image-preview-item">
                                        <img src={formData.logoUrl} alt="Logo" className="post-image" />
                                        <button 
                                            type="button" 
                                            className="remove-image-btn" 
                                            onClick={() => { setFormData(prev => ({ ...prev, logoUrl: '' })); setValidationError(''); }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <label htmlFor="logo-upload" className={`upload-btn ${validationError.includes('Logo') ? 'error-border' : ''}`}>
                                        <ImageIcon size={16} />
                                        <span>Upload Logo</span>
                                        <input 
                                            id="logo-upload" 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileChange(e, 'logoUrl')} 
                                            style={{ display: 'none' }} 
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Banner Image *</label>
                            <div className="image-upload-container wide-preview">
                                {formData.bannerUrl ? (
                                    <div className="image-preview-item">
                                        <img src={formData.bannerUrl} alt="Banner" className="post-image" />
                                        <button 
                                            type="button" 
                                            className="remove-image-btn" 
                                            onClick={() => { setFormData(prev => ({ ...prev, bannerUrl: '' })); setValidationError(''); }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <label htmlFor="banner-upload" className={`upload-btn ${validationError.includes('Banner') ? 'error-border' : ''}`}>
                                        <ImageIcon size={16} />
                                        <span>Upload Banner</span>
                                        <input 
                                            id="banner-upload" 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleFileChange(e, 'bannerUrl')} 
                                            style={{ display: 'none' }} 
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit Idea'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

// === StartupCard Component (Unchanged) ===
const StartupCard = ({ idea, onSelectIdea, onUpvote, onDeleteIdea, currentUser, onRequireLogin, likedIdeas, isAdmin }) => {
    const isLiked = likedIdeas?.has(idea.id);
    const [isUpvoting, setIsUpvoting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // NOTE: handleUpvote is still defined but is no longer used on the main card UI.
    const handleUpvote = async (e) => {
        e.stopPropagation();
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        if (isUpvoting) {
            return;
        }

        setIsUpvoting(true);
        try {
            await onUpvote(idea.id);
        } catch (error) {
            console.error('Upvote error:', error);
        } finally {
            setIsUpvoting(false);
        }
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!isAdmin) return;

        // NOTE: Standard window.confirm() is forbidden in the final production environment.
        // It's left here as a placeholder for a custom modal UI.
        const confirmDelete = window.confirm(`Are you sure you want to delete "${idea.name}"? This action cannot be undone.`);
        if (!confirmDelete) return;

        setIsDeleting(true);
        try {
            await onDeleteIdea(idea.id);
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete idea. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowMenu(false);
        }
    };

    const toggleMenu = (e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    };

    // **NOTE on Upvote Logic:** The onClick={handleUpvote} has been REMOVED from the card's UI element 
    // to disable voting on the main showcase page, as per the previous iteration's instruction. 
    // The voting logic remains active on the ProjectDetailsPage where the `onUpvote` prop is passed.
    return (
        <div className="startup-card" onClick={() => onSelectIdea(idea)}>
            <div className="card-content">
                <img 
                    src={idea.logo} 
                    alt={`${idea.name} logo`} 
                    className="card-logo" 
                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/60x60/cccccc/000000?text=Logo"; }}
                />
                <div className="card-details">
                    <div className="card-main-info"> 
                        <h3 className="card-title">{idea.name}</h3>
                        <p className="card-description">{idea.description}</p>
                    </div>
                </div>
            </div>
            
            <div className="card-actions">
                {/* The onClick={handleUpvote} is REMOVED to disable voting on the list view. */}
                <div className={`card-upvote ${isLiked ? 'liked' : ''} ${isUpvoting ? 'upvoting' : ''}`}>
                    <ThumbsUp 
                        size={20} 
                        className="upvote-icon"
                        fill={isLiked ? '#9c77fe' : 'none'}
                        color={isLiked ? '#9c77fe' : '#6b7280'}
                    />
                    <span className="upvote-count">{idea.upvotes}</span>
                    {/* The {isLiked && <span className="upvote-text">Upvoted</span>} conditional is REMOVED to hide the text. */}
                </div>

                {isAdmin && (
                    <div className="admin-menu-container">
                        <button 
                            className="admin-menu-btn" 
                            onClick={toggleMenu}
                            disabled={isDeleting}
                        >
                            <MoreVertical size={16} />
                        </button>
                        
                        {showMenu && (
                            <div className="admin-dropdown-menu">
                                <button 
                                    className="admin-menu-item delete-item" 
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    <Trash2 size={14} />
                                    {isDeleting ? 'Deleting...' : 'Delete Idea'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showMenu && (
                <div className="menu-overlay" onClick={() => setShowMenu(false)} />
            )}
        </div>
    );
};

// === ShowcaseComponent (Main Component - Fixed for Fast Submission & Upvote Rollback) ===
const ShowcaseComponent = ({ 
    currentUser, 
    onRequireLogin, 
    API_URL = DEFAULT_API_URL,
    callApi,
    likedIdeas = new Set()
}) => {
    const [activeMonth, setActiveMonth] = useState('November \'2');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddIdeaModalOpen, setIsAddIdeaModalOpen] = useState(false);
    const [ideas, setIdeas] = useState([]);
    const [localLikedIdeas, setLocalLikedIdeas] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDetailsView, setIsDetailsView] = useState(false);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const [submissionError, setSubmissionError] = useState('');

    const isAdmin = currentUser && currentUser.email === 'confique01@gmail.com';
    const effectiveLikedIdeas = likedIdeas.size > 0 ? likedIdeas : localLikedIdeas;

    // Optimized API fetch function (Unchanged)
    const apiFetch = useCallback(async (endpoint, options = {}) => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        if (user && user.token) {
            headers['Authorization'] = `Bearer ${user.token}`;
        }

        // Use callApi if available from parent
        if (callApi) {
            return await callApi(endpoint, { ...options, headers });
        }

        // Fallback to direct fetch
        const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${API_URL}${finalEndpoint}`;
        
        console.log(`🔗 API call: ${options.method || 'GET'} ${url}`, options.body ? 'with body' : '');

        try {
            const response = await fetch(url, { 
                ...options, 
                headers,
                mode: 'cors'
            });
            
            if (!response.ok) {
                let errorText = 'Unknown error';
                try {
                    // Optimized: Handle potential non-JSON error responses gracefully
                    const isJson = response.headers.get('content-type')?.includes('application/json');
                    if (isJson) {
                        const errorData = await response.json();
                        errorText = errorData.message || JSON.stringify(errorData);
                    } else {
                        errorText = await response.text();
                    }
                } catch (e) {
                    console.error('Could not parse error response:', e);
                }
                console.error(`❌ API Error ${response.status}:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            // Handle empty responses
            const contentLength = response.headers.get('content-length');
            if (contentLength === '0' || response.status === 204) {
                return { ok: true, status: response.status };
            }
            
            return response;
        } catch (error) {
            console.error(`🚨 Network error for ${url}:`, error);
            throw error;
        }
    }, [API_URL, callApi]);

    /**
     * OPTIMIZATION 1: Fetch only essential data for the list view. (Unchanged)
     */
    const fetchIdeas = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            console.log('🔄 Fetching list ideas from API...');
            
            const response = await apiFetch('/posts'); // Use the full posts endpoint
            
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const allPosts = await response.json();
            
            const showcasePosts = allPosts
                .filter(post => post.type === 'showcase' && post.status === 'approved')
                .map(post => ({
                    // Keep ONLY necessary fields for the StartupCard and initial state
                    id: post._id,
                    name: post.title,
                    description: post.description || post.content,
                    logo: post.logoUrl || "https://placehold.co/60x60/cccccc/000000?text=Logo",
                    banner: post.bannerUrl || "https://placehold.co/800x400/cccccc/000000?text=Banner",
                    upvotes: post.upvotes || 0,
                    month: post.month || 'November \'2',
                    websiteLink: post.websiteLink,
                    launchedDate: post.launchedDate,
                    commentCount: post.commentCount || (Array.isArray(post.showcaseComments) ? post.showcaseComments.length : 0),
                    userId: post.userId,
                    author: post.author,
                    authorAvatar: post.authorAvatar,
                    timestamp: post.timestamp || post.createdAt,
                    
                    // Initial state for details fields - empty/null to be fetched later
                    fullDescription: post.fullDescription || post.content, // Keep a small text snippet in case, but rely on fetchIdeaDetails if possible
                    comments: [],
                    upvoters: [],
                }));
            
            console.log(`🎉 Final showcase posts (list data): ${showcasePosts.length}`);
            setIdeas(showcasePosts);
            
        } catch (err) {
            console.error('❌ Failed to fetch ideas:', err);
            setError('Failed to load ideas. Please check your connection.');
        } finally {
             // We do NOT set isLoading to false here, but in the useEffect after Promise.all
        }
    }, [apiFetch]);

    /**
     * OPTIMIZATION 2: New function to fetch full details ONLY when a card is clicked. (Unchanged)
     */
    const fetchIdeaDetails = useCallback(async (ideaId) => {
        try {
            // Check if the idea already has comments/full info
            const currentIdea = ideas.find(i => i.id === ideaId);
            if (currentIdea && currentIdea.comments?.length > 0 && currentIdea.fullDescription) {
                 // Already hydrated, no need to fetch again
                return currentIdea;
            }

            console.log(`🔎 Fetching full details for idea ${ideaId}...`);
            const response = await apiFetch(`/posts/${ideaId}`); // Dedicated single post endpoint
            
            if (!response.ok) {
                throw new Error(`Failed to fetch details for ${ideaId}: ${response.status}`);
            }

            const fullPost = await response.json();

            const hydratedIdea = {
                id: fullPost._id,
                name: fullPost.title,
                description: fullPost.description || fullPost.content,
                logo: fullPost.logoUrl,
                banner: fullPost.bannerUrl,
                upvotes: fullPost.upvotes || 0,
                month: fullPost.month,
                websiteLink: fullPost.websiteLink,
                launchedDate: fullPost.launchedDate,
                
                // Fields that were deferred:
                fullDescription: fullPost.fullDescription || fullPost.content,
                comments: Array.isArray(fullPost.showcaseComments) ? fullPost.showcaseComments : [],
                commentCount: fullPost.commentCount || (Array.isArray(fullPost.showcaseComments) ? fullPost.showcaseComments.length : 0),
                upvoters: Array.isArray(fullPost.upvoters) ? fullPost.upvoters : [],
                
                userId: fullPost.userId,
                author: fullPost.author,
                authorAvatar: fullPost.authorAvatar,
                timestamp: fullPost.timestamp || fullPost.createdAt
            };

            // Update the main ideas state with the full details
            setIdeas(prevIdeas => 
                prevIdeas.map(idea => (idea.id === ideaId ? hydratedIdea : idea))
            );
            
            return hydratedIdea;
            
        } catch (err) {
            console.error('❌ Failed to fetch idea details:', err);
            throw err;
        }
    }, [apiFetch, ideas]);

    // Fetch user's liked posts (Unchanged)
    const fetchLikedIdeas = useCallback(async () => {
        if (!currentUser) {
            setLocalLikedIdeas(new Set());
            return;
        }
        
        try {
            console.log('🔄 Fetching liked ideas...');
            const response = await apiFetch('/users/liked-posts');
            
            if (response.ok) {
                const data = await response.json();
                const likedSet = new Set(data.likedPostIds || data.likedPosts || []);
                console.log(`✅ User liked posts: ${likedSet.size} ideas`);
                setLocalLikedIdeas(likedSet);
            } else {
                console.warn('⚠️ Could not fetch liked posts, using empty set');
                setLocalLikedIdeas(new Set());
            }
        } catch (error) {
            console.error('❌ Error fetching liked ideas:', error);
            setLocalLikedIdeas(new Set());
        }
    }, [currentUser, apiFetch]);

    /**
     * FAST SUBMISSION FIX: Sets status to 'approved' and uses optimistic update instead of full refetch.
     */
    const handleAddIdeaSubmit = async (ideaData) => {
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        console.log('🚀 Submitting new idea for instant approval:', ideaData);

        try {
            const response = await apiFetch('/posts', {
                method: 'POST',
                body: JSON.stringify({
                    title: ideaData.title,
                    description: ideaData.description,
                    content: ideaData.fullDescription || ideaData.description,
                    fullDescription: ideaData.fullDescription,
                    websiteLink: ideaData.websiteLink,
                    launchedDate: ideaData.launchedDate,
                    logoUrl: ideaData.logoUrl,
                    bannerUrl: ideaData.bannerUrl,
                    month: ideaData.month,
                    type: 'showcase',
                    status: 'approved', // FIXED: Set to 'approved' for instant visibility
                    author: currentUser.name,
                    authorAvatar: currentUser.avatar,
                    userId: currentUser._id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error during submission' }));
                throw new Error(errorData.message || `Submission failed: ${response.status}`);
            }

            const newIdeaResponse = await response.json();
            console.log('✅ Idea submitted and instantly approved:', newIdeaResponse);

            // OPTIMIZATION: Manually construct and add the new idea to the state.
            const newIdea = {
                id: newIdeaResponse._id,
                name: newIdeaResponse.title,
                description: newIdeaResponse.description,
                logo: newIdeaResponse.logoUrl || "https://placehold.co/60x60/cccccc/000000?text=Logo",
                banner: newIdeaResponse.bannerUrl || "https://placehold.co/800x400/cccccc/000000?text=Banner",
                upvotes: newIdeaResponse.upvotes || 0,
                month: newIdeaResponse.month,
                websiteLink: ideaData.websiteLink,
                launchedDate: ideaData.launchedDate,
                commentCount: 0,
                userId: newIdeaResponse.userId,
                author: newIdeaResponse.author,
                authorAvatar: newIdeaResponse.authorAvatar,
                timestamp: newIdeaResponse.timestamp || newIdeaResponse.createdAt,
                fullDescription: newIdeaResponse.fullDescription || newIdeaResponse.content, 
                comments: [],
                upvoters: [],
            };
            
            setIdeas(prevIdeas => [newIdea, ...prevIdeas]); // Add new idea to the state for instant display
            
            alert('Your idea has been submitted and is now live!');
            
            return newIdeaResponse;

        } catch (error) {
            console.error('❌ Idea submission failed:', error);
            setSubmissionError(`Failed to submit idea: ${error.message}. Please try again.`);
            throw error;
        }
    };

    /**
     * FIXED: Enhanced upvote function with proper state management
     */
    const handleUpvoteIdea = async (ideaId) => {
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        const idea = ideas.find(idea => idea.id === ideaId);
        if (!idea) {
            console.error('❌ Idea not found for upvote:', ideaId);
            return;
        }

        console.log(`🔼 Upvoting idea ${ideaId} for user ${currentUser._id}`);

        const hasUserUpvoted = effectiveLikedIdeas.has(ideaId);
        
        // Store previous state for potential rollback
        const previousUpvotes = idea.upvotes;
        const previousLikedState = hasUserUpvoted;

        // Optimistic update - update UI immediately
        setIdeas(prevIdeas =>
            prevIdeas.map(i =>
                i.id === ideaId
                    ? { 
                          ...i, 
                          upvotes: hasUserUpvoted ? i.upvotes - 1 : i.upvotes + 1
                      }
                    : i
            )
        );

        // Update liked ideas set optimistically
        if (hasUserUpvoted) {
            setLocalLikedIdeas(prev => {
                const newSet = new Set(prev);
                newSet.delete(ideaId);
                return newSet;
            });
        } else {
            setLocalLikedIdeas(prev => new Set([...prev, ideaId]));
        }

        try {
            const response = await apiFetch(`/posts/${ideaId}/upvote`, {
                method: 'PUT',
                body: JSON.stringify({
                    userId: currentUser._id,
                    action: hasUserUpvoted ? 'unvote' : 'upvote'
                }),
            });

            if (!response.ok) {
                let errorText = 'Upvote failed due to server error.';
                try {
                    const errorData = await response.json().catch(() => ({}));
                    errorText = errorData.message || `Upvote failed: HTTP ${response.status}`;
                } catch (e) {
                    // If JSON fails to parse, errorText remains the default.
                }
                console.error('❌ Upvote failed with response:', errorText);
                
                // FIXED: Proper rollback on API error
                setIdeas(prevIdeas =>
                    prevIdeas.map(i =>
                        i.id === ideaId
                            ? { 
                                  ...i, 
                                  upvotes: previousUpvotes // Revert to original count
                              }
                            : i
                    )
                );

                // Revert liked status
                if (previousLikedState) {
                    setLocalLikedIdeas(prev => new Set([...prev, ideaId]));
                } else {
                    setLocalLikedIdeas(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(ideaId);
                        return newSet;
                    });
                }

                alert(errorText);
                throw new Error(errorText);
            }

            const result = await response.json();
            console.log('✅ Upvote successful:', result);
            
            // FIXED: Always sync with server response for consistency
            if (result.upvotes !== undefined) {
                setIdeas(prevIdeas =>
                    prevIdeas.map(i =>
                        i.id === ideaId
                            ? { 
                                  ...i, 
                                  upvotes: result.upvotes,
                                  upvoters: result.upvoters || i.upvoters
                              }
                            : i
                    )
                );
            }

            // Update liked status based on server response
            if (result.hasUpvoted !== undefined) {
                if (result.hasUpvoted) {
                    setLocalLikedIdeas(prev => new Set([...prev, ideaId]));
                } else {
                    setLocalLikedIdeas(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(ideaId);
                        return newSet;
                    });
                }
            }
            
            return result; // Return the result for the ProjectDetailsPage to use
            
        } catch (error) {
            console.error('❌ Final Upvote catch block reached. Rollback already performed if necessary.');
            throw error; // Re-throw to let ProjectDetailsPage handle it
        }
    };

    // ADMIN: Delete showcase idea (Unchanged)
    const handleDeleteIdea = async (ideaId) => {
        if (!isAdmin) {
            alert('You do not have permission to delete ideas.');
            return;
        }

        try {
            const response = await apiFetch(`/posts/${ideaId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete idea');
            }

            setIdeas(prevIdeas => prevIdeas.filter(idea => idea.id !== ideaId));
            console.log('🗑️ Idea deleted successfully');
            
        } catch (error) {
            console.error('Error deleting idea:', error);
            throw new Error('Failed to delete idea: ' + error.message);
        }
    };

    // Add comment to showcase idea. (Unchanged)
    const handleAddComment = async (ideaId, commentText) => {
        if (!currentUser) {
            onRequireLogin();
            return;
        }

        if (!commentText.trim()) {
            throw new Error('Comment cannot be empty');
        }

        console.log(`💬 Adding comment to idea ${ideaId}`);

        const commentData = {
            text: commentText.trim(),
            author: currentUser.name,
            authorAvatar: currentUser.avatar,
            userId: currentUser._id,
            timestamp: new Date().toISOString()
        };

        try {
            let response = await apiFetch(`/posts/${ideaId}/showcase-comments`, {
                method: 'POST',
                body: JSON.stringify(commentData),
            });

            if (!response.ok) {
                console.log('🔄 Trying alternative comment endpoint...');
                response = await apiFetch(`/posts/${ideaId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify(commentData),
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Comment failed:', errorText);
                throw new Error(`Failed to add comment: ${response.status}`);
            }

            const newComment = await response.json();
            console.log('✅ Comment successful:', newComment);
            
            setIdeas(prevIdeas =>
                prevIdeas.map(idea =>
                    idea.id === ideaId
                        ? {
                              ...idea,
                              comments: [newComment, ...(idea.comments || [])],
                              commentCount: (idea.commentCount || 0) + 1
                          }
                        : idea
                )
            );

            return newComment;
            
        } catch (error) {
            console.error('❌ Comment failed:', error);
            throw new Error(`Failed to add comment: ${error.message}`);
        }
    };

    /**
     * OPTIMIZATION 3: Defer fetching full data until the card is selected. (Unchanged)
     */
    const handleSelectIdea = async (idea) => {
        console.log('🔍 Selecting idea:', idea.name, 'ID:', idea.id);
        setSelectedIdea(idea); // Set initial idea data to display immediately
        setIsDetailsView(true); // Switch to details view
        
        // Fetch full details in the background (hydration)
        try {
            await fetchIdeaDetails(idea.id);
        } catch (e) {
            console.error('Failed to hydrate idea details on click:', e);
            // The details page will display a loading/error for the full details if they fail
        }
    };

    const handleGoBack = () => {
        setIsDetailsView(false);
        setSelectedIdea(null);
    };

    // Refresh data function
    const handleRefresh = () => {
        fetchIdeas();
        fetchLikedIdeas();
    };

    // Use Promise.all to fetch data concurrently
    useEffect(() => {
        const initializeApp = async () => {
            console.log('🚀 Initializing Showcase Component...');
            try {
                // Fetch list data and liked posts concurrently
                await Promise.all([
                    fetchIdeas(),
                    fetchLikedIdeas()
                ]);
            } catch (e) {
                console.error("Initialization failed:", e);
                setError("Failed to initialize data. Please refresh.");
            } finally {
                // Set loading state to false only after both initial fetches complete
                setIsLoading(false);
            }
        };

        initializeApp();
    }, [fetchIdeas, fetchLikedIdeas]);

    const months = ['November \'2'];

    // Use useMemo for efficient filtering and sorting (Unchanged)
    const filteredIdeas = useMemo(() => {
        return ideas.filter(idea => {
            if (!idea || idea.month !== activeMonth) return false;
            
            const lowerSearchTerm = searchTerm.toLowerCase();
            const nameMatches = idea.name?.toLowerCase().includes(lowerSearchTerm);
            const descriptionMatches = idea.description?.toLowerCase().includes(lowerSearchTerm);

            return nameMatches || descriptionMatches;
        }).sort((a, b) => b.upvotes - a.upvotes);
    }, [ideas, activeMonth, searchTerm]);

    // Conditional Render: Show Project Details Page
    if (isDetailsView) {
        // Find the most recent, potentially hydrated data
        const ideaForDetails = ideas.find(i => i.id === selectedIdea?.id) || selectedIdea;

        return (
            <ProjectDetailsPage 
                project={ideaForDetails} 
                onGoBack={handleGoBack}
                currentUser={currentUser}
                onRequireLogin={onRequireLogin}
                onAddComment={handleAddComment}
                API_URL={API_URL}
                onUpvote={handleUpvoteIdea}
                likedIdeas={effectiveLikedIdeas}
            />
        );
    }

    // Main Showcase View
    return (
        <div className="showcase-page-container">
            <header className="showcase-top-header">
                <div className="logo">Startup Showcase</div>
                <div className="header-actions">
                    {isAdmin && (
                        <div className="admin-badge">
                            🔧 Admin Mode
                        </div>
                    )}
                    <div className="header-buttons">
                        {/* Removed the Refresh Button here as requested by the user */}
                        <button 
                            className="post-idea-btn"
                            onClick={() => {
                                if (!currentUser) {
                                    onRequireLogin();
                                    return;
                                }
                                setIsAddIdeaModalOpen(true);
                                setSubmissionError('');
                            }}
                        >
                            Post an Idea
                        </button>
                    </div>
                </div>
            </header>

            <nav className="month-tabs">
                {months.map(month => (
                    <button
                        key={month}
                        className={`tab ${activeMonth === month ? 'active' : ''}`}
                        onClick={() => setActiveMonth(month)}
                    >
                        {month}
                    </button>
                ))}
            </nav>

            {/* BANNER */}
            <div className="hero-banner">
                <img 
                    src={StartupBanner} 
                    alt="Startup Showcase Banner" 
                    className="full-width-banner-image"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://placehold.co/1200x400/cccccc/000000?text=Startup+Showcase+Banner";
                    }}
                />
            </div>

            <div className="search-and-lucky-wrapper">
                <div className="search-input-container">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search Ideas"
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            className="clear-search-btn"
                            onClick={() => setSearchTerm('')}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {submissionError && (
                <div className="submission-error-message">
                    <AlertCircle size={16} />
                    {submissionError}
                    <button 
                        onClick={() => setSubmissionError('')}
                        className="close-error-btn"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="idea-list-container">
                {isLoading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <div className="no-results">
                        <p>{error}</p>
                        <button 
                            onClick={handleRefresh} 
                            className="retry-btn"
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredIdeas.length > 0 ? (
                    <>
                        <div className="results-count">
                            Showing {filteredIdeas.length} idea{filteredIdeas.length !== 1 ? 's' : ''}
                            {searchTerm && ` for "${searchTerm}"`}
                        </div>
                        {filteredIdeas.map(idea => (
                            <StartupCard 
                                key={idea.id} 
                                idea={idea} 
                                onSelectIdea={handleSelectIdea}
                                onUpvote={handleUpvoteIdea}
                                onDeleteIdea={handleDeleteIdea}
                                currentUser={currentUser}
                                onRequireLogin={onRequireLogin}
                                likedIdeas={effectiveLikedIdeas}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </>
                ) : (
                    <div className="no-results">
                        <p>No ideas found</p>
                        {searchTerm && (
                            <p>Try adjusting your search terms.</p>
                        )}
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="retry-btn"
                        >
                            Clear Search
                        </button>
                    </div>
                )}
            </div>

            <AddIdeaModal
                isOpen={isAddIdeaModalOpen} 
                onClose={() => {
                    setIsAddIdeaModalOpen(false);
                    setSubmissionError('');
                }}
                onSubmit={handleAddIdeaSubmit}
                activeMonth={activeMonth}
                currentUser={currentUser}
                onRequireLogin={onRequireLogin}
            />
        </div>
    );
};

// === ProjectDetailsPage Component (Fixed with proper upvote state management) ===

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

// FIXED: Main Project Details Page Component with proper upvote state management
const ProjectDetailsPage = ({ project, onGoBack, currentUser, onRequireLogin, onAddComment, API_URL, onUpvote, likedIdeas }) => {
    const [upvotes, setUpvotes] = useState(project.upvotes || project.likes || 0);
    const [isUpvoted, setIsUpvoted] = useState(likedIdeas.has(project.id));
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

    // FIXED: Sync when project prop changes
    useEffect(() => {
        console.log('🔄 Syncing project data:', project.name);
        
        setUpvotes(project.upvotes || project.likes || 0);
        setIsUpvoted(likedIdeas.has(project.id));
        
        const calculatedCount = project.commentCount || (Array.isArray(project.comments) ? project.comments.length : 0);
        setCommentCount(calculatedCount);
        setLocalComments(project.comments || []);
        
        console.log('✅ Synced project data:', {
            upvotes: project.upvotes,
            isUpvoted: likedIdeas.has(project.id),
            commentCount: calculatedCount,
            comments: project.comments?.length
        });
    }, [project, likedIdeas]);

    // FIXED: Enhanced upvote handler with proper error handling and state management
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
        
        // Optimistic update
        setUpvotes(prev => isUpvoted ? prev - 1 : prev + 1);
        setIsUpvoted(prev => !prev);

        try {
            // Call parent upvote handler and wait for result
            const result = await onUpvote(project.id);
            console.log('✅ Upvote successful on frontend:', result);
            
            // FIXED: Sync with actual server response
            if (result && result.upvotes !== undefined) {
                setUpvotes(result.upvotes);
            }
            if (result && result.hasUpvoted !== undefined) {
                setIsUpvoted(result.hasUpvoted);
            }
            
        } catch (error) {
            // FIXED: Proper rollback on error
            console.error('❌ Upvote failed, reverting:', error);
            setUpvotes(previousUpvotes);
            setIsUpvoted(previousIsUpvoted);
            
            // Show error message to user
            if (error.message.includes('cannot upvote your own post')) {
                alert('You cannot upvote your own post.');
            } else {
                alert('Failed to update vote. Please try again.');
            }
        } finally {
            setIsUpvoting(false);
        }
    };

    // FIXED: Optimized comment handler with better state management
    const handleNewCommentPosted = async (commentText) => {
        try {
            console.log('💬 Posting new comment, current count:', commentCount);
            
            // Optimistically update count and add temporary comment
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
                {/* UPVOTE BUTTON - Correctly toggles between 'Upvoted' and 'Upvote' */}
                <button 
                    className={`project-upvote-btn ${isUpvoted ? 'upvoted' : ''} ${isUpvoting ? 'loading' : ''}`}
                    onClick={handleUpvote}
                    disabled={isUpvoting}
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

            {/* UPVOTER SECTION */}
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

export default ShowcaseComponent;