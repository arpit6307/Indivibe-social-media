import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, collection, addDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { postId, uid, username, text } = body;

    if (!postId || !uid || !username || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newComment = {
      commentId: `comment-${Math.random().toString(36).substring(2, 9)}`,
      uid,
      username,
      text,
      createdAt: new Date().toISOString()
    };

    if (!isMockFirebase) {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        if (postDoc.exists()) {
          const postData = postDoc.data();
          await updateDoc(postRef, {
            comments: arrayUnion(newComment)
          });
          
          // Trigger comment notification in Firestore & local database
          if (postData.uid !== uid) {
            // Look up sender's profile photo
            const globalStore = globalThis as any;
            const profiles = globalStore.registeredUserProfiles || new Map();
            const senderProfile = profiles.get(uid);
            const senderProfilePhotoUrl = senderProfile?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${uid}`;

            const newNotif = {
              notificationId: `notif-${Math.random().toString(36).substring(2, 9)}`,
              uid: postData.uid,
              senderId: uid,
              senderUsername: username,
              senderProfilePhotoUrl,
              type: 'comment' as const,
              details: `commented on your post: "${text.length > 25 ? text.substring(0, 22) + '...' : text}"`,
              createdAt: new Date().toISOString(),
              read: false
            };

            try {
              await addDoc(collection(db, 'notifications'), newNotif);
            } catch (nErr) {
              console.error("Failed to write comment notification in Firestore:", nErr);
            }

            // Always write to local database as fallback/sync
            const notifications = globalStore.notifications || [];
            notifications.unshift(newNotif);
            globalStore.notifications = notifications;
            persistGlobalStore();
          }
          
          return NextResponse.json(newComment);
        }
      } catch (firestoreErr) {
        console.warn("Firestore post comment failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const posts = globalStore.posts || [];
    const post = posts.find((p: any) => p.postId === postId);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    post.comments = post.comments || [];
    post.comments.push(newComment);

    // Trigger fallback comment notification
    if (post.uid !== uid) {
      const profiles = globalStore.registeredUserProfiles || new Map();
      const senderProfile = profiles.get(uid);
      const senderProfilePhotoUrl = senderProfile?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${uid}`;

      const notifications = globalStore.notifications || [];
      notifications.unshift({
        notificationId: `notif-${Math.random().toString(36).substring(2, 9)}`,
        uid: post.uid,
        senderId: uid,
        senderUsername: username,
        senderProfilePhotoUrl,
        type: 'comment',
        details: `commented on your post: "${text.length > 25 ? text.substring(0, 22) + '...' : text}"`,
        createdAt: new Date().toISOString(),
        read: false
      });
      globalStore.notifications = notifications;
    }

    persistGlobalStore();
    return NextResponse.json(newComment);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
