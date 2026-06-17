'use client';

import React, { useState, useEffect } from 'react';
import { Grid, Heart, MessageCircle, X, Edit, Settings, Copy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService, Post } from '@/lib/socialService';
import FollowsModal from './FollowsModal';

interface ProfileTabProps {
  currentUserId: string;
  currentUserProfile: any;
  onNavigateToTab: (tab: string) => void;
  onViewProfile?: (uid: string) => void;
  onRefreshProfile?: () => void;
}

export default function ProfileTab({
  currentUserId,
  currentUserProfile,
  onNavigateToTab,
  onViewProfile,
  onRefreshProfile
}: ProfileTabProps) {
  const addToast = useUIStore((state) => state.addToast);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<Post | null>(null);

  // Follows modal states
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');

  const loadMyPosts = async () => {
    setLoading(true);
    try {
      const allPosts = await socialService.getPosts();
      const userPosts = allPosts.filter(p => p.uid === currentUserId);
      setMyPosts(userPosts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyPosts();
  }, [currentUserId]);

  return (
    <div className="max-w-5xl mx-auto pb-16 select-none">
      
      {/* Profile Bio Details Header */}
      <Card className="p-6 bg-white brutal-border border-3 shadow-[4px_4px_0px_#111] grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Avatar Image */}
        <div className="flex flex-col items-center col-span-1">
          <div 
            onClick={() => onViewProfile?.(currentUserProfile?.uid || currentUserId)}
            className="w-24 h-24 rounded-full brutal-border overflow-hidden bg-white shadow-[3px_3px_0px_#111] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
          >
            <img
              src={currentUserProfile?.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Bio Info details */}
        <div className="col-span-2 space-y-3.5 text-center md:text-left">
          <div>
            <h2 className="font-display text-2xl uppercase text-pure-black leading-none mb-1">
              {currentUserProfile?.displayName}
            </h2>
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <span className="inline-block text-xs font-extrabold bg-light-gray text-pure-black px-2.5 py-0.5 rounded-full brutal-border">
                @{currentUserProfile?.username}
              </span>
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentUserProfile?.username || '');
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
            &ldquo;{currentUserProfile?.bio || 'No bio written yet. Customize it under settings!'}&rdquo;
          </p>

          {/* Counts metrics */}
          <div className="flex justify-center md:justify-start gap-6 border-t border-light-gray pt-3 text-xs font-mono font-bold uppercase text-pure-black">
            <span>{myPosts.length} posts</span>
            <span 
              onClick={() => { setFollowsModalType('followers'); setFollowsModalOpen(true); }}
              className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
            >
              {currentUserProfile?.followersCount || 0} followers
            </span>
            <span 
              onClick={() => { setFollowsModalType('following'); setFollowsModalOpen(true); }}
              className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
            >
              {currentUserProfile?.followingCount || 0} following
            </span>
          </div>

          {/* Action shortcuts */}
          <div className="flex justify-center md:justify-start gap-2 pt-1">
            <Button 
              variant="secondary" 
              className="py-1 px-3 text-[10px] font-display uppercase shadow-none border-pure-black flex items-center gap-1"
              onClick={() => onNavigateToTab('edit-profile')}
            >
              <Edit className="w-3.5 h-3.5" /> Edit Space
            </Button>
            <div className="hidden md:inline-block">
              <Button 
                variant="secondary" 
                className="py-1 px-3 text-[10px] font-display uppercase shadow-none border-pure-black items-center gap-1"
                onClick={() => onNavigateToTab('settings')}
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </Button>
            </div>
          </div>

        </div>

      </Card>

      {/* Profile Grid of posts */}
      <div className="mt-10">
        <h3 className="font-display text-sm uppercase tracking-wider text-mid-gray flex items-center gap-2 border-b-2 border-pure-black pb-2 mb-6">
          <Grid className="w-4.5 h-4.5" /> Your Space Posts Grid
        </h3>

        {loading ? (
          <div className="text-center py-10 font-bold uppercase text-xs">Loading posts...</div>
        ) : myPosts.length === 0 ? (
          <Card className="p-8 text-center bg-white border-2">
            <p className="text-xs font-bold text-mid-gray uppercase leading-relaxed mb-4">
              You haven't shared any posts in your social space yet.
            </p>
            <Button variant="primary" className="py-1.5 px-4 text-xs font-display uppercase" onClick={() => onNavigateToTab('create')}>
              Upload First Post
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {myPosts.map(post => (
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
              <span className="font-display text-xs uppercase">Your Post</span>
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
        userId={currentUserId}
        currentUserId={currentUserId}
        onViewProfile={onViewProfile || (() => {})}
        onRefreshProfile={onRefreshProfile}
      />

    </div>
  );
}
