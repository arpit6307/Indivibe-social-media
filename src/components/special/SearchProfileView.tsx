'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Grid, Heart, MessageCircle, UserPlus, UserMinus, X, Copy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService, Post } from '@/lib/socialService';
import FollowsModal from './FollowsModal';

interface SearchProfileViewProps {
  currentUserId: string;
  currentUserUsername: string;
  targetUserId: string;
  onBack: () => void;
  onNavigateToTab?: (tab: string) => void;
  onRefreshProfile?: () => void;
  onViewProfile?: (uid: string) => void;
}

export default function SearchProfileView({
  currentUserId,
  currentUserUsername,
  targetUserId,
  onBack,
  onNavigateToTab,
  onRefreshProfile,
  onViewProfile
}: SearchProfileViewProps) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<Post | null>(null);

  // Follows modal states
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');

  const addToast = useUIStore((state) => state.addToast);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const targetProf = await socialService.getUserProfile(targetUserId);
      if (targetProf) {
        setProfile(targetProf);
        
        // Fetch follow status
        const myProfile = await socialService.getUserProfile(currentUserId);
        const following = myProfile?.following || [];
        setIsFollowing(following.includes(targetUserId));
        
        // Fetch posts
        const allPosts = await socialService.getPosts();
        const userPosts = allPosts.filter(p => p.uid === targetUserId);
        setPosts(userPosts);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to load user profile", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [targetUserId, currentUserId]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      const result = await socialService.toggleFollowUser(currentUserId, targetUserId);
      setIsFollowing(result.following);
      setProfile((prev: any) => prev ? { 
        ...prev, 
        followersCount: result.followersCount 
      } : null);
      
      addToast(result.following ? `Followed @${profile.username}!` : `Unfollowed @${profile.username}`, "info");
      onRefreshProfile?.();
    } catch (err: any) {
      addToast(err.message || "Failed to follow", "error");
    }
  };

  const handleCreateChat = async () => {
    if (!profile) return;
    try {
      const chatId = await socialService.createChat(currentUserId, targetUserId);
      addToast("Opening chat room!", "success");
      if (onNavigateToTab) {
        onNavigateToTab('messages');
      } else {
        onBack();
      }
    } catch (err) {
      addToast("Could not start conversation", "error");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 font-bold uppercase text-xs">
        Syncing user space...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="font-bold text-xs uppercase text-mid-gray">Space profile not found.</p>
        <Button variant="secondary" className="py-1 px-4 text-xs font-display uppercase" onClick={onBack}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 select-none animate-[fadeIn_0.15s_ease-out]">
      
      {/* Back navigation */}
      <button 
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-pure-black hover:underline mb-6"
      >
        <ChevronLeft className="w-4.5 h-4.5" /> Back to Space Directory
      </button>

      {/* Profile Info Details Header */}
      <Card className="p-6 bg-white brutal-border border-3 shadow-[4px_4px_0px_#111] grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Avatar Image */}
        <div className="flex flex-col items-center col-span-1">
          <div 
            onClick={() => onViewProfile?.(profile.uid)}
            className="w-24 h-24 rounded-full brutal-border overflow-hidden bg-white shadow-[3px_3px_0px_#111] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
          >
            <img
              src={profile.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
              alt={profile.displayName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Bio Info details */}
        <div className="col-span-2 space-y-3.5 text-center md:text-left">
          <div>
            <h2 className="font-display text-2xl uppercase text-pure-black leading-none mb-1">
              {profile.displayName}
            </h2>
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <span className="inline-block text-xs font-extrabold bg-light-gray text-pure-black px-2.5 py-0.5 rounded-full brutal-border">
                @{profile.username}
              </span>
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(profile.username || '');
                  addToast("Username copied to clipboard!", "success");
                }}
                className="p-1 rounded brutal-border bg-white text-pure-black hover:bg-brutal-yellow transition-colors shadow-[1.5px_1.5px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center"
                title="Copy Username"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs font-bold text-mid-gray leading-normal italic max-w-md mx-auto md:mx-0">
            &ldquo;{profile.bio || 'No bio written yet.'}&rdquo;
          </p>

          {/* Counts metrics */}
          <div className="flex justify-center md:justify-start gap-6 border-t border-light-gray pt-3 text-xs font-mono font-bold uppercase text-pure-black">
            <span>{posts.length} posts</span>
            <span 
              onClick={() => { setFollowsModalType('followers'); setFollowsModalOpen(true); }}
              className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
            >
              {profile.followersCount || 0} followers
            </span>
            <span 
              onClick={() => { setFollowsModalType('following'); setFollowsModalOpen(true); }}
              className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
            >
              {profile.followingCount || 0} following
            </span>
          </div>

          {/* Action shortcuts */}
          <div className="flex justify-center md:justify-start gap-2 pt-1">
            {profile.uid !== currentUserId && (
              <>
                <Button 
                  variant={isFollowing ? 'secondary' : 'primary'} 
                  className="py-1 px-4 text-[10px] font-display uppercase shadow-none border-pure-black flex items-center gap-1"
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {isFollowing ? 'Unfollow' : 'Follow Space'}
                </Button>
                <Button 
                  variant="secondary" 
                  className="py-1 px-4 text-[10px] font-display uppercase shadow-none border-pure-black flex items-center gap-1"
                  onClick={handleCreateChat}
                >
                  Send Message
                </Button>
              </>
            )}
          </div>

        </div>

      </Card>

      {/* Grid of posts */}
      <div className="mt-10">
        <h3 className="font-display text-sm uppercase tracking-wider text-mid-gray flex items-center gap-2 border-b-2 border-pure-black pb-2 mb-6">
          <Grid className="w-4.5 h-4.5" /> Space posts
        </h3>

        {posts.length === 0 ? (
          <div className="text-center py-12 text-xs font-bold text-mid-gray uppercase">
            This user hasn't posted anything yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {posts.map(post => (
              <div
                key={post.postId}
                onClick={() => setActivePost(post)}
                className="aspect-square brutal-border bg-pure-black cursor-pointer overflow-hidden relative group hover:rotate-1 transition-transform shadow-[2px_2px_0px_#111] hover:shadow-none"
              >
                <img
                  src={post.mediaUrl}
                  alt="My Post"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-pure-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white gap-3 transition-opacity">
                  <span className="text-xs font-mono font-bold flex items-center gap-0.5"><Heart className="w-3.5 h-3.5 fill-current" /> {post.likes?.length || 0}</span>
                  <span className="text-xs font-mono font-bold flex items-center gap-0.5"><MessageCircle className="w-3.5 h-3.5 fill-current" /> {post.comments?.length || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE POST DETAIL OVERLAY */}
      {activePost && (
        <div className="fixed inset-0 z-50 bg-pure-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-0 brutal-border brutal-shadow-card overflow-hidden">
            
            <div className="p-4 border-b-2 border-pure-black bg-light-gray flex justify-between items-center">
              <span className="font-display text-xs uppercase">Post Preview</span>
              <button 
                onClick={() => setActivePost(null)}
                className="p-1 rounded bg-error-red text-white brutal-border"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="w-full aspect-square bg-pure-black">
              <img src={activePost.mediaUrl} className="w-full h-full object-cover" alt="Selected" />
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs font-bold leading-normal text-pure-black">
                <span className="font-display uppercase mr-2">@{activePost.username}</span>
                {activePost.caption}
              </div>

              {activePost.comments.length > 0 && (
                <div className="border-t border-light-gray pt-2 space-y-2 max-h-32 overflow-y-auto">
                  {activePost.comments.map((comment) => (
                    <div key={comment.commentId} className="text-[10px] font-bold text-pure-black leading-tight flex items-start gap-1">
                      <span className="font-display uppercase shrink-0">@{comment.username}:</span>
                      <span className="font-medium text-[#444]">{comment.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </Card>
        </div>
      )}

      {/* Follows List Modal */}
      <FollowsModal
        isOpen={followsModalOpen}
        onClose={() => setFollowsModalOpen(false)}
        type={followsModalType}
        userId={targetUserId}
        currentUserId={currentUserId}
        onViewProfile={onViewProfile || (() => {})}
        onRefreshProfile={onRefreshProfile}
      />

    </div>
  );
}
