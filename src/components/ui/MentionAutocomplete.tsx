'use client';

import React, { useEffect, useState, useRef } from 'react';
import { socialService } from '@/lib/socialService';

interface MentionAutocompleteProps {
  inputValue: string;
  cursorPosition: number;
  currentUserId: string;
  onSelect: (username: string, startIdx: number, endIdx: number) => void;
  className?: string;
}

export function MentionAutocomplete({
  inputValue,
  cursorPosition,
  currentUserId,
  onSelect,
  className = ''
}: MentionAutocompleteProps) {
  const [matchingUsers, setMatchingUsers] = useState<any[]>([]);
  const [triggerRange, setTriggerRange] = useState<{ start: number; end: number } | null>(null);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load user's followed list once
  useEffect(() => {
    if (!currentUserId) return;
    const loadFollowing = async () => {
      try {
        setLoading(true);
        // Fetch current user's profile to get their following list
        const profile = await socialService.getUserProfile(currentUserId);
        const followingUids: string[] = profile?.following || [];
        
        if (followingUids.length > 0) {
          // Fetch details for all users and filter
          const res = await fetch('/api/social/users');
          const allUsers = await res.json();
          if (Array.isArray(allUsers)) {
            const filtered = allUsers.filter((u: any) => followingUids.includes(u.uid));
            setFollowingList(filtered);
          }
        }
      } catch (err) {
        console.warn('Failed to load following list for autocomplete:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFollowing();
  }, [currentUserId]);

  // Detect if user is typing "@"
  useEffect(() => {
    if (!inputValue) {
      setTriggerRange(null);
      setMatchingUsers([]);
      return;
    }

    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    // Find last "@" symbol in text before cursor
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx === -1) {
      setTriggerRange(null);
      setMatchingUsers([]);
      return;
    }

    // Verify there are no spaces between the '@' and the cursor
    const textBetween = textBeforeCursor.substring(lastAtIdx + 1);
    if (/\s/.test(textBetween)) {
      setTriggerRange(null);
      setMatchingUsers([]);
      return;
    }

    // We have a match!
    const query = textBetween.toLowerCase();
    setTriggerRange({ start: lastAtIdx, end: cursorPosition });

    // Filter followed users by query
    const filtered = followingList.filter(user => 
      user.username?.toLowerCase().includes(query) || 
      user.displayName?.toLowerCase().includes(query)
    );
    setMatchingUsers(filtered);
  }, [inputValue, cursorPosition, followingList]);

  if (matchingUsers.length === 0 || !triggerRange) {
    return null;
  }

  return (
    <div className={`absolute z-[100] bg-white brutal-border border-2 border-pure-black shadow-[2.5px_2.5px_0px_#111] rounded max-h-40 overflow-y-auto w-56 ${className}`}>
      {matchingUsers.map((user) => (
        <div
          key={user.uid}
          onMouseDown={(e) => {
            // Prevent input onBlur from firing before onClick by using onMouseDown
            e.preventDefault();
            onSelect(user.username, triggerRange.start, triggerRange.end);
          }}
          className="flex items-center gap-2 p-2 hover:bg-brutal-yellow/30 border-b border-light-gray last:border-0 cursor-pointer select-none"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden brutal-border border border-pure-black bg-white">
            <img
              src={user.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-display uppercase text-pure-black leading-none truncate">
              @{user.username}
            </span>
            <span className="text-[8px] font-mono text-mid-gray uppercase truncate">
              {user.displayName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
