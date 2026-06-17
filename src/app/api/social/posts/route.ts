import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, getDoc, doc, updateDoc, setDoc, query, orderBy, deleteDoc } from 'firebase/firestore';

export async function GET() {
  try {
    syncGlobalStore();

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
        console.warn("Failed to fetch latest profiles from Firestore for posts resolution:", fErr);
      }
    }

    const resolvePostProfiles = (postsList: any[]) => {
      return postsList.map((post: any) => {
        const profile = latestProfiles.get(post.uid);
        return {
          ...post,
          username: profile?.username || post.username,
          displayName: profile?.displayName || post.displayName,
          profilePhotoUrl: profile?.profilePhotoUrl || post.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${post.username}`
        };
      });
    };

    if (!isMockFirebase) {
      try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, orderBy('createdAt', 'desc'));
        const qSnapshot = await getDocs(q);
        const posts: any[] = [];
        qSnapshot.forEach((d) => {
          posts.push({ postId: d.id, ...d.data() });
        });
        if (posts.length > 0) {
          return NextResponse.json(resolvePostProfiles(posts));
        }
      } catch (firestoreErr) {
        console.warn("Firestore fetch posts failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const posts = globalStore.posts || [];
    // Sort by createdAt desc
    const sorted = [...posts].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(resolvePostProfiles(sorted));
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { uid, username, displayName, profilePhotoUrl, mediaUrl, mediaType, caption, audioTrack } = body;

    if (!uid || !username || !mediaUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newPost = {
      uid,
      username,
      displayName: displayName || username,
      profilePhotoUrl: profilePhotoUrl || '',
      mediaUrl,
      mediaType: mediaType || 'image',
      caption: caption || '',
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
      ...(audioTrack ? { audioTrack } : {})
    };

    if (!isMockFirebase) {
      try {
        const docRef = await addDoc(collection(db, 'posts'), newPost);
        
        // Update posts count for user in Firestore
        try {
          const userRef = doc(db, 'users', uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const pCount = (userDoc.data().postsCount || 0) + 1;
            await updateDoc(userRef, { postsCount: pCount });
            const email = userDoc.data().patrId;
            if (email) {
              await updateDoc(doc(db, 'users', email), { postsCount: pCount });
            }
          }
        } catch (uErr) {
          console.error("Failed to update user post count in Firestore:", uErr);
        }

        return NextResponse.json({ ...newPost, postId: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore create post failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const posts = globalStore.posts || [];
    const postId = `post-${Math.random().toString(36).substring(2, 9)}`;
    const postWithId = { ...newPost, postId };
    
    posts.unshift(postWithId);
    globalStore.posts = posts;

    // Update posts count for user
    const profiles = globalStore.registeredUserProfiles || new Map();
    // Search profile by uid
    for (const [email, profile] of profiles.entries()) {
      if (profile.uid === uid) {
        profile.postsCount = (profile.postsCount || 0) + 1;
        profiles.set(email, profile);
      }
    }

    persistGlobalStore();

    return NextResponse.json(postWithId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId parameter' }, { status: 400 });
    }

    let uid = '';

    if (!isMockFirebase) {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        if (postDoc.exists()) {
          uid = postDoc.data().uid;
          await deleteDoc(postRef);
          
          if (uid) {
            try {
              const userRef = doc(db, 'users', uid);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                const pCount = Math.max(0, (userDoc.data().postsCount || 1) - 1);
                await updateDoc(userRef, { postsCount: pCount });
                const email = userDoc.data().patrId;
                if (email) {
                  await updateDoc(doc(db, 'users', email), { postsCount: pCount });
                }
              }
            } catch (uErr) {
              console.error("Failed to decrement posts count in Firestore:", uErr);
            }
          }
        }
      } catch (firestoreErr) {
        console.warn("Firestore delete post failed:", firestoreErr);
      }
    }

    // Sync locally
    const globalStore = globalThis as any;
    let posts = globalStore.posts || [];
    const targetPost = posts.find((p: any) => p.postId === postId);
    if (targetPost) {
      uid = targetPost.uid;
      posts = posts.filter((p: any) => p.postId !== postId);
      globalStore.posts = posts;

      if (uid) {
        const profiles = globalStore.registeredUserProfiles || new Map();
        for (const [email, profile] of profiles.entries()) {
          if (profile.uid === uid) {
            profile.postsCount = Math.max(0, (profile.postsCount || 1) - 1);
            profiles.set(email, profile);
          }
        }
      }
    }

    persistGlobalStore();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
