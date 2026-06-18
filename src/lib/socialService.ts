import { db, rtdb } from './firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, off, update } from 'firebase/database';

// Interfaces
export interface Comment {
  commentId: string;
  uid: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface Post {
  postId: string;
  uid: string;
  username: string;
  displayName: string;
  profilePhotoUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string;
  likes: string[]; // UIDs of users who liked
  comments: Comment[];
  createdAt: string;
  audioTrack?: {
    title: string;
    artist: string;
    coverUrl?: string;
    audioUrl: string;
    duration: number;
    startTime: number;
  };
}

export interface Story {
  storyId: string;
  uid: string;
  username: string;
  profilePhotoUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  expiresAt: string;
  createdAt: string;
  audioTrack?: {
    title: string;
    artist: string;
    coverUrl?: string;
    audioUrl: string;
    duration: number;
    startTime: number;
  };
  audience?: 'public' | 'close_friends';
  caption?: string;
}

export interface Message {
  messageId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  mediaUrl?: string;
  mediaType: 'text' | 'voice' | 'call_log';
  createdAt: string;
}

export interface Chat {
  chatId: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
  unreadBy?: string[];
  partner?: {
    uid: string;
    username: string;
    displayName: string;
    profilePhotoUrl: string;
  };
}

export interface Notification {
  notificationId: string;
  uid: string; // Target user
  senderId: string;
  senderUsername: string;
  senderProfilePhotoUrl?: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accept' | 'story_mention';
  details?: string;
  createdAt: string;
  read: boolean;
  storyMediaUrl?: string;
  storyAudioTrack?: any;
}

export interface CallState {
  chatId: string;
  callerId: string;
  callerUsername: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  sdpOffer?: any;
  sdpAnswer?: any;
  createdAt: string;
}

// Client-side local storage fallback for WebRTC/Calls state
const getLocalData = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const setLocalData = (key: string, data: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// ----------------------------------------------------
// SOCIAL SERVICE API (Communicates with Next.js Server APIs)
// ----------------------------------------------------
export const socialService = {
  // --- USERS & PROFILES ---
  async getUserProfile(uidOrUsername: string): Promise<any> {
    try {
      const cleanId = encodeURIComponent(uidOrUsername.trim());
      const res = await fetch(`/api/social/users?uid=${cleanId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return await res.json();
    } catch (err) {
      console.error("getUserProfile API error:", err);
      return null;
    }
  },

  async searchUsers(searchQuery: string): Promise<any[]> {
    try {
      const q = encodeURIComponent(searchQuery.trim());
      if (!q) return [];
      const res = await fetch(`/api/social/users?q=${q}`);
      if (!res.ok) throw new Error("Failed to search users");
      return await res.json();
    } catch (err) {
      console.error("searchUsers API error:", err);
      return [];
    }
  },

  async getAllUsers(): Promise<any[]> {
    try {
      const res = await fetch(`/api/social/users`);
      if (!res.ok) throw new Error("Failed to fetch all users");
      return await res.json();
    } catch (err) {
      console.error("getAllUsers API error:", err);
      return [];
    }
  },

  async toggleFollowUser(currentUid: string, targetUid: string): Promise<{ following: boolean; followersCount: number; followingCount: number; requested?: boolean }> {
    try {
      const res = await fetch(`/api/social/users/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUid, targetUid })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to toggle follow");
      }
      return await res.json();
    } catch (err: any) {
      console.error("toggleFollowUser API error:", err);
      throw err;
    }
  },

