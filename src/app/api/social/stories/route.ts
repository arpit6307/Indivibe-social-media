import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, query, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const viewerUid = searchParams.get('viewerUid');

    const globalStore = globalThis as any;
    const profiles = globalStore.registeredUserProfiles || new Map();
    
    // Build temporary map for latest profile details lookup
    const latestProfiles = new Map<string, any>();
    for (const [key, profile] of profiles.entries()) {
      if (profile && profile.uid) {
        latestProfiles.set(profile.uid, profile);
      }
    }

    if (!isMockFirebase) {
      try {
        const usersRef = collection(db, 'users');
        const qSnapshot = await getDocs(usersRef);
        qSnapshot.forEach((d) => {
          const u = d.data();
          if (u.uid) {
            const existing = latestProfiles.get(u.uid) || {};
            latestProfiles.set(u.uid, { ...u, ...existing });
          }
        });
      } catch (fErr) {
        console.warn("Failed to fetch latest profiles from Firestore for stories resolution:", fErr);
      }
    }

    const filterExpiredAndCloseFriends = (storiesList: any[]) => {
      const now = new Date().getTime();
      return storiesList.filter(s => {
        // Expiry check
        const isExpired = new Date(s.expiresAt).getTime() <= now;
        if (isExpired) return false;

        // Privacy check
        if (s.audience === 'close_friends') {
          if (!viewerUid) return false; // Hide from anonymous viewers
          if (s.uid === viewerUid) return true; // Author sees own

          const authorProfile = latestProfiles.get(s.uid);
          const closeFriends = authorProfile?.closeFriends || [];
          return closeFriends.includes(viewerUid);
        }

        return true;
      });
    };

    const resolveStoryProfiles = (storiesList: any[]) => {
      return storiesList.map((story: any) => {
        const profile = latestProfiles.get(story.uid);
        return {
          ...story,
          username: profile?.username || story.username,
          profilePhotoUrl: profile?.profilePhotoUrl || story.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${story.username}`
        };
      });
    };

    if (!isMockFirebase) {
      try {
        const storiesRef = collection(db, 'stories');
        const q = query(storiesRef, orderBy('createdAt', 'desc'));
        const qSnapshot = await getDocs(q);
        const list: any[] = [];
        qSnapshot.forEach((doc) => {
          list.push({ storyId: doc.id, ...doc.data() });
        });
        if (list.length > 0) {
          return NextResponse.json(filterExpiredAndCloseFriends(resolveStoryProfiles(list)));
        }
      } catch (firestoreErr) {
        console.warn("Firestore fetch stories failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const stories = globalStore.stories || [];
    const sorted = [...stories].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(filterExpiredAndCloseFriends(resolveStoryProfiles(sorted)));
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { uid, username, profilePhotoUrl, mediaUrl, mediaType, audioTrack, audience, caption } = body;

    if (!uid || !username || !mediaUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newStory = {
      uid,
      username,
      profilePhotoUrl: profilePhotoUrl || '',
      mediaUrl,
      mediaType: mediaType || 'image',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours expiry
      audience: audience || 'public',
      caption: caption || '',
      ...(audioTrack ? { audioTrack } : {})
    };

    let storyId = `story-${Math.random().toString(36).substring(2, 9)}`;

    if (!isMockFirebase) {
      try {
        const docRef = await addDoc(collection(db, 'stories'), newStory);
        storyId = docRef.id;
      } catch (firestoreErr) {
        console.warn("Firestore create story failed, falling back to local storage:", firestoreErr);
      }
    }

    const storyWithId = { ...newStory, storyId };

    // Fallback/Sync to local server db-mock.json
    const globalStore = globalThis as any;
    const stories = globalStore.stories || [];
    stories.unshift(storyWithId);
    globalStore.stories = stories;

    // Handle mentions in caption
    if (caption && caption.includes('@')) {
      const mentions = caption.match(/@[a-zA-Z0-9_]+/g) || [];
      const uniqueMentions = Array.from(new Set(mentions.map((m: string) => m.substring(1).toLowerCase())));
      
      const profiles = globalStore.registeredUserProfiles || new Map();
      
      for (const mUsername of uniqueMentions) {
        // Find target user by username
        let targetUser: any = null;
        for (const p of profiles.values() as any) {
          if (p.username?.toLowerCase() === mUsername) {
            targetUser = p;
            break;
          }
        }
        
        if (targetUser && targetUser.uid && targetUser.uid !== uid) {
          // Create a story_mention notification
          const notifId = `notif-${Math.random().toString(36).substring(2, 9)}`;
          const mentionNotif = {
            notificationId: notifId,
            uid: targetUser.uid,
            senderId: uid,
            senderUsername: username,
            senderProfilePhotoUrl: profilePhotoUrl || '',
            type: 'story_mention',
            details: 'mentioned you in their story',
            createdAt: new Date().toISOString(),
            read: false,
            storyMediaUrl: mediaUrl,
            storyAudioTrack: audioTrack || null
          };
          
          if (!isMockFirebase) {
            try {
              await addDoc(collection(db, 'notifications'), {
                uid: targetUser.uid,
                senderId: uid,
                senderUsername: username,
                senderProfilePhotoUrl: profilePhotoUrl || '',
                type: 'story_mention',
                details: 'mentioned you in their story',
                createdAt: mentionNotif.createdAt,
                read: false,
                storyMediaUrl: mediaUrl,
                storyAudioTrack: audioTrack || null
              });
            } catch (firestoreErr) {
              console.warn("Failed to save mention notification to Firestore:", firestoreErr);
            }
          }
          
          const notifications = globalStore.notifications || [];
          notifications.unshift(mentionNotif);
          globalStore.notifications = notifications;
        }
      }
    }

    persistGlobalStore();
    return NextResponse.json(storyWithId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId parameter' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const storyRef = doc(db, 'stories', storyId);
        await deleteDoc(storyRef);
      } catch (firestoreErr) {
        console.warn("Firestore delete story failed:", firestoreErr);
      }
    }

    // Sync locally
    const globalStore = globalThis as any;
    let stories = globalStore.stories || [];
    stories = stories.filter((s: any) => s.storyId !== storyId);
    globalStore.stories = stories;

    persistGlobalStore();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
