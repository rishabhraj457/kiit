// PostCard.jsx
import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { Heart, MessageCircle as MessageIcon, Share2, FileText, CalendarPlus, X, MapPin, Clock, Info } from 'lucide-react'; // Added Info, CalendarPlus

// Note: No Link from 'react-router-dom' needed here, as App.jsx uses state for main content routing.

const PostCard = ({ post, onLike, onShare, onAddComment, isLikedByUser, isCommentsOpen, setOpenCommentPostId }) => {
  const overlayRef = useRef(null); // Ref for the post card overlay
  const [showEventDetails, setShowEventDetails] = useState(false); // NEW: State for showing extended event details

  const handleImageError = (e) => {
    e.target.src = "https://placehold.co/400x200/cccccc/000000?text=Image+Load+Error";
    e.target.onerror = null;
  };

  const getPostTypeLabel = (type) => {
    switch (type) {
      case 'confession': return 'Confession';
      case 'event': return 'Event';
      case 'news': return 'News';
      default: return 'Post';
    }
  };

  const isInteractive = post.type !== 'news';


  const handleCommentIconClick = (e) => {
    e.stopPropagation();
    setOpenCommentPostId(isCommentsOpen ? null : post.id); // Toggle the open state
  };

  const handleBackArrowClick = (e) => {
    e.stopPropagation();
    setOpenCommentPostId(null); // Close comments
  };

  // Effect to handle clicks outside the overlay to close comments
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isCommentsOpen && overlayRef.current && !overlayRef.current.contains(event.target)) {
        setOpenCommentPostId(null); // Close comments for this post
      }
    };

    if (isCommentsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCommentsOpen, setOpenCommentPostId]);

  // --- NEW: Handle "Add to Calendar" for Event Posts ---
  const handleAddToCalendar = () => {
    if (post.type === 'event' && post.eventDate) {
      const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      const timeOptions = { hour: '2-digit', minute: '2-digit' };
      const formattedDate = post.eventDate.toLocaleDateString('en-US', dateOptions);
      const formattedTime = post.eventDate.toLocaleTimeString('en-US', timeOptions);
      alert(`Event "${post.title}" on ${formattedDate} at ${formattedTime} has been notionally added to your calendar!`);
      // In a real app, you'd integrate with a calendar API (Google Calendar, Outlook etc.) here.
    }
  };

  // Render function for the actual PostCard content (used by both normal and fixed versions)
  const renderPostCardContent = () => (
    <>
      <div className="post-header">
        <div className="post-avatar"></div>
        <div className="post-info">
          <h3 className="post-author">{post.author}</h3>
          <p className="post-timestamp">
            {post.timestamp.toLocaleDateString()} at {post.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`post-type-badge ${post.type}`}>
          {getPostTypeLabel(post.type)}
        </span>
      </div>

      <div className="post-content">
        <h2 className="post-title">{post.title}</h2>
        <p className="post-text">{post.content}</p>

        {post.type === 'event' && (
          <div className="event-details">
            {post.location && (
              <div className="event-detail">
                <MapPin size={16} />
                <span>{post.location}</span>
              </div>
            )}
            {post.eventDate && (
              <div className="event-detail">
                <Clock size={16} />
                <span>
                  {post.eventDate.toLocaleDateString()} at{' '}
                  {post.eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        )}

        {post.images.length > 0 && (
          <div className={`post-images ${post.images.length === 1 ? 'single' : post.images.length === 2 ? 'double' : post.images.length === 3 ? 'triple' : 'quad'}`}>
            {post.images.map((image, index) => (
              <img key={index} src={image} alt={`Post image ${index + 1}`} className="post-image" onError={handleImageError} />
            ))}
          </div>
        )}
      </div>

      {isInteractive && (
        <>
          <div className="post-actions">
            <button className={`action-btn ${isLikedByUser ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); onLike(post.id); }}>
              <Heart size={20} fill={isLikedByUser ? '#ef4444' : 'none'} stroke={isLikedByUser ? '#ef4444' : '#9ca3af'} />
              <span>{post.likes}</span>
            </button>
            <button className="action-btn" onClick={handleCommentIconClick}>
              <MessageIcon size={20} />
              <span>{post.commentData ? post.commentData.length : post.comments}</span>
            </button>
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); onShare(post.id, post.title, post.content); }}>
              <Share2 size={20} />
              <span>Share</span>
            </button>

            {/* --- NEW: Event Specific Buttons --- */}
            {post.type === 'event' && (
              <>
                <button className="action-btn" onClick={() => setShowEventDetails(prev => !prev)}>
                  {showEventDetails ? <X size={20} /> : <Info size={20} />} {/* X icon to close, Info to open */}
                  <span>{showEventDetails ? 'Less Info' : 'Details'}</span>
                </button>
                <button className="action-btn" onClick={handleAddToCalendar}>
                  <CalendarPlus size={20} />
                  <span>Add to Calendar</span>
                </button>
              </>
            )}
          </div>

          {/* --- NEW: Expanded Event Details Section --- */}
          {post.type === 'event' && showEventDetails && (
            <div className="expanded-event-details">
              <h4>Full Event Information</h4>
              <p><strong>Title:</strong> {post.title}</p>
              <p><strong>Description:</strong> {post.content}</p>
              {post.location && <p><strong>Location:</strong> {post.location}</p>}
              {post.eventDate && (
                <p>
                  <strong>Date & Time:</strong> {post.eventDate.toLocaleDateString()} at{' '}
                  {post.eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {/* You can add more event-specific details here if your dummy data had them, e.g., price, organizer */}
            </div>
          )}

          {/* Comment section is ALWAYS rendered when comments are open for a fixed post */}
          {isCommentsOpen && (
            <CommentSection
              comments={post.commentData || []}
              onAddComment={(commentText) => onAddComment(post.id, commentText)}
              onCloseComments={handleBackArrowClick}
            />
          )}
        </>
      )}
    </>
  );

  return (
    // If comments are open for THIS post, render it inside the fixed overlay
    isCommentsOpen ? (
      <div className={`post-card-overlay ${isCommentsOpen ? 'active' : ''}`} ref={overlayRef}>
        <div className="post-card comments-open-fixed">
          {renderPostCardContent()}
        </div>
      </div>
    ) : (
      // Otherwise, render it as a normal post card in the flow
      <div className="post-card">
        {renderPostCardContent()}
      </div>
    )
  );
};

export default PostCard;