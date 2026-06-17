'use client';

import React, { useState, useEffect } from 'react';
import { X, UserCheck, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useUIStore } from '@/store/uiStore';
import { socialService } from '@/lib/socialService';

interface FollowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  userId: string;
  currentUserId: string;
  onViewProfile: (uid: string) => void;
  onRefreshProfile?: () => void;
}

export default function FollowsModal({
  isOpen,
  onClose,
  type,
  userId,
  currentUserId,
  onViewProfile,
  onRefreshProfile
}: FollowsModalProps) {
  const addToast = useUIStore((state) => state.addToast);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserFollowing, setCurrentUserFollowing] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch target user profile to get follower/following UIDs
      const profile = await socialService.getUserProfile(userId);
      if (!profile) {
        setUsersList([]);
        setLoading(false);
        return;
      }

      const targetUids = type === 'followers' ? (profile.followers || []) : (profile.following || []);

      // 2. Fetch current user's profile to know who the logged-in user is following
      const myProfile = await socialService.getUserProfile(currentUserId);
      setCurrentUserFollowing(myProfile?.following || []);

      if (targetUids.length === 0) {
        setUsersList([]);
        setLoading(false);
        return;
      }

      // 3. Fetch all users to filter and obtain profile details
      const allUsers = await socialService.getAllUsers();
      const matchedUsers = allUsers.filter((u: any) => targetUids.includes(u.uid));
      setUsersList(matchedUsers);
    } catch (err) {
      console.error("Error loading follows data:", err);
      addToast("Failed to load list.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, userId, type]);

  const handleFollowToggle = async (targetUser: any) => {
    try {
      const result = await socialService.toggleFollowUser(currentUserId, targetUser.uid);
      
      // Update local following state for the logged-in user
      if (result.following) {
        setCurrentUserFollowing(prev => [...prev, targetUser.uid]);
        addToast(`Followed @${targetUser.username}!`, "info");
      } else {
        setCurrentUserFollowing(prev => prev.filter(id => id !== targetUser.uid));
        addToast(`Unfollowed @${targetUser.username}`, "info");
      }

      // Trigger profile refresh in the parent view to update header stats
      onRefreshProfile?.();
    } catch (err: any) {
      addToast(err.message || "Action failed", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-pure-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm bg-white brutal-border border-3 shadow-[6px_6px_0px_#111] overflow-hidden flex flex-col max-h-[75vh] p-0">
        
        {/* Header (Brutal Yellow Accent) */}
        <div className="p-4 border-b-3 border-pure-black bg-brutal-yellow flex justify-between items-center text-pure-black">
          <h3 className="font-display text-lg uppercase tracking-tight select-none">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded brutal-border border-2 bg-error-red text-white hover:bg-red-600 hover:shadow-none shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="w-4.5 h-4.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-off-white select-none">
          {loading ? (
            <div className="text-center py-10 font-bold uppercase text-[10px] tracking-wider text-mid-gray animate-pulse">
              Retrieving profiles...
            </div>
          ) : usersList.length === 0 ? (
            <div className="text-center py-10 brutal-border border-2 border-dashed bg-white p-4">
              <p className="text-[10px] font-bold text-mid-gray uppercase tracking-wide">
                No users found.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {usersList.map((user) => {
                const isMe = user.uid === currentUserId;
                const isFollowing = currentUserFollowing.includes(user.uid);

                return (
                  <div 
                    key={user.uid}
                    className="p-2.5 border-2 border-pure-black bg-white shadow-[2px_2px_0px_#111] flex items-center justify-between hover:bg-[#FAFAF8] transition-colors"
                  >
                    {/* User profile details clickable */}
                    <div 
                      onClick={() => {
                        onViewProfile(user.uid);
                        onClose();
                      }}
                      className="flex items-center cursor-pointer flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-pure-black overflow-hidden bg-white shadow-[1px_1px_0px_#111] shrink-0">
                        <img
                          src={user.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
                          alt={user.displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col ml-3 min-w-0 pr-2">
                        <span className="font-display text-[11px] uppercase text-pure-black leading-tight truncate hover:underline">
                          {user.displayName}
                        </span>
                        <span className="text-[9px] font-extrabold text-mid-gray truncate">
                          @{user.username}
                        </span>
                      </div>
                    </div>

                    {/* Follow/Unfollow action button */}
                    {!isMe && (
                      <button
                        onClick={() => handleFollowToggle(user)}
                        className={`px-3 py-1 text-[9px] font-display uppercase brutal-border border-2 shadow-[1.5px_1.5px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1 ${
                          isFollowing 
                            ? 'bg-off-white text-pure-black hover:bg-light-gray' 
                            : 'bg-brutal-yellow text-pure-black hover:bg-yellow-300'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
