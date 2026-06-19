'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Send, Plus, Volume2, VolumeX, ChevronLeft, ChevronRight, X, Play, Pause, Eye, Music, Trash2, Star, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService, Post, Story } from '@/lib/socialService';
import StoryCameraModal from './StoryCameraModal';
import { formatISTDate, formatISTTime } from '@/lib/timeUtils';

interface FeedTabProps {
  currentUserId: string;
  currentUserUsername: string;
  currentUserProfile: any;
  onViewProfile: (uid: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export default function FeedTab({
  currentUserId,
  currentUserUsername,
  currentUserProfile,
  onViewProfile,
  onNavigateToTab
}: FeedTabProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<{ [postId: string]: string }>({});
  const [showCommentsForPost, setShowCommentsForPost] = useState<string | null>(null);
  
  // Stories player modal state
  const [activeStoryGroup, setActiveStoryGroup] = useState<Story[] | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState('');
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [storyDuration, setStoryDuration] = useState(5000);
  const [storyMuted, setStoryMuted] = useState(false);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Audio playing states & references
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const activePostAudioRef = useRef<{ postId: string; audio: HTMLAudioElement; timer: NodeJS.Timeout | null } | null>(null);
  const activeStoryAudioRef = useRef<HTMLAudioElement | null>(null);
  const storyAudioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeStoryVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastSyncedRef = useRef<{ storyId: string | null; paused: boolean }>({
    storyId: null,
    paused: false
  });
  const animationFrameIdRef = useRef<number | null>(null);
  const progressElapsedRef = useRef<number>(0);
  const lastProgressTimeRef = useRef<number>(0);

  const addToast = useUIStore((state) => state.addToast);

  // Cleanup all audio players on unmount
  useEffect(() => {
    return () => {
      if (activePostAudioRef.current) {
        activePostAudioRef.current.audio.pause();
        if (activePostAudioRef.current.timer) clearInterval(activePostAudioRef.current.timer);
      }
      if (activeStoryAudioRef.current) {
        activeStoryAudioRef.current.pause();
      }
      if (storyAudioTimerRef.current) {
        clearInterval(storyAudioTimerRef.current);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Safety timeout to prevent infinite video buffering freeze
  useEffect(() => {
    if (isVideoBuffering) {
      const timer = setTimeout(() => {
        setIsVideoBuffering(false);
      }, 3000); // 3 seconds max buffering pause
      return () => clearTimeout(timer);
    }
  }, [isVideoBuffering]);

  // Helper to synchronize audio & video for the story player
  const syncStoryMedia = (group: Story[] | null, index: number, paused: boolean) => {
    // 1. If no active story group or out of bounds, pause and clean up
    if (!group || !group[index]) {
      if (activeStoryVideoRef.current) {
        activeStoryVideoRef.current.pause();
        activeStoryVideoRef.current.src = '';
      }
      if (activeStoryAudioRef.current) {
        activeStoryAudioRef.current.pause();
        activeStoryAudioRef.current.src = '';
      }
      if (storyAudioTimerRef.current) {
        clearInterval(storyAudioTimerRef.current);
        storyAudioTimerRef.current = null;
      }
      setIsVideoBuffering(false);
      lastSyncedRef.current = { storyId: null, paused: false };
      return;
    }

    // Pause any playing feed post audio when playing stories
    if (activePostAudioRef.current) {
      activePostAudioRef.current.audio.pause();
      if (activePostAudioRef.current.timer) clearInterval(activePostAudioRef.current.timer);
      activePostAudioRef.current = null;
      setPlayingPostId(null);
    }

    const story = group[index];

    // Avoid duplicate playback operations to prevent interruptions and AbortErrors
    const isSameStory = lastSyncedRef.current.storyId === story.storyId;
    const isSamePaused = lastSyncedRef.current.paused === paused;
    if (isSameStory && isSamePaused) {
      return;
    }

    lastSyncedRef.current = {
      storyId: story.storyId,
      paused: paused
    };

    // Set initial duration for this slide
    if (story.audioTrack) {
      setStoryDuration(story.audioTrack.duration * 1000);
    } else {
      setStoryDuration(5000);
    }

    // 2. Synchronize Audio Track
    if (typeof window !== 'undefined') {
      const audio = activeStoryAudioRef.current;
      if (audio) {
        if (story.audioTrack) {
          const track = story.audioTrack;
          const targetSrc = track.audioUrl;

          // Clean up old audio timer before setting new one
          if (storyAudioTimerRef.current) {
            clearInterval(storyAudioTimerRef.current);
            storyAudioTimerRef.current = null;
          }

          if (audio.src !== targetSrc) {
            audio.src = targetSrc;
            audio.load();
          }
          audio.currentTime = track.startTime;
          audio.muted = storyMuted;

          if (!paused) {
            audio.play().catch(err => {
              if (err.name === 'AbortError') return;
              console.warn("Story audio playback blocked:", err);
            });
          } else {
            audio.pause();
          }

          // Loop segment logic within the story slide duration
          const endTime = track.startTime + track.duration;
          storyAudioTimerRef.current = setInterval(() => {
            if (audio.currentTime >= endTime || audio.ended) {
              audio.currentTime = track.startTime;
              if (!paused) {
                audio.play().catch(e => {
                  if (e.name === 'AbortError') return;
                  console.warn(e);
                });
              }
            }
          }, 100);
        } else {
          audio.pause();
          audio.src = '';
          if (storyAudioTimerRef.current) {
            clearInterval(storyAudioTimerRef.current);
            storyAudioTimerRef.current = null;
          }
        }
      }
    }

    // 3. Synchronize Video Element
    const video = activeStoryVideoRef.current;
    if (video) {
      if (story.mediaType === 'video') {
        const targetSrc = story.mediaUrl;
        if (video.src !== targetSrc) {
          video.src = targetSrc;
          video.load();
        }
        video.muted = !!story.audioTrack || storyMuted; // mute if custom soundtrack is present or if user muted

        setIsVideoBuffering(true); // Default to buffering until ready

        if (!paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsVideoBuffering(false);
            }).catch(err => {
              if (err.name === 'AbortError') return;
              console.warn("Autoplay block detected on story video, forcing mute:", err);
              video.muted = true;
              video.play().then(() => {
                setIsVideoBuffering(false);
              }).catch(e => {
                if (e.name === 'AbortError') return;
                console.error("Video play failed completely:", e);
                setIsVideoBuffering(false);
              });
            });
          } else {
            setIsVideoBuffering(false);
          }
        } else {
          video.pause();
          setIsVideoBuffering(false);
        }
      } else {
        video.pause();
        video.src = '';
        setIsVideoBuffering(false);
      }
      
      // Preload adjacent slides for smooth transition
      preloadStoryImages(group, index);
    }
  };

  const preloadStoryImages = (group: Story[] | null, index: number) => {
    if (!group || typeof window === 'undefined') return;
    // Preload next slide
    if (index + 1 < group.length) {
      const nextStory = group[index + 1];
      if (nextStory.mediaType !== 'video' && nextStory.mediaUrl) {
        const img = new Image();
        img.src = nextStory.mediaUrl;
      }
    }
    // Preload previous slide (for quick back-taps)
    if (index - 1 >= 0) {
      const prevStory = group[index - 1];
      if (prevStory.mediaType !== 'video' && prevStory.mediaUrl) {
        const img = new Image();
        img.src = prevStory.mediaUrl;
      }
    }
  };

  // Stories audio autoplay & syncing fallback
  useEffect(() => {
    if (activeStoryGroup) {
      syncStoryMedia(activeStoryGroup, activeStoryIndex, storyPaused);
    }

    return () => {
      // If closing stories player completely
      if (!activeStoryGroup) {
        if (activeStoryAudioRef.current) {
          activeStoryAudioRef.current.pause();
          activeStoryAudioRef.current.src = '';
        }
        if (storyAudioTimerRef.current) {
          clearInterval(storyAudioTimerRef.current);
          storyAudioTimerRef.current = null;
        }
      }
    };
  }, [activeStoryGroup, activeStoryIndex, storyPaused]);

  // Reset progress on slide change
  useEffect(() => {
    setStoryProgress(0);
    if (typeof window !== 'undefined') {
      progressElapsedRef.current = 0;
    }
  }, [activeStoryIndex, activeStoryGroup]);

  const handleVideoMetadata = (video: HTMLVideoElement) => {
    const currentStory = activeStoryGroup?.[activeStoryIndex];
    if (currentStory && currentStory.mediaType === 'video' && !currentStory.audioTrack) {
      const dur = video.duration ? video.duration * 1000 : 5000;
      setStoryDuration(dur);
    }
  };

  // Play post audio segment
  const handlePlayPostAudio = (post: Post) => {
    if (!post.audioTrack) return;

    if (playingPostId === post.postId) {
      if (activePostAudioRef.current) {
        activePostAudioRef.current.audio.pause();
        if (activePostAudioRef.current.timer) clearInterval(activePostAudioRef.current.timer);
        activePostAudioRef.current = null;
      }
      setPlayingPostId(null);
      return;
    }

    if (activePostAudioRef.current) {
      activePostAudioRef.current.audio.pause();
      if (activePostAudioRef.current.timer) clearInterval(activePostAudioRef.current.timer);
      activePostAudioRef.current = null;
    }

    if (activeStoryAudioRef.current) {
      activeStoryAudioRef.current.pause();
      activeStoryAudioRef.current.src = '';
      if (storyAudioTimerRef.current) {
        clearInterval(storyAudioTimerRef.current);
        storyAudioTimerRef.current = null;
      }
    }

    const track = post.audioTrack;
    const audio = new Audio(track.audioUrl);
    audio.currentTime = track.startTime;
    audio.play().catch(e => console.warn(e));
    setPlayingPostId(post.postId);

    const timer = setInterval(() => {
      if (audio.currentTime >= track.startTime + track.duration || audio.ended) {
        audio.pause();
        clearInterval(timer);
        if (activePostAudioRef.current?.postId === post.postId) {
          activePostAudioRef.current = null;
          setPlayingPostId(null);
        }
      }
    }, 100);

    activePostAudioRef.current = { postId: post.postId, audio, timer };
  };

  const renderParsedCaption = (text: string) => {
    if (!text) return null;
    const regex = /(\s+|^)(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index + match[1].length;
      const matchText = match[2];
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      if (matchText.startsWith('@')) {
        const username = matchText.substring(1);
        parts.push(
          <span
            key={`mention-${matchIndex}`}
            onClick={async (e) => {
              e.stopPropagation();
              addToast(`Seeking space traveler @${username}...`, "info");
              const targetProfile = await socialService.getUserProfile(username);
              if (targetProfile && targetProfile.uid) {
                onViewProfile(targetProfile.uid);
              } else {
                addToast(`Traveler @${username} not found`, "error");
              }
            }}
            className="text-brutal-yellow hover:underline cursor-pointer font-bold bg-[#FFE834]/15 px-1 rounded-sm select-none inline-block border border-brutal-yellow/20"
          >
            {matchText}
          </span>
        );
      } else if (matchText.startsWith('#')) {
        const hashtag = matchText.substring(1);
        parts.push(
          <span
            key={`hashtag-${matchIndex}`}
            onClick={(e) => {
              e.stopPropagation();
              addToast(`Navigating directory to tag #${hashtag}...`, "info");
              onNavigateToTab('search');
              if (typeof window !== 'undefined') {
                localStorage.setItem('indivibe_initial_search_query', matchText);
              }
            }}
            className="text-mid-gray hover:underline cursor-pointer font-bold bg-light-gray px-1 rounded-sm select-none inline-block border border-mid-gray/20"
          >
            {matchText}
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  };

  const loadFeedData = async () => {
    setLoading(true);
    try {
      const allPosts = await socialService.getPosts();
      const allStories = await socialService.getStories(currentUserId);
      setPosts(allPosts);
      setStories(allStories);
    } catch (err) {
      console.error("Error loading feed data:", err);
      addToast("Failed to load feed data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData();
  }, []);

  // Record story view when viewer is different from author
  useEffect(() => {
    if (activeStoryGroup && activeStoryGroup[activeStoryIndex]) {
      const currentStory = activeStoryGroup[activeStoryIndex];
      if (currentStory.uid !== currentUserId) {
        fetch(`/api/social/stories/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId: currentStory.storyId,
            viewerUid: currentUserId,
            viewerUsername: currentUserUsername,
            viewerProfilePhotoUrl: currentUserProfile?.profilePhotoUrl || ''
          })
        }).then(res => {
          if (res.ok) {
            // View successfully logged. Refresh story viewers list locally.
            res.json().then(data => {
              if (data.success && data.viewers) {
                // Update local viewers in group
                setActiveStoryGroup(prev => {
                  if (!prev) return null;
                  return prev.map(s => s.storyId === currentStory.storyId ? { ...s, viewers: data.viewers } : s);
                });
              }
            });
          }
        }).catch(err => console.error("Error recording view:", err));
      }
    }
  }, [activeStoryGroup, activeStoryIndex, currentUserId, currentUserUsername, currentUserProfile]);

  // Handle double-tap to like
  const lastTapRef = useRef<{ [postId: string]: number }>({});
  const [heartAnimPostId, setHeartAnimPostId] = useState<string | null>(null);

  const handleDoubleTap = async (postId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[postId] || 0;
    if (now - lastTap < 300) {
      // It is a double tap
      setHeartAnimPostId(postId);
      setTimeout(() => setHeartAnimPostId(null), 800);
      
      const post = posts.find(p => p.postId === postId);
      if (post && !post.likes.includes(currentUserId)) {
        await handleLike(postId);
      }
    }
    lastTapRef.current[postId] = now;
  };

  const handleLike = async (postId: string) => {
    try {
      const updatedLikes = await socialService.toggleLikePost(postId, currentUserId, currentUserUsername);
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, likes: updatedLikes } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentSubmit = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;

    try {
      const newComment = await socialService.addComment(postId, currentUserId, currentUserUsername, text);
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return { ...p, comments: [...(p.comments || []), newComment] };
        }
        return p;
      }));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      addToast("Comment posted!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to comment", "error");
    }
  };

  // Group stories by user uid for bubble display
  const storiesByUser: { [uid: string]: Story[] } = {};
  stories.forEach(story => {
    if (!storiesByUser[story.uid]) {
      storiesByUser[story.uid] = [];
    }
    storiesByUser[story.uid].push(story);
  });

  // requestAnimationFrame based smooth story progression
  useEffect(() => {
    if (!activeStoryGroup) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    if (storyPaused || isVideoBuffering) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    // Reset last time on resume/start
    lastProgressTimeRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = now - lastProgressTimeRef.current;
      lastProgressTimeRef.current = now;

      progressElapsedRef.current += delta;
      const duration = storyDuration || 5000;
      const pct = Math.min(100, (progressElapsedRef.current / duration) * 100);

      setStoryProgress(pct);

      if (pct >= 100) {
        // Advance to next story
        handleNextStory();
      } else {
        animationFrameIdRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [activeStoryGroup, activeStoryIndex, storyPaused, isVideoBuffering, storyDuration]);

  // Hoist closeStoryViewer above handlers that use it to avoid TDZ lint warnings
  const closeStoryViewer = () => {
    setActiveStoryGroup(null);
    setActiveStoryIndex(0);
    setStoryProgress(0);
    if (typeof window !== 'undefined') {
      progressElapsedRef.current = 0;
    }
    setIsVideoBuffering(false);
    syncStoryMedia(null, 0, false);
  };

  const handleNextStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.length - 1) {
      const nextIndex = activeStoryIndex + 1;
      setActiveStoryIndex(nextIndex);
      setStoryProgress(0);
      if (typeof window !== 'undefined') {
        progressElapsedRef.current = 0;
      }
      // Synchronously trigger play for next slide
      syncStoryMedia(activeStoryGroup, nextIndex, storyPaused);
    } else {
      // Finished all stories in this group
      closeStoryViewer();
    }
  };

  const handlePrevStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex > 0) {
      const prevIndex = activeStoryIndex - 1;
      setActiveStoryIndex(prevIndex);
      setStoryProgress(0);
      if (typeof window !== 'undefined') {
        progressElapsedRef.current = 0;
      }
      // Synchronously trigger play for previous slide
      syncStoryMedia(activeStoryGroup, prevIndex, storyPaused);
    } else {
      setActiveStoryIndex(0);
      setStoryProgress(0);
      if (typeof window !== 'undefined') {
        progressElapsedRef.current = 0;
      }
      syncStoryMedia(activeStoryGroup, 0, storyPaused);
    }
  };

  const openStoryViewer = (userStories: Story[]) => {
    setActiveStoryGroup(userStories);
    setActiveStoryIndex(0);
    setStoryProgress(0);
    if (typeof window !== 'undefined') {
      progressElapsedRef.current = 0;
    }
    setStoryPaused(false);
    // Synchronously trigger playback to capture user click gesture!
    syncStoryMedia(userStories, 0, false);
  };

  const toggleStoryPause = () => {
    const nextPaused = !storyPaused;
    setStoryPaused(nextPaused);
    syncStoryMedia(activeStoryGroup, activeStoryIndex, nextPaused);
  };

  const toggleStoryMuted = () => {
    const nextMuted = !storyMuted;
    setStoryMuted(nextMuted);
    
    if (activeStoryAudioRef.current) {
      activeStoryAudioRef.current.muted = nextMuted;
      if (!nextMuted && !storyPaused) {
        activeStoryAudioRef.current.play().catch(err => console.warn("Audio play failed on unmute:", err));
      }
    }
    
    if (activeStoryVideoRef.current) {
      const currentStory = activeStoryGroup?.[activeStoryIndex];
      const hasAudioTrack = !!currentStory?.audioTrack;
      activeStoryVideoRef.current.muted = hasAudioTrack ? true : nextMuted;
      if (!nextMuted && !storyPaused && !hasAudioTrack) {
        activeStoryVideoRef.current.play().catch(err => console.warn("Video play failed on unmute:", err));
      }
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* 24h Stories Bar */}
      <div className="brutal-border bg-white p-4 rounded-lg shadow-[4px_4px_0px_#111] overflow-x-auto flex gap-4 select-none scrollbar-none">
        
        {/* Post new story shortcut bubble */}
        {(() => {
          const currentUserStories = storiesByUser[currentUserId] || [];
          const hasActiveStories = currentUserStories.length > 0;
          const isCF = currentUserStories.some(s => s.audience === 'close_friends');
          
          return (
            <div 
              className="flex flex-col items-center shrink-0 cursor-pointer"
              onClick={() => {
                if (hasActiveStories) {
                  openStoryViewer(currentUserStories);
                } else {
                  setIsCameraOpen(true);
                }
              }}
            >
              <div className={`w-16 h-16 rounded-full p-0.5 border-2 ${
                hasActiveStories 
                  ? isCF 
                    ? 'border-dashed border-[#34C759] animate-pulse' 
                    : 'border-dashed border-error-red animate-pulse' 
                  : 'border-pure-black'
              } mb-1.5 relative`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white brutal-border">
                  <img
                    src={currentUserProfile?.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + currentUserUsername}
                    alt="Your Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Small Plus icon badge (Always clickable to add story) */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCameraOpen(true);
                  }}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brutal-yellow brutal-border border flex items-center justify-center shadow-[1px_1px_0px_#111] hover:scale-110 active:scale-95 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5 text-pure-black stroke-[3]" />
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase text-pure-black">Your Story</span>
            </div>
          );
        })()}

        {/* Story User list */}
        {Object.entries(storiesByUser)
          .filter(([uid]) => uid !== currentUserId)
          .map(([uid, userStories]) => {
            const firstStory = userStories[0];
            const hasUnseen = true; // Can expand to track seen/unseen
            const isCFGroup = userStories.some(s => s.audience === 'close_friends');
            return (
              <div 
                key={uid} 
                className="flex flex-col items-center shrink-0 cursor-pointer"
                onClick={() => openStoryViewer(userStories)}
              >
                <div className={`w-16 h-16 rounded-full p-0.5 border-2 ${
                  hasUnseen 
                    ? isCFGroup 
                      ? 'border-dashed border-[#34C759] animate-pulse' 
                      : 'border-dashed border-error-red animate-pulse' 
                    : 'border-pure-black'
                } mb-1.5`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-white brutal-border">
                    <img
                      src={firstStory.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                      alt={firstStory.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase text-pure-black max-w-[70px] truncate">
                  @{firstStory.username}
                </span>
              </div>
            );
          })}

        {stories.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs font-bold text-mid-gray uppercase py-4">
            No active stories in your network.
          </div>
        )}
      </div>

      {/* Main Feed Card Stream */}
      <div className="space-y-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-pure-black border-t-brutal-yellow rounded-full animate-spin"></div>
            <p className="text-sm font-display uppercase mt-3">Loading IndiVibe feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <h3 className="font-display text-xl uppercase mb-2">Feed is Empty!</h3>
            <p className="text-xs font-bold text-mid-gray uppercase mb-6 leading-relaxed">
              Start following people or share your first post inside the Creation Studio.
            </p>
            <Button variant="primary" className="py-2 px-5 text-xs font-display uppercase" onClick={() => onNavigateToTab('create')}>
              Create First Post
            </Button>
          </Card>
        ) : (
          posts.map((post) => {
            const isLiked = post.likes.includes(currentUserId);
            return (
              <Card key={post.postId} className="p-0 bg-white overflow-hidden select-none">
                
                {/* Post Header (Always on Top) */}
                <div className="p-4 flex items-center justify-between border-b-2 border-pure-black bg-[#FAFAF8]">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(post.uid)}>
                    <div className="w-10 h-10 rounded-full overflow-hidden brutal-border bg-white shadow-[2px_2px_0px_#111]">
                      <img
                        src={post.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                        alt={post.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-display text-sm uppercase leading-none text-pure-black hover:underline">
                        {post.displayName}
                      </h4>
                      <span className="text-[10px] font-bold text-mid-gray">
                        @{post.username}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-extrabold uppercase text-mid-gray">
                      {formatISTDate(post.createdAt)}
                    </span>
                    {post.uid === currentUserId && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this post?")) {
                            const success = await socialService.deletePost(post.postId);
                            if (success) {
                              addToast("Post deleted successfully!", "success");
                              loadFeedData();
                            } else {
                              addToast("Failed to delete post", "error");
                            }
                          }
                        }}
                        className="p-1.5 rounded bg-error-red/10 text-error-red border border-error-red/20 hover:bg-error-red hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                        title="Delete Post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Split Content Body: Media on Left, Details/Comments on Right */}
                <div className="flex flex-col md:flex-row md:h-[500px] w-full">
                  
                  {/* Left Column: Post Media */}
                  <div 
                    className="w-full md:w-[55%] aspect-square md:aspect-auto md:h-full relative bg-pure-black border-b-2 md:border-b-0 md:border-r-2 border-pure-black flex items-center justify-center overflow-hidden cursor-pointer shrink-0"
                    onClick={() => handleDoubleTap(post.postId)}
                  >
                    {post.mediaType === 'video' ? (
                      <video
                        src={post.mediaUrl}
                        controls
                        muted={!!post.audioTrack}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={post.mediaUrl}
                        alt="Post Media"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Heart Pop Animation Overlay */}
                    {heartAnimPostId === post.postId && (
                      <div className="absolute inset-0 flex items-center justify-center bg-pure-black/30 z-10 animate-[fadeIn_0.15s_ease-out]">
                        <Heart className="w-24 h-24 text-error-red fill-current animate-[ping_0.8s_infinite] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions, Caption & Scrollable Comments list */}
                  <div className="w-full md:w-[45%] p-4 flex flex-col justify-between h-full overflow-hidden bg-white">
                    
                    {/* Top part: Actions, Caption, and Comments list */}
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-4 shrink-0">
                        <button 
                          onClick={() => handleLike(post.postId)} 
                          className={`hover:scale-110 transition-transform ${isLiked ? 'text-error-red' : 'text-pure-black'}`}
                          aria-label={isLiked ? "Unlike" : "Like"}
                        >
                          <Heart className={`w-6 h-6 stroke-[2.5] ${isLiked ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          onClick={() => setShowCommentsForPost(showCommentsForPost === post.postId ? null : post.postId)}
                          className="hover:scale-110 transition-transform text-pure-black"
                          aria-label="Comment"
                        >
                          <MessageCircle className="w-6 h-6 stroke-[2.5]" />
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(post.mediaUrl);
                            addToast("Media link copied to clipboard!", "success");
                          }}
                          className="hover:scale-110 transition-transform text-pure-black ml-auto"
                          aria-label="Share Link"
                        >
                          <Send className="w-6 h-6 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Likes count */}
                      <div className="text-xs font-mono font-extrabold uppercase text-pure-black shrink-0">
                        {post.likes.length} likes
                      </div>

                      {/* Caption */}
                      <div className="text-xs font-bold leading-normal text-pure-black shrink-0">
                        <span className="font-display text-sm uppercase mr-2 cursor-pointer hover:underline" onClick={() => onViewProfile(post.uid)}>
                          @{post.username}
                        </span>
                        {renderParsedCaption(post.caption)}
                      </div>

                      {/* Audio Track Badge */}
                      {post.audioTrack && (
                        <div className="p-2 bg-light-gray brutal-border border-2 border-pure-black shadow-[2px_2px_0px_#111] rounded-lg flex items-center justify-between gap-2.5 mt-1 select-none">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded border border-pure-black bg-white overflow-hidden shrink-0">
                              <img src={post.audioTrack.coverUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-display text-[10px] uppercase text-pure-black truncate leading-tight">
                                {post.audioTrack.title}
                              </h5>
                              <p className="text-[8px] font-mono text-mid-gray uppercase truncate mt-0.5">
                                {post.audioTrack.artist} • {post.audioTrack.duration}s clip
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {playingPostId === post.postId && (
                              <div className="flex gap-0.5 items-end h-2.5 pr-0.5">
                                <div className="w-0.5 bg-pure-black animate-[equalizer_0.6s_ease-in-out_infinite]" style={{ animationDelay: '0.1s' }} />
                                <div className="w-0.5 bg-pure-black animate-[equalizer_0.8s_ease-in-out_infinite]" style={{ animationDelay: '0.3s' }} />
                                <div className="w-0.5 bg-pure-black animate-[equalizer_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
                                <div className="w-0.5 bg-pure-black animate-[equalizer_0.7s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePlayPostAudio(post)}
                              className={`p-1.5 rounded-full border border-pure-black shadow-[1.5px_1.5px_0px_#111] active:translate-y-0.5 active:shadow-none hover:shadow-none transition-all cursor-pointer ${
                                playingPostId === post.postId ? 'bg-error-red text-white' : 'bg-brutal-yellow text-pure-black'
                              }`}
                              aria-label={playingPostId === post.postId ? "Pause Post Music" : "Play Post Music"}
                            >
                              {playingPostId === post.postId ? (
                                <Pause className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* View comments toggle */}
                      {post.comments.length > 0 && (
                        <button
                          onClick={() => setShowCommentsForPost(showCommentsForPost === post.postId ? null : post.postId)}
                          className="text-[10px] font-extrabold uppercase text-mid-gray hover:underline tracking-wider shrink-0 text-left"
                        >
                          {showCommentsForPost === post.postId ? 'Hide' : 'View all'} {post.comments.length} comments
                        </button>
                      )}

                      {/* Scrollable Comments list (overflow auto on desktop) */}
                      {showCommentsForPost === post.postId && (
                        <div className="border-t-2 border-pure-black pt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[80px] md:min-h-0">
                          {post.comments.length === 0 ? (
                            <div className="text-[10px] font-bold text-mid-gray uppercase italic py-2">No comments yet.</div>
                          ) : (
                            post.comments.map((comment) => (
                              <div key={comment.commentId} className="text-xs font-bold text-pure-black leading-tight flex items-start gap-1">
                                <span className="font-display uppercase hover:underline cursor-pointer shrink-0" onClick={() => onViewProfile(comment.uid)}>
                                  @{comment.username}:
                                </span>
                                <span className="font-medium text-[#333]">{comment.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    </div>

                    {/* Bottom part: Write Comment Box */}
                    <div className="border-t-2 border-pure-black pt-3 mt-3 flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentText[post.postId] || ''}
                        onChange={(e) => setCommentText(prev => ({ ...prev, [post.postId]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommentSubmit(post.postId);
                        }}
                        className="flex-1 bg-light-gray brutal-border text-xs px-3 py-2 outline-none font-bold text-pure-black"
                      />
                      <Button 
                        variant="primary" 
                        className="py-2 px-3 text-xs font-display uppercase"
                        onClick={() => handleCommentSubmit(post.postId)}
                      >
                        Post
                      </Button>
                    </div>

                  </div>

                </div>

              </Card>
            );
          })
        )}
      </div>

      {/* STORY VIEWER MODAL PLAYER */}
      <div 
        className={`fixed inset-0 bg-pure-black flex flex-col items-center justify-center p-4 select-none transition-all duration-300 ${
          activeStoryGroup 
            ? 'opacity-100 pointer-events-auto z-50 flex' 
            : 'opacity-0 pointer-events-none z-[-10] flex'
        }`}
      >
        <div className="w-full max-w-md bg-pure-black rounded-lg overflow-hidden h-[90vh] flex flex-col relative border-4 border-white shadow-[8px_8px_0px_#111]">
          
          {/* Slide progress bars */}
          <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5">
            {(activeStoryGroup || []).map((story, idx) => (
              <div key={story.storyId} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white"
                  style={{
                    width: idx < activeStoryIndex ? '100%' : idx === activeStoryIndex ? `${storyProgress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Story Header */}
          <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <div className="w-9 h-9 rounded-full overflow-hidden brutal-border border-white bg-white">
                <img
                  src={activeStoryGroup?.[activeStoryIndex]?.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="font-display text-sm uppercase leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {activeStoryGroup?.[activeStoryIndex]?.username || ''}
                </span>
                <span className="block text-[8px] font-bold text-light-gray drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {activeStoryGroup?.[activeStoryIndex]?.audience === 'close_friends' ? (
                    <span className="text-[#34C759] flex items-center gap-0.5">⭐ Close Friends Only</span>
                  ) : (
                    'Active Story'
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {activeStoryGroup?.[activeStoryIndex]?.uid === currentUserId && (
                <>
                  <button
                    onClick={() => {
                      closeStoryViewer();
                      setIsCameraOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] md:text-xs font-display uppercase tracking-wider text-pure-black bg-brutal-yellow hover:bg-[#FFE300] border-2 border-pure-black shadow-[2px_2px_0px_#111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0px_0px_0px_#111] transition-all rounded"
                    title="Add another story slide"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3] text-pure-black" /> Add Slide
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Are you sure you want to delete this story?")) {
                        setStoryPaused(true);
                        const currentStory = activeStoryGroup?.[activeStoryIndex];
                        if (!currentStory) return;
                        const success = await socialService.deleteStory(currentStory.storyId);
                        if (success) {
                          addToast("Story deleted!", "success");
                          // Filter out deleted story from active group
                          const updatedGroup = activeStoryGroup.filter(s => s.storyId !== currentStory.storyId);
                          if (updatedGroup.length === 0) {
                            // Close player
                            closeStoryViewer();
                          } else {
                            // If we deleted the last slide, go back one
                            const nextIndex = activeStoryIndex >= updatedGroup.length ? updatedGroup.length - 1 : activeStoryIndex;
                            setActiveStoryGroup(updatedGroup);
                            setActiveStoryIndex(nextIndex);
                            setStoryProgress(0);
                            setStoryPaused(false);
                            syncStoryMedia(updatedGroup, nextIndex, false);
                          }
                          loadFeedData();
                        } else {
                          addToast("Failed to delete story", "error");
                          setStoryPaused(false);
                        }
                      }
                    }}
                    className="p-1.5 text-[#FF3B30] bg-pure-black/35 rounded hover:bg-[#FF3B30]/10 focus:outline-none flex items-center justify-center border border-white/20"
                    title="Delete story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={toggleStoryPause}
                className="p-1.5 text-white bg-pure-black/35 rounded hover:bg-pure-black/60 focus:outline-none flex items-center justify-center border border-white/20"
                aria-label={storyPaused ? "Resume" : "Pause"}
              >
                {storyPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={closeStoryViewer}
                className="p-1.5 text-white bg-pure-black/35 rounded hover:bg-pure-black/60 focus:outline-none flex items-center justify-center border border-white/20"
                aria-label="Close stories player"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Story Viewer screen */}
          <div className="flex-1 bg-pure-black flex items-center justify-center relative">
            <audio
              ref={activeStoryAudioRef}
              playsInline
              className="hidden"
            />
            <video
              ref={activeStoryVideoRef}
              loop
              playsInline
              webkit-playsinline="true"
              muted={!!activeStoryGroup?.[activeStoryIndex]?.audioTrack}
              onWaiting={() => {
                if (activeStoryGroup?.[activeStoryIndex]?.mediaType === 'video' && activeStoryVideoRef.current?.src) {
                  setIsVideoBuffering(true);
                }
              }}
              onPlaying={() => setIsVideoBuffering(false)}
              onCanPlay={() => setIsVideoBuffering(false)}
              onSeeked={() => setIsVideoBuffering(false)}
              onLoadedMetadata={(e) => handleVideoMetadata(e.currentTarget)}
              className={`w-full h-full object-contain ${
                activeStoryGroup?.[activeStoryIndex]?.mediaType === 'video' ? 'block' : 'hidden'
              }`}
            />
            {activeStoryGroup?.[activeStoryIndex]?.mediaType !== 'video' && activeStoryGroup?.[activeStoryIndex]?.mediaUrl && (
              <img
                src={activeStoryGroup?.[activeStoryIndex]?.mediaUrl}
                alt="Story Media"
                loading="eager"
                decoding="async"
                className="w-full h-full object-contain"
              />
            )}

            {/* Dynamic Text Overlay Render */}
            {activeStoryGroup?.[activeStoryIndex]?.caption?.trim() && (
              <div 
                style={{ 
                  left: `${activeStoryGroup?.[activeStoryIndex]?.textPosition?.x ?? 50}%`, 
                  top: `${activeStoryGroup?.[activeStoryIndex]?.textPosition?.y ?? 45}%`, 
                  transform: 'translate(-50%, -50%)',
                  position: 'absolute'
                }}
                className="max-w-[80%] text-center z-30 pointer-events-none"
              >
                <span 
                  style={{ color: activeStoryGroup?.[activeStoryIndex]?.textColor ?? '#ffffff' }}
                  className={`px-4 py-2 text-sm md:text-lg font-bold block rounded-xl break-words leading-relaxed select-none ${
                    activeStoryGroup?.[activeStoryIndex]?.textBg !== false ? 'bg-pure-black/65 backdrop-blur-xs brutal-border text-white' : ''
                  }`}
                >
                  {activeStoryGroup?.[activeStoryIndex]?.caption}
                </span>
              </div>
            )}

            {/* Blur Shield Protection against visible Screen Capture (Simulation) */}
            <div className="absolute inset-0 pointer-events-none border-[6px] border-dashed border-error-red opacity-10 animate-pulse"></div>

            {/* Floating Music Sticker */}
            {activeStoryGroup?.[activeStoryIndex]?.audioTrack && (
              <div className="absolute bottom-16 right-4 z-30 animate-[bounce_2s_infinite] max-w-[70%]">
                <div className="px-3 py-1.5 bg-brutal-yellow brutal-border border-2 border-pure-black shadow-[3px_3px_0px_#111] rounded flex items-center gap-2 select-none">
                  <Music className="w-3.5 h-3.5 text-pure-black fill-current animate-[spin_4s_linear_infinite]" />
                  <div className="min-w-0 flex flex-col text-left">
                    <span className="font-display text-[9px] uppercase text-pure-black truncate leading-none font-bold">
                      {activeStoryGroup?.[activeStoryIndex]?.audioTrack?.title}
                    </span>
                    <span className="text-[7px] font-mono text-pure-black/70 uppercase truncate mt-0.5 font-extrabold">
                      {activeStoryGroup?.[activeStoryIndex]?.audioTrack?.artist}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tap zones for going back/forward */}
            <button 
              onClick={handlePrevStory}
              className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-2 text-white/20 hover:text-white/80 transition-colors focus:outline-none"
              aria-label="Previous story"
            >
              <ChevronLeft className="w-8 h-8 stroke-[2.5]" />
            </button>
            <button 
              onClick={handleNextStory}
              className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-2 text-white/20 hover:text-white/80 transition-colors focus:outline-none"
              aria-label="Next story"
            >
              <ChevronRight className="w-8 h-8 stroke-[2.5]" />
            </button>

            {/* Viewers counter (visible only to story author) */}
            {activeStoryGroup?.[activeStoryIndex]?.uid === currentUserId && (
              <div className="absolute bottom-4 left-4 z-30">
                <button
                  onClick={() => {
                    setStoryPaused(true);
                    setShowViewersList(true);
                    setViewerSearchQuery('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pure-black/70 hover:bg-pure-black border border-white/25 text-white rounded text-xs font-bold transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Eye className="w-3.5 h-3.5 text-white" />
                  <span>{(activeStoryGroup?.[activeStoryIndex] as any)?.viewers?.length || 0} Viewers</span>
                </button>
              </div>
            )}
          </div>

          {/* Expired date note */}
          <div className="bg-pure-black text-center text-[9px] font-bold text-mid-gray p-2 border-t border-white/20 uppercase tracking-widest">
            Story expires automatically in 24 hours
          </div>

        </div>
      </div>

      {/* STORY VIEWERS LIST MODAL (Instagram-style Bottom Sheet) */}
      {showViewersList && activeStoryGroup?.[activeStoryIndex] && (() => {
        const viewers = (activeStoryGroup?.[activeStoryIndex] as any)?.viewers || [];
        const filteredViewers = viewers.filter((v: any) =>
          v.username.toLowerCase().includes(viewerSearchQuery.toLowerCase())
        );

        return (
          <div className="fixed inset-0 z-50 bg-pure-black/80 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full max-w-md bg-white border-t-4 md:border-4 border-pure-black rounded-t-2xl md:rounded-lg h-[65vh] md:h-[50vh] flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.2)] md:shadow-[8px_8px_0px_#111] text-pure-black overflow-hidden">
              {/* Drag handle for mobile */}
              <div className="w-12 h-1 bg-mid-gray/30 rounded-full mx-auto my-3 md:hidden shrink-0" />
              
              {/* Header */}
              <div className="flex justify-between items-center px-5 pb-3 border-b-2 border-pure-black pt-1 md:pt-4 shrink-0">
                <h4 className="font-display text-xs md:text-sm uppercase flex items-center gap-1.5 font-extrabold tracking-wider">
                  <Eye className="w-4 h-4 text-pure-black" />
                  Story Viewers ({viewers.length})
                </h4>
                <button 
                  onClick={() => {
                    setShowViewersList(false);
                    setStoryPaused(false);
                  }}
                  className="p-1 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-5 pt-3 pb-2 shrink-0">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-mid-gray pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search username..."
                    value={viewerSearchQuery}
                    onChange={(e) => setViewerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-light-gray brutal-border text-xs outline-none font-bold text-pure-black placeholder:text-mid-gray rounded shadow-[2px_2px_0px_#111] focus:bg-white transition-colors"
                  />
                  {viewerSearchQuery && (
                    <button
                      onClick={() => setViewerSearchQuery('')}
                      className="absolute right-3 text-xs font-bold text-mid-gray hover:text-pure-black"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              {/* Viewers List */}
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2.5 scrollbar-none">
                {filteredViewers.length === 0 ? (
                  <p className="text-center py-8 text-xs font-bold text-mid-gray uppercase tracking-wider">
                    {viewerSearchQuery ? 'No matching viewers' : 'No viewers yet'}
                  </p>
                ) : (
                  filteredViewers.map((viewer: any) => (
                    <div 
                      key={viewer.uid} 
                      className="flex items-center justify-between bg-light-gray/40 brutal-border border-2 p-2 rounded hover:bg-light-gray/70 transition-colors shadow-[2px_2px_0px_#111] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_#111]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden brutal-border bg-white shadow-[1px_1px_0px_#111]">
                          <img
                            src={viewer.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + viewer.username}
                            alt={viewer.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span 
                          onClick={() => {
                            setShowViewersList(false);
                            closeStoryViewer();
                            onViewProfile(viewer.uid);
                          }}
                          className="text-xs font-extrabold uppercase text-pure-black cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
                        >
                          @{viewer.username}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-mid-gray uppercase bg-light-gray px-1.5 py-0.5 rounded border border-pure-black/10">
                        {formatISTTime(viewer.viewedAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* STORY CAMERA MODAL */}
      <StoryCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        currentUserId={currentUserId}
        currentUserUsername={currentUserUsername}
        currentUserProfile={currentUserProfile}
        onRefreshFeed={loadFeedData}
      />

      <style>{`
        @keyframes equalizer {
          0%, 100% { height: 3px; }
          50% { height: 10px; }
        }
      `}</style>

    </div>
  );
}
