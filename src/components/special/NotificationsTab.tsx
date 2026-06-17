'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, Check, UserMinus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { socialService, Notification } from '@/lib/socialService';
import { formatIST } from '@/lib/timeUtils';
import { useUIStore } from '@/store/uiStore';

interface NotificationsTabProps {
  currentUserId: string;
  onViewProfile?: (uid: string) => void;
  currentUserFollowing?: string[];
}

export default function NotificationsTab({
  currentUserId,
  onViewProfile,
  currentUserFollowing
}: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(
    new Set(currentUserFollowing ?? [])
  );
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Swipe-to-delete states for mobile
  const addToast = useUIStore((state) => state.addToast);
  const [swipedNotifId, setSwipedNotifId] = useState<string | null>(null);
  const [activeTouchId, setActiveTouchId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    setTouchStart(e.touches[0].clientX);
    setActiveTouchId(id);
    if (swipedNotifId && swipedNotifId !== id) {
      setSwipedNotifId(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (touchStart === null || activeTouchId !== id) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart;
    
    if (swipedNotifId === id) {
      if (diff > 0) {
        setTouchDelta(Math.min(90, diff));
      }
    } else {
      if (diff < 0) {
        setTouchDelta(Math.max(-110, diff));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    setTouchStart(null);
    setActiveTouchId(null);
    
    if (swipedNotifId === id) {
      if (touchDelta > 45) {
        setSwipedNotifId(null);
      }
    } else {
      if (touchDelta < -45) {
        setSwipedNotifId(id);
      } else {
        setSwipedNotifId(null);
      }
    }
    setTouchDelta(0);
  };

  const getTransformStyle = (notifId: string) => {
    let offset = 0;
    if (swipedNotifId === notifId) {
      offset = -90;
      if (activeTouchId === notifId && touchStart !== null) {
        offset = Math.min(0, -90 + touchDelta);
      }
    } else if (activeTouchId === notifId && touchStart !== null) {
      offset = touchDelta;
    }
    return {
      transform: `translateX(${offset}px)`,
      transition: activeTouchId === notifId ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  };

  const handleDelete = async (notifId: string) => {
    try {
      await socialService.deleteNotification(notifId, currentUserId);
      setNotifications(prev => prev.filter(n => n.notificationId !== notifId));
      if (swipedNotifId === notifId) {
        setSwipedNotifId(null);
      }
      addToast("Notification deleted successfully!", "info");
    } catch (err) {
      console.error(err);
      addToast("Failed to delete notification.", "error");
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [logs, profile] = await Promise.all([
        socialService.getNotifications(currentUserId),
        socialService.getUserProfile(currentUserId)
      ]);
      setNotifications(logs);

      if (profile?.following) {
        setFollowingSet(new Set(profile.following));
      }

      // Automatically mark notifications as read when viewed
      await socialService.markNotificationsAsRead(currentUserId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUserId]);

  const handleFollowBack = async (targetUid: string) => {
    setProcessingIds(prev => new Set(prev).add(targetUid));
    try {
      const result = await socialService.toggleFollowUser(currentUserId, targetUid);
      if (result.following) {
        setFollowingSet(prev => new Set(prev).add(targetUid));
      } else {
        setFollowingSet(prev => {
          const next = new Set(prev);
          next.delete(targetUid);
          return next;
        });
      }
      loadNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
    }
  };

  const handleAcceptRequest = async (requesterUid: string) => {
    setProcessingIds(prev => new Set(prev).add(requesterUid));
    try {
      await socialService.acceptFollowRequest(currentUserId, requesterUid);
      loadNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requesterUid);
        return next;
      });
    }
  };

  const handleRejectRequest = async (requesterUid: string) => {
    setProcessingIds(prev => new Set(prev).add(requesterUid));
    try {
      await socialService.rejectFollowRequest(currentUserId, requesterUid);
      loadNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requesterUid);
        return next;
      });
    }
  };

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-2.5 h-2.5 text-error-red fill-current" />;
      case 'comment':
        return <MessageCircle className="w-2.5 h-2.5 text-pure-black" />;
      case 'follow':
      case 'follow_request':
        return <UserPlus className="w-2.5 h-2.5 text-success-green" />;
      case 'follow_accept':
        return <Check className="w-2.5 h-2.5 text-success-green" />;
      default:
        return <Bell className="w-2.5 h-2.5 text-pure-black" />;
    }
  };

  const renderActionButtons = (notif: Notification) => {
    const isProcessing = processingIds.has(notif.senderId);

    if (notif.type === 'follow') {
      if (followingSet.has(notif.senderId)) {
        return (
          <span className="inline-flex items-center gap-0.5 py-0.5 px-2 text-[8px] font-display uppercase bg-success-green/10 text-success-green border border-success-green rounded-sm">
            Following <Check className="w-2.5 h-2.5" />
          </span>
        );
      }
      return (
        <Button
          variant="secondary"
          className="py-1 px-2.5 text-[9px] font-display uppercase shadow-none border-pure-black"
          onClick={() => handleFollowBack(notif.senderId)}
          disabled={isProcessing}
        >
          {isProcessing ? '...' : 'Follow back'}
        </Button>
      );
    }

    if (notif.type === 'follow_request') {
      return (
        <>
          <Button
            variant="secondary"
            className="py-1 px-2 text-[9px] font-display uppercase shadow-none border-success-green bg-success-green/10 text-success-green hover:bg-success-green hover:text-white"
            onClick={() => handleAcceptRequest(notif.senderId)}
            disabled={isProcessing}
          >
            {isProcessing ? '...' : 'Accept'}
          </Button>
          <Button
            variant="secondary"
            className="py-1 px-2 text-[9px] font-display uppercase shadow-none border-error-red bg-error-red/10 text-error-red hover:bg-error-red hover:text-white"
            onClick={() => handleRejectRequest(notif.senderId)}
            disabled={isProcessing}
          >
            {isProcessing ? '...' : 'Reject'}
          </Button>
        </>
      );
    }

    if (notif.type === 'follow_accept') {
      return (
        <span className="inline-flex items-center gap-0.5 py-0.5 px-2 text-[8px] font-display uppercase bg-success-green/10 text-success-green border border-success-green rounded-sm">
          Accepted <Check className="w-2.5 h-2.5" />
        </span>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 select-none">

      {/* Notifications Header */}
      <div className="border-b-3 border-pure-black pb-4 mb-6 flex justify-between items-center text-center md:text-left">
        <div>
          <h2 className="font-display text-2xl uppercase">Activity Log</h2>
          <p className="text-xs font-bold text-mid-gray uppercase tracking-wider mt-1">
            Check who liked your media, left comments, or started following your space
          </p>
        </div>
        <Bell className="w-8 h-8 text-pure-black animate-bounce shrink-0 hidden sm:block" />
      </div>

      {loading ? (
        <div className="text-center py-10 font-bold uppercase text-xs">Loading activity logs...</div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center bg-white border-2">
          <p className="text-xs font-bold text-mid-gray uppercase leading-relaxed">
            Your activity feed is quiet. Shared posts or follow other spaces to start receiving updates!
          </p>
        </Card>
      ) : (
        <div className="space-y-3 overflow-x-hidden p-1">
          {notifications.map((notif) => (
            <div
              key={notif.notificationId}
              className="relative overflow-hidden brutal-border border-2 bg-error-red rounded shadow-[3px_3px_0px_#111]"
            >
              {/* Swipe-to-delete panel (visible underneath when swiped left) */}
              <div className="absolute right-0 top-0 bottom-0 w-[90px] bg-error-red flex items-center justify-center z-0">
                <button
                  onClick={() => handleDelete(notif.notificationId)}
                  className="w-full h-full text-white font-display text-[10px] font-bold uppercase flex flex-col items-center justify-center gap-1 active:bg-[#C82333] transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                  Delete
                </button>
              </div>

              {/* Card Container (slides left) */}
              <div
                style={getTransformStyle(notif.notificationId)}
                onTouchStart={(e) => handleTouchStart(e, notif.notificationId)}
                onTouchMove={(e) => handleTouchMove(e, notif.notificationId)}
                onTouchEnd={(e) => handleTouchEnd(e, notif.notificationId)}
                className={`p-3 bg-white flex items-center gap-3 relative z-10 transition-transform select-none ${
                  !notif.read ? 'border-l-4 border-brutal-yellow' : ''
                }`}
              >
                {/* Profile Photo with type icon badge */}
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full border-2 border-pure-black overflow-hidden bg-white shadow-[1px_1px_0px_#111]">
                    <img
                      src={notif.senderProfilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${notif.senderId}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full border border-pure-black bg-white">
                    {getTypeIcon(notif.type)}
                  </div>
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-pure-black leading-snug">
                    <span
                      onClick={() => onViewProfile?.(notif.senderId)}
                      className="font-display uppercase hover:underline cursor-pointer mr-1"
                    >
                      @{notif.senderUsername}
                    </span>
                    {notif.details}
                  </p>
                  <span className="block text-[8px] font-mono text-mid-gray uppercase mt-0.5">
                    {formatIST(notif.createdAt)}
                  </span>
                </div>

                {/* Action buttons / Close Button */}
                <div className="shrink-0 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {renderActionButtons(notif)}
                  </div>

                  {/* Desktop Close/Delete Button (hidden on mobile, visible on desktop hover/always) */}
                  <button
                    onClick={() => handleDelete(notif.notificationId)}
                    className="hidden md:flex p-1 rounded-full border border-mid-gray text-mid-gray hover:text-error-red hover:border-error-red hover:bg-error-red/10 transition-colors cursor-pointer"
                    title="Delete Notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
