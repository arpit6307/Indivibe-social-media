import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db-mock.json');

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
  likes: string[];
  comments: Comment[];
  createdAt: string;
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
}

export interface Chat {
  chatId: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
  partner?: {
    uid: string;
    username: string;
    displayName: string;
    profilePhotoUrl: string;
  };
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

export interface Notification {
  notificationId: string;
  uid: string;
  senderId: string;
  senderUsername: string;
  senderProfilePhotoUrl?: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accept';
  details?: string;
  createdAt: string;
  read: boolean;
}

export interface MockDbData {
  registeredUsers: string[];
  registeredUserProfiles: Record<string, any>;
  posts: Post[];
  stories: Story[];
  chats: Chat[];
  messages: Record<string, Message[]>;
  notifications: Notification[];
}

export function readMockDb(): MockDbData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        registeredUsers: parsed.registeredUsers || [],
        registeredUserProfiles: parsed.registeredUserProfiles || {},
        posts: parsed.posts || [],
        stories: parsed.stories || [],
        chats: parsed.chats || [],
        messages: parsed.messages || {},
        notifications: parsed.notifications || []
      };
    }
  } catch (err) {
    console.error("Error reading db-mock.json:", err);
  }
  
  return {
    registeredUsers: [],
    registeredUserProfiles: {},
    posts: [],
    stories: [],
    chats: [],
    messages: {},
    notifications: []
  };
}

export function writeMockDb(data: MockDbData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing to db-mock.json:", err);
  }
}

export function syncGlobalStore() {
  const globalStore = globalThis as any;
  const dbData = readMockDb();
  
  if (!globalStore.registeredUsers) {
    globalStore.registeredUsers = new Set(dbData.registeredUsers);
  } else {
    // Clear and copy to sync deletion/changes
    globalStore.registeredUsers.clear();
    dbData.registeredUsers.forEach(email => globalStore.registeredUsers.add(email));
  }
  
  if (!globalStore.registeredUserProfiles) {
    globalStore.registeredUserProfiles = new Map(Object.entries(dbData.registeredUserProfiles));
  } else {
    globalStore.registeredUserProfiles.clear();
    Object.entries(dbData.registeredUserProfiles).forEach(([key, profile]) => {
      globalStore.registeredUserProfiles.set(key, profile);
    });
  }

  // Sync other collections
  globalStore.posts = dbData.posts;
  globalStore.stories = dbData.stories;
  globalStore.chats = dbData.chats;
  globalStore.messages = dbData.messages;
  globalStore.notifications = dbData.notifications;
}

export function persistGlobalStore() {
  const globalStore = globalThis as any;
  const registeredUsersSet = globalStore.registeredUsers || new Set();
  const registeredUserProfilesMap = globalStore.registeredUserProfiles || new Map();
  
  const data: MockDbData = {
    registeredUsers: Array.from(registeredUsersSet),
    registeredUserProfiles: Object.fromEntries(registeredUserProfilesMap.entries()),
    posts: globalStore.posts || [],
    stories: globalStore.stories || [],
    chats: globalStore.chats || [],
    messages: globalStore.messages || {},
    notifications: globalStore.notifications || []
  };
  
  writeMockDb(data);
}
