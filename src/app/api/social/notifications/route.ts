import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    const mergedNotifs: any[] = [];
    const seenKeys = new Set<string>();

    if (!isMockFirebase) {
      try {
        const notifsRef = collection(db, 'notifications');
        const q = query(notifsRef, where('uid', '==', uid), orderBy('createdAt', 'desc'));
        const qSnapshot = await getDocs(q);
        qSnapshot.forEach((d) => {
          const data = d.data();
          mergedNotifs.push({ notificationId: d.id, ...data });
          const uniqueKey = `${data.senderId}-${data.type}-${data.createdAt}`;
          seenKeys.add(uniqueKey);
        });
      } catch (firestoreErr) {
        console.warn("Firestore fetch notifications failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const notifications = globalStore.notifications || [];
    const localNotifs = notifications.filter((n: any) => n.uid === uid);

    localNotifs.forEach((n: any) => {
      const uniqueKey = `${n.senderId}-${n.type}-${n.createdAt}`;
      if (!seenKeys.has(uniqueKey)) {
        mergedNotifs.push(n);
        seenKeys.add(uniqueKey);
      }
    });

    mergedNotifs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Build temporary map for latest profile details lookup
    const profiles = globalStore.registeredUserProfiles || new Map();
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
        console.warn("Failed to fetch latest profiles from Firestore for notifications resolution:", fErr);
      }
    }

    // Resolve senderProfilePhotoUrl and senderUsername dynamically
    const resolvedNotifs = mergedNotifs.map((notif: any) => {
      const senderProfile = latestProfiles.get(notif.senderId);
      return {
        ...notif,
        senderUsername: senderProfile?.username || notif.senderUsername,
        senderProfilePhotoUrl: senderProfile?.profilePhotoUrl || notif.senderProfilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${notif.senderId}`
      };
    });

    return NextResponse.json(resolvedNotifs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { uid, senderId, senderUsername, type, details, markRead, senderProfilePhotoUrl, storyMediaUrl, storyAudioTrack } = body;

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    if (markRead) {
      // Mark all as read
      if (!isMockFirebase) {
        try {
          const notifsRef = collection(db, 'notifications');
          const q = query(notifsRef, where('uid', '==', uid), where('read', '==', false));
          const qSnapshot = await getDocs(q);
          for (const d of qSnapshot.docs) {
            await updateDoc(doc(db, 'notifications', d.id), { read: true });
          }
        } catch (firestoreErr) {
          console.warn("Firestore mark read failed, falling back to local storage:", firestoreErr);
        }
      }

      const globalStore = globalThis as any;
      const notifications = globalStore.notifications || [];
      notifications.forEach((n: any) => {
        if (n.uid === uid) {
          n.read = true;
        }
      });
      globalStore.notifications = notifications;
      persistGlobalStore();
      return NextResponse.json({ success: true });
    }

    // Create a new notification
    if (!senderId || !senderUsername || !type) {
      return NextResponse.json({ error: 'Missing required fields to create notification' }, { status: 400 });
    }

    // Dynamic resolution of sender profile picture
    const globalStore = globalThis as any;
    const profiles = globalStore.registeredUserProfiles || new Map();
    const senderProfile = profiles.get(senderId);
    const resolvedProfilePhotoUrl = senderProfilePhotoUrl || senderProfile?.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${senderId}`;

    const notificationId = `notif-${Math.random().toString(36).substring(2, 9)}`;
    const newNotif = {
      uid,
      senderId,
      senderUsername,
      senderProfilePhotoUrl: resolvedProfilePhotoUrl,
      type,
      details: details || (type === 'follow' ? 'started following you' : type === 'like' ? 'liked your post' : 'commented on your post'),
      createdAt: new Date().toISOString(),
      read: false,
      ...(storyMediaUrl ? { storyMediaUrl } : {}),
      ...(storyAudioTrack ? { storyAudioTrack } : {})
    };

    if (!isMockFirebase) {
      try {
        await addDoc(collection(db, 'notifications'), newNotif);
      } catch (firestoreErr) {
        console.warn("Firestore create notification failed, falling back to local storage:", firestoreErr);
      }
    }

    // Always write to local server db-mock.json
    const notifications = globalStore.notifications || [];
    const finalNotif = { ...newNotif, notificationId };
    notifications.unshift(finalNotif);
    globalStore.notifications = notifications;

    persistGlobalStore();
    return NextResponse.json(finalNotif);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    syncGlobalStore();
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId parameter' }, { status: 400 });
    }

    if (!isMockFirebase) {
      try {
        // Query for documents where notificationId matches the requested ID and delete them
        const notifsRef = collection(db, 'notifications');
        const q = query(notifsRef, where('notificationId', '==', notificationId));
        const qSnapshot = await getDocs(q);
        for (const d of qSnapshot.docs) {
          await deleteDoc(doc(db, 'notifications', d.id));
        }
      } catch (firestoreErr) {
        console.warn("Firestore delete notification failed, falling back to local storage:", firestoreErr);
      }
    }

    // Always delete from local database as fallback/sync
    const globalStore = globalThis as any;
    let notifications = globalStore.notifications || [];
    notifications = notifications.filter((n: any) => n.notificationId !== notificationId);
    globalStore.notifications = notifications;

    persistGlobalStore();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