  async acceptFollowRequest(currentUid: string, requesterUid: string): Promise<{ success: boolean; followersCount: number }> {
    try {
      const res = await fetch(`/api/social/users/follow-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUid, requesterUid, action: 'accept' })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to accept follow request");
      }
      return await res.json();
    } catch (err: any) {
      console.error("acceptFollowRequest API error:", err);
      throw err;
    }
  },

  async rejectFollowRequest(currentUid: string, requesterUid: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`/api/social/users/follow-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUid, requesterUid, action: 'reject' })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to reject follow request");
      }
      return await res.json();
    } catch (err: any) {
      console.error("rejectFollowRequest API error:", err);
      throw err;
    }
  },

  async updateProfile(uid: string, profileData: any): Promise<void> {
    try {
      const res = await fetch(`/api/social/users/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, profileData })
      });
      if (!res.ok) throw new Error("Failed to update profile");
    } catch (err) {
      console.error("updateProfile API error:", err);
      throw err;
    }
  },

  // --- POSTS ---
  async getPosts(): Promise<Post[]> {
    try {
      const res = await fetch(`/api/social/posts`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return await res.json();
    } catch (err) {
      console.error("getPosts API error:", err);
      return [];
    }
  },

  async createPost(
    uid: string, 
    username: string, 
    displayName: string, 
    profilePhotoUrl: string, 
    mediaUrl: string, 
    mediaType: 'image' | 'video', 
    caption: string,
    audioTrack?: any
  ): Promise<Post> {
    try {
      const res = await fetch(`/api/social/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, username, displayName, profilePhotoUrl, mediaUrl, mediaType, caption, audioTrack })
      });
      if (!res.ok) throw new Error("Failed to create post");
      return await res.json();
    } catch (err) {
      console.error("createPost API error:", err);
      throw err;
    }
  },

  async toggleLikePost(postId: string, uid: string, currentUsername: string): Promise<string[]> {
    try {
      const res = await fetch(`/api/social/posts/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, uid, currentUsername })
      });
      if (!res.ok) throw new Error("Failed to toggle like");
      const data = await res.json();
      return data.likes;
    } catch (err) {
      console.error("toggleLikePost API error:", err);
      throw err;
    }
  },

  async addComment(postId: string, uid: string, username: string, text: string): Promise<Comment> {
    try {
      const res = await fetch(`/api/social/posts/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, uid, username, text })
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return await res.json();
    } catch (err) {
      console.error("addComment API error:", err);
      throw err;
    }
  },

  // --- STORIES (24h expiry) ---
  async getStories(viewerUid?: string): Promise<Story[]> {
    try {
      const url = viewerUid ? `/api/social/stories?viewerUid=${encodeURIComponent(viewerUid)}` : `/api/social/stories`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stories");
      return await res.json();
    } catch (err) {
      console.error("getStories API error:", err);
      return [];
    }
  },

  async createStory(
    uid: string, 
    username: string, 
    profilePhotoUrl: string, 
    mediaUrl: string, 
    mediaType: 'image' | 'video',
    audioTrack?: any,
    audience?: 'public' | 'close_friends',
    caption?: string
  ): Promise<Story> {
    try {
      const res = await fetch(`/api/social/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, username, profilePhotoUrl, mediaUrl, mediaType, audioTrack, audience, caption })
      });
      if (!res.ok) throw new Error("Failed to create story");
      return await res.json();
    } catch (err) {
      console.error("createStory API error:", err);
      throw err;
    }
  },

  // --- NOTIFICATIONS ---
  async getNotifications(uid: string): Promise<Notification[]> {
    try {
      const res = await fetch(`/api/social/notifications?uid=${uid}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return await res.json();
    } catch (err) {
      console.error("getNotifications API error:", err);
      return [];
    }
  },

  async createNotification(uid: string, senderId: string, senderUsername: string, type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accept', details?: string, senderProfilePhotoUrl?: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, senderId, senderUsername, type, details, senderProfilePhotoUrl })
      });
      if (!res.ok) throw new Error("Failed to create notification");
    } catch (err) {
      console.error("createNotification API error:", err);
    }
  },

  async markNotificationsAsRead(uid: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, markRead: true })
      });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
    } catch (err) {
      console.error("markNotificationsAsRead API error:", err);
    }
  },

  async deleteNotification(notificationId: string, uid: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/notifications?notificationId=${notificationId}&uid=${uid}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete notification");
    } catch (err) {
      console.error("deleteNotification API error:", err);
      throw err;
    }
  },

  // --- CHATS & MESSAGES ---
  async getChats(uid: string): Promise<Chat[]> {
    try {
      const res = await fetch(`/api/social/chats?uid=${uid}`);
      if (!res.ok) throw new Error("Failed to fetch chats");
      return await res.json();
    } catch (err) {
      console.error("getChats API error:", err);
      return [];
    }
  },

  async createChat(uid1: string, uid2: string): Promise<string> {
    try {
      const res = await fetch(`/api/social/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid1, uid2 })
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const data = await res.json();
      return data.chatId;
    } catch (err) {
      console.error("createChat API error:", err);
      throw err;
    }
  },

  async sendMessage(
    chatId: string, 
    senderId: string, 
    senderUsername: string, 
    text: string, 
    mediaUrl?: string, 
    mediaType: 'text' | 'voice' | 'call_log' = 'text'
  ): Promise<Message> {
    try {
      const res = await fetch(`/api/social/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, senderId, senderUsername, text, mediaUrl, mediaType })
      });
      if (!res.ok) throw new Error("Failed to send message");
      return await res.json();
    } catch (err) {
      console.error("sendMessage API error:", err);
      throw err;
    }
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void): () => void {
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/social/messages?chatId=${chatId}`);
        if (res.ok) {
          const list = await res.json();
          callback(list);
        }
      } catch (err) {
        console.error("Messages subscription fetch error:", err);
      }
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 2000);
    return () => clearInterval(interval);
  },

  async markChatAsRead(chatId: string, uid: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', chatId, uid })
      });
      if (!res.ok) throw new Error("Failed to mark chat as read");
    } catch (err) {
      console.error("markChatAsRead API error:", err);
    }
  },

  async deleteChat(chatId: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/chats?chatId=${chatId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete chat");
    } catch (err) {
      console.error("deleteChat API error:", err);
      throw err;
    }
  },

  async clearChat(chatId: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/messages?chatId=${chatId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to clear chat");
    } catch (err) {
      console.error("clearChat API error:", err);
      throw err;
    }
  },

  async updateMessage(chatId: string, messageId: string, action: 'delete' | 'edit', newText?: string): Promise<void> {
    try {
      const res = await fetch(`/api/social/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, messageId, action, newText })
      });
      if (!res.ok) throw new Error(`Failed to ${action} message`);
    } catch (err) {
      console.error("updateMessage API error:", err);
      throw err;
    }
  },

  // --- CALLING (WebRTC Signaling using fallback LocalStorage or RTDB) ---
  async initiateCall(chatId: string, callerId: string, callerUsername: string, receiverId: string, type: 'audio' | 'video'): Promise<void> {
    const callData: CallState = {
      chatId,
      callerId,
      callerUsername,
      receiverId,
      type,
      status: 'ringing',
      createdAt: new Date().toISOString()
    };

    try {
      if (rtdb) {
        await set(ref(rtdb, `calls/${chatId}`), callData);
        return;
      }
    } catch (err) {
      console.warn("RTDB call init failed, using local storage:", err);
    }
    
    setLocalData(`indivibe_active_call_${chatId}`, callData);
  },

  async respondToCall(chatId: string, status: 'accepted' | 'rejected' | 'ended'): Promise<void> {
    try {
      if (rtdb) {
        await update(ref(rtdb, `calls/${chatId}`), { status });
        return;
      }
    } catch (err) {
      console.warn("RTDB call response failed, using local storage:", err);
    }

    const call = getLocalData(`indivibe_active_call_${chatId}`, null);
    if (call) {
      call.status = status;
      setLocalData(`indivibe_active_call_${chatId}`, call);
    }
  },

  subscribeToCall(chatId: string, callback: (call: CallState | null) => void): () => void {
    try {
      if (rtdb) {
        const callRef = ref(rtdb, `calls/${chatId}`);
        const unsubscribe = onValue(callRef, (snapshot) => {
          const val = snapshot.val();
          callback(val || null);
        });
        return () => {
          off(callRef, 'value', unsubscribe);
        };
      }
    } catch (err) {
      console.warn("RTDB call subscription failed, using local storage polling:", err);
    }

    const interval = setInterval(() => {
      const call = getLocalData(`indivibe_active_call_${chatId}`, null);
      callback(call);
    }, 1500);
    return () => clearInterval(interval);
  },

  async setCallSignaling(chatId: string, data: { sdpOffer?: any; sdpAnswer?: any }): Promise<void> {
    try {
      if (rtdb) {
        await update(ref(rtdb, `calls/${chatId}`), data);
        return;
      }
    } catch (err) {
      console.warn("RTDB call signaling failed, using local storage:", err);
    }

    const call = getLocalData(`indivibe_active_call_${chatId}`, null);
    if (call) {
      if (data.sdpOffer) call.sdpOffer = data.sdpOffer;
      if (data.sdpAnswer) call.sdpAnswer = data.sdpAnswer;
      setLocalData(`indivibe_active_call_${chatId}`, call);
    }
  },

  async setTypingStatus(chatId: string, uid: string, isTyping: boolean): Promise<void> {
    try {
      if (rtdb) {
        await set(ref(rtdb, `typing/${chatId}/${uid}`), isTyping);
        return;
      }
    } catch (err) {
      console.warn("RTDB typing status set failed, using local storage:", err);
    }
    setLocalData(`indivibe_typing_${chatId}_${uid}`, isTyping);
  },

  subscribeToTyping(chatId: string, partnerUid: string, callback: (isTyping: boolean) => void): () => void {
    try {
      if (rtdb) {
        const typingRef = ref(rtdb, `typing/${chatId}/${partnerUid}`);
        const unsubscribe = onValue(typingRef, (snapshot) => {
          const val = snapshot.val();
          callback(!!val);
        });
        return () => {
          off(typingRef, 'value', unsubscribe);
        };
      }
    } catch (err) {
      console.warn("RTDB typing subscription failed, using local storage polling:", err);
    }

    const interval = setInterval(() => {
      const isTyping = getLocalData(`indivibe_typing_${chatId}_${partnerUid}`, false);
      callback(isTyping);
    }, 1000);
    return () => clearInterval(interval);
  },

  async deletePost(postId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/social/posts?postId=${postId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.error("deletePost API error:", err);
      return false;
    }
  },

  async deleteStory(storyId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/social/stories?storyId=${storyId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.error("deleteStory API error:", err);
      return false;
    }
  },

  async getUserByUsername(username: string): Promise<any | null> {
    try {
      const res = await fetch(`/api/social/users?username=${encodeURIComponent(username.toLowerCase())}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.profile || null;
    } catch (err) {
      console.error("getUserByUsername API error:", err);
      return null;
    }
  }
};
