import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, addDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { postId, uid, currentUsername } = body;

    if (!postId || !uid) {
      return NextResponse.json({ error: 'Missing postId or uid' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        if (postDoc.exists()) {
          const postData = postDoc.data();
          const likes: string[] = postData.likes || [];
          const likedIdx = likes.indexOf(uid);
          const isLiking = likedIdx === -1;

          if (isLiking) {
            await updateDoc(postRef, { likes: arrayUnion(uid) });
            likes.push(uid);

            // Trigger like notification in Firestore & local database
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
                senderUsername: currentUsername || 'user',
                senderProfilePhotoUrl,
                type: 'like' as const,
                details: 'liked your post',
                createdAt: new Date().toISOString(),
                read: false
              };

              try {
                await addDoc(collection(db, 'notifications'), newNotif);
              } catch (nErr) {
                console.error("Failed to write like notification in Firestore:", nErr);
              }

              // Always write to local database as fallback/sync
              const globalStoreFallback = globalThis as any;
              const notifications = globalStoreFallback.notifications || [];
              notifications.unshift(newNotif);
              globalStoreFallback.notifications = notifications;
              persistGlobalStore();
            }
          } else {
            await updateDoc(postRef, { likes: arrayRemove(uid) });
            likes.splice(likedIdx, 1);
          }
          return NextResponse.json({ likes });
        }
      } catch (firestoreErr) {
        console.warn("Firestore post like failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const posts = globalStore.posts || [];
    const post = posts.find((p: any) => p.postId === postId);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    post.likes = post.likes || [];
    const idx = post.likes.indexOf(uid);
    const isLiking = idx === -1;

    if (isLiking) {
      post.likes.push(uid);

      // Trigger fallback like notification
      if (post.uid !== uid) {
        const profiles = globalStore.registeredUserProfiles || new Map();
        const senderProfile = profiles.get(uid);
        const senderProfilePhotoUrl = senderProfile?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${uid}`;

        const notifications = globalStore.notifications || [];
        notifications.unshift({
          notificationId: `notif-${Math.random().toString(36).substring(2, 9)}`,
          uid: post.uid,
          senderId: uid,
          senderUsername: currentUsername || 'user',
          senderProfilePhotoUrl,
          type: 'like',
          details: 'liked your post',
          createdAt: new Date().toISOString(),
          read: false
        });
        globalStore.notifications = notifications;
      }
    } else {
      post.likes.splice(idx, 1);
    }

    persistGlobalStore();
    return NextResponse.json({ likes: post.likes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
