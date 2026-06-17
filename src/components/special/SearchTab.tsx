'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Radar, Grid, UserPlus, UserMinus, X, Eye, Heart, MessageCircle, Copy, Lock, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { socialService, Post } from '@/lib/socialService';
import FollowsModal from './FollowsModal';
import { formatISTDate } from '@/lib/timeUtils';

interface SearchTabProps {
  currentUserId: string;
  currentUserUsername: string;
  onViewProfile?: (uid: string) => void;
  onRefreshProfile?: () => void;
}

export default function SearchTab({
  currentUserId,
  currentUserUsername,
  onViewProfile,
  onRefreshProfile
}: SearchTabProps) {
  const [queryStr, setQueryStr] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [radarActive, setRadarActive] = useState(false);
  
  const [activePostDetails, setActivePostDetails] = useState<Post | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  // Follows modal states
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');

  const addToast = useUIStore((state) => state.addToast);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const radarAnimRef = useRef<number | null>(null);

  // Load real user recommendations dynamically
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const res = await fetch('/api/social/users');
        if (res.ok) {
          const list = await res.json();
          // Filter out current user
          const filtered = list.filter((u: any) => u.uid !== currentUserId);
          setSuggestedUsers(filtered);
        }
      } catch (err) {
        console.error("Failed to load suggested users:", err);
      }
    };
    loadSuggestions();
  }, [currentUserId]);

  // Perform search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!queryStr.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await socialService.searchUsers(queryStr);
        setSearchResults(results);
      } catch (err) {
        console.error("Search users error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [queryStr]);

  // Load selected user posts and follow status
  useEffect(() => {
    if (!selectedUser) return;

    const loadUserData = async () => {
      try {
        const allPosts = await socialService.getPosts();
        const userPosts = allPosts.filter(p => p.uid === selectedUser.uid);
        setSelectedUserPosts(userPosts);

        // Fetch current fresh profile to check follow array
        const myProfile = await socialService.getUserProfile(currentUserId);
        const following = myProfile?.following || [];
        setIsFollowing(following.includes(selectedUser.uid));

        // Check if follow request was sent (for private accounts)
        const sentRequests = myProfile?.sentFollowRequests || [];
        setIsRequested(sentRequests.includes(selectedUser.uid));
      } catch (err) {
        console.error(err);
      }
    };

    loadUserData();
  }, [selectedUser, currentUserId]);

  const handleFollowToggle = async () => {
    if (!selectedUser) return;
    try {
      const result = await socialService.toggleFollowUser(currentUserId, selectedUser.uid);
      setIsFollowing(result.following);
      setIsRequested(result.requested || false);
      setSelectedUser((prev: any) => prev ? { 
        ...prev, 
        followersCount: result.followersCount 
      } : null);
      
      if (result.requested) {
        addToast(`Follow request sent to @${selectedUser.username}!`, "info");
      } else if (result.following) {
        addToast(`Followed @${selectedUser.username}!`, "info");
      } else {
        addToast(`Unfollowed @${selectedUser.username}`, "info");
      }
      onRefreshProfile?.();
    } catch (err: any) {
      addToast(err.message || "Failed to follow", "error");
    }
  };

  // Proximity radar animation
  useEffect(() => {
    if (!radarActive || !radarCanvasRef.current) return;

    const canvas = radarCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    let sweepAngle = 0;

    // Fake nearby post pins within 1km
    const points = [
      { x: centerX + 50, y: centerY - 60, title: "Biryani Point local post", distance: "250m" },
      { x: centerX - 80, y: centerY + 30, title: "Chai Tapri post", distance: "480m" },
      { x: centerX + 70, y: centerY + 80, title: "Brutalist architecture photo", distance: "720m" }
    ];

    const drawRadar = () => {
      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, width, height);

      // Radar circles
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.5;
      
      // Outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
      ctx.stroke();

      // Middle ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - 130, centerY);
      ctx.lineTo(centerX + 130, centerY);
      ctx.moveTo(centerX, centerY - 130);
      ctx.lineTo(centerX, centerY + 130);
      ctx.stroke();

      // Sweep line
      sweepAngle += 0.02;
      const sweepX = centerX + Math.cos(sweepAngle) * 120;
      const sweepY = centerY + Math.sin(sweepAngle) * 120;
      
      ctx.strokeStyle = '#FFE834';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Draw user center dot
      ctx.fillStyle = '#FF9933'; // Indian saffron
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw nearby blip points
      points.forEach(p => {
        // Calculate angle of sweeping line to points
        const pointAngle = Math.atan2(p.y - centerY, p.x - centerX);
        let diff = sweepAngle % (Math.PI * 2) - pointAngle;
        if (diff < 0) diff += Math.PI * 2;
        
        // Show indicator if sweep is close
        const intensity = diff < 0.6 ? 1 - diff / 0.6 : 0.05;
        
        ctx.fillStyle = `rgba(18, 136, 7, ${intensity})`; // green blip
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();

        if (intensity > 0.6) {
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`${p.title} (${p.distance})`, p.x + 8, p.y - 4);
        }
      });

      radarAnimRef.current = requestAnimationFrame(drawRadar);
    };

    drawRadar();

    return () => {
      if (radarAnimRef.current) cancelAnimationFrame(radarAnimRef.current);
    };
  }, [radarActive]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 select-none">
      
      {/* Tab controls: Search vs Proximity Radar */}
      <div className="grid grid-cols-2 gap-4 border-3 border-pure-black p-1 bg-white rounded-lg shadow-[3px_3px_0px_#111]">
        <button
          onClick={() => { setRadarActive(false); }}
          className={`py-2 text-xs font-display uppercase brutal-border border-0 rounded text-center tracking-wider ${
            !radarActive ? 'bg-brutal-yellow text-pure-black font-bold' : 'bg-transparent text-mid-gray'
          }`}
        >
          <Search className="w-3.5 h-3.5 inline mr-1.5" /> User Search
        </button>
        <button
          onClick={() => { setRadarActive(true); }}
          className={`py-2 text-xs font-display uppercase brutal-border border-0 rounded text-center tracking-wider ${
            radarActive ? 'bg-brutal-yellow text-pure-black font-bold' : 'bg-transparent text-mid-gray'
          }`}
        >
          <Radar className="w-3.5 h-3.5 inline mr-1.5" /> Proximity Radar (1km)
        </button>
      </div>

      {!radarActive ? (
        // Search View
        <div className="space-y-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by username, display name, or patr.in ID..."
              value={queryStr}
              onChange={(e) => setQueryStr(e.target.value)}
              className="w-full bg-white text-pure-black font-bold text-sm brutal-border py-3 pl-11 pr-4 rounded-lg shadow-[3px_3px_0px_#111] outline-none"
            />
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-mid-gray stroke-[2.5]" />
          </div>

          {searching ? (
            <div className="text-center py-10 font-bold uppercase text-xs animate-pulse">
              Searching IndiVibe Directory...
            </div>
          ) : queryStr && searchResults.length === 0 ? (
            <div className="text-center py-10 font-bold uppercase text-xs text-mid-gray">
              No matching Patr profiles found.
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((user) => (
                <Card 
                  key={user.uid} 
                  hoverable
                  onClick={() => setSelectedUser(user)}
                  className="p-4 bg-white flex items-center justify-between cursor-pointer border-2 shadow-[3px_3px_0px_#111]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden brutal-border bg-white shadow-[2px_2px_0px_#111]">
                      <img
                        src={user.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-display text-sm uppercase text-pure-black leading-none mb-0.5">
                        {user.displayName}
                      </h4>
                      <span className="text-xs text-mid-gray font-bold">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                  <Button variant="secondary" className="py-1 px-3 text-[10px] font-display uppercase shadow-none border-pure-black">
                    View Space
                  </Button>
                </Card>
              ))}
            </div>
          )}


        </div>
      ) : (
        // Proximity Radar View
        <Card className="p-6 bg-white flex flex-col items-center justify-center space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-display text-lg uppercase">IndiVibe Radar Shield</h3>
            <p className="text-xs font-bold text-mid-gray max-w-sm mx-auto uppercase leading-normal">
              Showing anonymous local posts made within 1km. Your exact coordinates are completely encrypted.
            </p>
          </div>

          <div className="brutal-border bg-white rounded-lg overflow-hidden shadow-[4px_4px_0px_#111] max-w-md w-full">
            <canvas
              ref={radarCanvasRef}
              width="360"
              height="300"
              className="w-full h-[280px]"
            />
          </div>

          <div className="text-[10px] font-extrabold uppercase text-success-green border border-success-green px-2 py-0.5 rounded bg-success-green/10 flex items-center gap-1.5 animate-pulse">
            <Radar className="w-3.5 h-3.5" /> Shield Active: Scanned 3 posts nearby
          </div>
        </Card>
      )}

      {/* SELECTED USER PUBLIC PROFILE OVERLAY MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-40 bg-pure-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-xl bg-off-white brutal-border brutal-shadow-card p-0 overflow-y-auto max-h-[85vh]">
            
            {/* Overlay Header */}
            <div className="p-4 border-b-2 border-pure-black flex justify-between items-center bg-[#FAFAF8]">
              <span className="font-display text-sm uppercase text-mid-gray">
                @{selectedUser.username}'s Space
              </span>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded brutal-border bg-error-red text-white hover:shadow-none shadow-[2px_2px_0px_#111] active:translate-x-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Profile Bio Details */}
            <div className="p-6 border-b-2 border-pure-black bg-white grid grid-cols-3 gap-6 items-center">
              <div className="col-span-1 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full brutal-border overflow-hidden bg-white shadow-[2px_2px_0px_#111]">
                  <img
                    src={selectedUser.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                    alt="User Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="col-span-2 space-y-3">
                <div>
                  <h3 className="font-display text-xl uppercase text-pure-black leading-none mb-0.5">
                    {selectedUser.displayName}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase bg-light-gray text-pure-black border border-pure-black px-1.5 py-0.5 rounded">
                      @{selectedUser.username}
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedUser.username || '');
                        addToast("Username copied to clipboard!", "success");
                      }}
                      className="p-1 rounded brutal-border bg-white text-pure-black hover:bg-brutal-yellow transition-colors shadow-[1px_1px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center"
                      title="Copy Username"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <p className="text-xs font-bold text-mid-gray leading-normal italic">
                  &ldquo;{selectedUser.bio || 'No bio written yet.'}&rdquo;
                </p>

                {/* Followers, Following counts */}
                {selectedUser.isPrivate && !isFollowing && selectedUser.uid !== currentUserId ? (
                  <div className="flex gap-4 border-t border-light-gray pt-2 text-[10px] font-mono font-bold uppercase text-mid-gray">
                    <span>{selectedUserPosts.length} posts</span>
                    <span className="flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> followers</span>
                    <span className="flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> following</span>
                  </div>
                ) : (
                  <div className="flex gap-4 border-t border-light-gray pt-2 text-[10px] font-mono font-bold uppercase text-mid-gray">
                    <span>{selectedUserPosts.length} posts</span>
                    <span 
                      onClick={() => { setFollowsModalType('followers'); setFollowsModalOpen(true); }}
                      className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
                    >
                      {selectedUser.followersCount} followers
                    </span>
                    <span 
                      onClick={() => { setFollowsModalType('following'); setFollowsModalOpen(true); }}
                      className="cursor-pointer hover:underline hover:text-brutal-yellow transition-colors"
                    >
                      {selectedUser.followingCount} following
                    </span>
                  </div>
                )}

                {/* Follow Button */}
                {selectedUser.uid !== currentUserId && (
                  <Button 
                    variant={isFollowing ? 'secondary' : isRequested ? 'secondary' : 'primary'} 
                    className={`w-full py-1.5 text-xs font-display uppercase tracking-wider ${
                      isRequested ? 'opacity-70' : ''
                    }`}
                    onClick={handleFollowToggle}
                  >
                    {isFollowing ? (
                      <span className="flex items-center justify-center gap-1"><UserMinus className="w-3.5 h-3.5" /> Unfollow</span>
                    ) : isRequested ? (
                      <span className="flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5" /> Requested</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Follow Space</span>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Grid of posts */}
            <div className="p-6">
              {/* Private account lock for non-followers */}
              {selectedUser.isPrivate && !isFollowing && selectedUser.uid !== currentUserId ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full border-3 border-pure-black flex items-center justify-center bg-light-gray shadow-[3px_3px_0px_#111]">
                    <Lock className="w-7 h-7 text-pure-black" />
                  </div>
                  <div>
                    <h4 className="font-display text-sm uppercase text-pure-black">This Account is Private</h4>
                    <p className="text-[10px] font-bold text-mid-gray uppercase mt-1">
                      Follow this user to see their posts and activity
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="font-display text-xs uppercase tracking-wider text-mid-gray flex items-center gap-1.5 border-b-2 border-pure-black pb-2 mb-4">
                    <Grid className="w-4 h-4" /> Shared Posts
                  </h4>
                  {selectedUserPosts.length === 0 ? (
                    <div className="text-center py-12 text-xs font-bold text-mid-gray uppercase">
                      This user hasn't posted anything yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {selectedUserPosts.map(post => (
                        <div 
                          key={post.postId}
                          onClick={() => setActivePostDetails(post)}
                          className="aspect-square brutal-border bg-pure-black cursor-pointer overflow-hidden relative group hover:rotate-1 transition-transform"
                        >
                          <img 
                            src={post.mediaUrl} 
                            alt="Shared" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-pure-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white gap-2 transition-opacity">
                            <span className="text-xs font-mono font-bold flex items-center gap-0.5"><Heart className="w-3.5 h-3.5 fill-current" /> {post.likes.length}</span>
                            <span className="text-xs font-mono font-bold flex items-center gap-0.5"><MessageCircle className="w-3.5 h-3.5 fill-current" /> {post.comments.length}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

          </Card>
        </div>
      )}

      {/* POST DETAILS MODAL OVERLAY */}
      {activePostDetails && (
        <div className="fixed inset-0 z-50 bg-pure-black/85 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-0 brutal-border brutal-shadow-card overflow-hidden">
            <div className="p-4 border-b-2 border-pure-black bg-light-gray flex justify-between items-center">
              <span className="font-display text-xs uppercase">Post Details</span>
              <button 
                onClick={() => setActivePostDetails(null)}
                className="p-1 rounded bg-error-red text-white brutal-border"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <div className="w-full aspect-square bg-pure-black">
              <img src={activePostDetails.mediaUrl} className="w-full h-full object-cover" alt="Post" />
            </div>

            <div className="p-4 space-y-2">
              <div className="text-xs font-bold leading-normal text-pure-black">
                <span className="font-display uppercase mr-2">@{activePostDetails.username}</span>
                {activePostDetails.caption}
              </div>
              <div className="text-[10px] font-mono text-mid-gray">
                Likes: {activePostDetails.likes.length} | Comments: {activePostDetails.comments.length}
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Follows List Modal */}
      <FollowsModal
        isOpen={followsModalOpen}
        onClose={() => setFollowsModalOpen(false)}
        type={followsModalType}
        userId={selectedUser ? selectedUser.uid : currentUserId}
        currentUserId={currentUserId}
        onViewProfile={onViewProfile || (() => {})}
        onRefreshProfile={onRefreshProfile}
      />

    </div>
  );
}
