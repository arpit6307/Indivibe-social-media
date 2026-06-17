import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, getDocs } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { currentUid, requesterUid, action } = body;

    if (!currentUid || !requesterUid) {
      return NextResponse.json({ error: 'Missing currentUid or requesterUid' }, { status: 400 });
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be accept or reject' }, { status: 400 });
    }

    const globalStore = globalThis as any;
    const profiles = globalStore.registeredUserProfiles || new Map();

    // 1. Sync profiles from Firestore if enabled
    if (!isMockFirebase) {
      try {
        const usersRef = collection(db, 'users');
        const qSnapshot = await getDocs(usersRef);
        let updated = false;
        qSnapshot.forEach((d) => {
          const u = d.data();
          if (u.uid) {
            const resolvedPatrId = u.patrId || u.patrAddress || u.email || '';
            const fallbackUsername = resolvedPatrId.split('@')[0] || 'user';
            const username = u.username || fallbackUsername;

            let existing = profiles.get(u.uid);
            if (!existing && resolvedPatrId) {
              existing = profiles.get(resolvedPatrId);
            }

            if (!existing) {
              const seeded = {
                uid: u.uid,
                patrId: resolvedPatrId,
                username: username,
                displayName: u.displayName || username.toUpperCase(),
                bio: u.bio || '',
                profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
                followersCount: u.followersCount || 0,
                followingCount: u.followingCount || 0,
                postsCount: u.postsCount || 0,
                isPrivate: u.isPrivate || false,
                following: u.following || [],
                followers: u.followers || [],
                pendingFollowRequests: u.pendingFollowRequests || [],
                sentFollowRequests: u.sentFollowRequests || [],
                createdAt: u.createdAt || new Date().toISOString()
              };
              profiles.set(u.uid, seeded);
              if (resolvedPatrId) {
                profiles.set(resolvedPatrId, seeded);
              }
              updated = true;
            } else {
              if (!profiles.has(u.uid)) {
                profiles.set(u.uid, existing);
                updated = true;
              }
              if (resolvedPatrId && !profiles.has(resolvedPatrId)) {
                profiles.set(resolvedPatrId, existing);
                updated = true;
              }
            }
          }
        });
        if (updated) {
          globalStore.registeredUserProfiles = profiles;
          persistGlobalStore();
        }
      } catch (fErr) {
        console.warn("Firestore sync before follow-request failed:", fErr);
      }
    }

    // 2. Find profiles in local cache
    let currentUser = profiles.get(currentUid);
    if (!currentUser) {
      for (const [key, profile] of profiles.entries()) {
        if (profile.uid === currentUid) {
          currentUser = profile;
          break;
        }
      }
    }

    let requester = profiles.get(requesterUid);
    if (!requester) {
      for (const [key, profile] of profiles.entries()) {
        if (profile.uid === requesterUid) {
          requester = profile;
          break;
        }
      }
    }

    // 3. If missing from cache, fetch directly from Firestore
    if (!isMockFirebase) {
      if (!currentUser) {
        try {
          const userRef = doc(db, 'users', currentUid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const u = docSnap.data();
            const resolvedPatrId = u.patrId || u.patrAddress || u.email || `${currentUid}@patr.in`;
            const fallbackUsername = resolvedPatrId.split('@')[0] || 'user';
            currentUser = {
              uid: u.uid || currentUid,
              patrId: resolvedPatrId,
              username: u.username || fallbackUsername,
              displayName: u.displayName || fallbackUsername.toUpperCase(),
              bio: u.bio || '',
              profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
              followersCount: u.followersCount || 0,
              followingCount: u.followingCount || 0,
              postsCount: u.postsCount || 0,
              isPrivate: u.isPrivate || false,
              following: u.following || [],
              followers: u.followers || [],
              pendingFollowRequests: u.pendingFollowRequests || [],
              sentFollowRequests: u.sentFollowRequests || [],
              createdAt: u.createdAt || new Date().toISOString()
            };
            profiles.set(currentUid, currentUser);
            profiles.set(resolvedPatrId, currentUser);
          }
        } catch (err) {
          console.warn("Error fetching current user profile from Firestore directly:", err);
        }
      }

      if (!requester) {
        try {
          const userRef = doc(db, 'users', requesterUid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const u = docSnap.data();
            const resolvedPatrId = u.patrId || u.patrAddress || u.email || `${requesterUid}@patr.in`;
            const fallbackUsername = resolvedPatrId.split('@')[0] || 'user';
            requester = {
              uid: u.uid || requesterUid,
              patrId: resolvedPatrId,
              username: u.username || fallbackUsername,
              displayName: u.displayName || fallbackUsername.toUpperCase(),
              bio: u.bio || '',
              profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
              followersCount: u.followersCount || 0,
              followingCount: u.followingCount || 0,
              postsCount: u.postsCount || 0,
              isPrivate: u.isPrivate || false,
              following: u.following || [],
              followers: u.followers || [],
              pendingFollowRequests: u.pendingFollowRequests || [],
              sentFollowRequests: u.sentFollowRequests || [],
              createdAt: u.createdAt || new Date().toISOString()
            };
            profiles.set(requesterUid, requester);
            profiles.set(resolvedPatrId, requester);
          }
        } catch (err) {
          console.warn("Error fetching requester profile from Firestore directly:", err);
        }
      }
    }

    // 4. Safety Fallback: Create mock profiles if still missing
    if (!currentUser) {
      currentUser = {
        uid: currentUid,
        patrId: `${currentUid}@patr.in`,
        username: `user_${currentUid.substring(0, 5)}`,
        displayName: `User ${currentUid.substring(0, 5)}`,
        bio: '',
        profilePhotoUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUid}`,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isPrivate: false,
        following: [],
        followers: [],
        pendingFollowRequests: [],
        sentFollowRequests: [],
        createdAt: new Date().toISOString()
      };
      profiles.set(currentUid, currentUser);
      profiles.set(`${currentUid}@patr.in`, currentUser);
    }

    if (!requester) {
      requester = {
        uid: requesterUid,
        patrId: `${requesterUid}@patr.in`,
        username: `user_${requesterUid.substring(0, 5)}`,
        displayName: `User ${requesterUid.substring(0, 5)}`,
        bio: '',
        profilePhotoUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${requesterUid}`,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isPrivate: false,
        following: [],
        followers: [],
        pendingFollowRequests: [],
        sentFollowRequests: [],
        createdAt: new Date().toISOString()
      };
      profiles.set(requesterUid, requester);
      profiles.set(`${requesterUid}@patr.in`, requester);
    }

    // Initialize arrays
    currentUser.pendingFollowRequests = currentUser.pendingFollowRequests || [];
    currentUser.followers = currentUser.followers || [];
    currentUser.following = currentUser.following || [];
    requester.sentFollowRequests = requester.sentFollowRequests || [];
    requester.followers = requester.followers || [];
    requester.following = requester.following || [];

    // 5. Remove from pending/sent regardless of action
    currentUser.pendingFollowRequests = currentUser.pendingFollowRequests.filter((id: string) => id !== requesterUid);
    requester.sentFollowRequests = requester.sentFollowRequests.filter((id: string) => id !== currentUid);

    if (action === 'accept') {
      // Add requester to currentUser's followers
      if (!currentUser.followers.includes(requesterUid)) {
        currentUser.followers.push(requesterUid);
      }
      // Add currentUser to requester's following
      if (!requester.following.includes(currentUid)) {
        requester.following.push(currentUid);
      }

      currentUser.followersCount = currentUser.followers.length;
      requester.followingCount = requester.following.length;

      // Save locally
      if (currentUser.uid) profiles.set(currentUser.uid, currentUser);
      if (currentUser.patrId) profiles.set(currentUser.patrId, currentUser);
      if (requester.uid) profiles.set(requester.uid, requester);
      if (requester.patrId) profiles.set(requester.patrId, requester);
      globalStore.registeredUserProfiles = profiles;

      // Create follow_accept notification for the requester
      const acceptNotifId = `notif-${Math.random().toString(36).substring(2, 9)}`;
      const acceptNotif = {
        notificationId: acceptNotifId,
        uid: requesterUid,
        senderId: currentUid,
        senderUsername: currentUser.username || 'user',
        senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
        type: 'follow_accept' as const,
        details: 'accepted your follow request',
        createdAt: new Date().toISOString(),
        read: false
      };

      // Create follow notification for the current user
      const followNotifId = `notif-${Math.random().toString(36).substring(2, 9)}`;
      const followNotif = {
        notificationId: followNotifId,
        uid: currentUid,
        senderId: requesterUid,
        senderUsername: requester.username || 'user',
        senderProfilePhotoUrl: requester.profilePhotoUrl || '',
        type: 'follow' as const,
        details: 'started following you',
        createdAt: new Date().toISOString(),
        read: false
      };

      const notifications = globalStore.notifications || [];
      notifications.unshift(acceptNotif);
      notifications.unshift(followNotif);
      globalStore.notifications = notifications;

      persistGlobalStore();

      // Sync to Firestore
      if (!isMockFirebase) {
        try {
          const currentUserRef = doc(db, 'users', currentUid);
          const requesterRef = doc(db, 'users', requesterUid);

          updateDoc(currentUserRef, {
            pendingFollowRequests: arrayRemove(requesterUid),
            followers: arrayUnion(requesterUid),
            followersCount: currentUser.followersCount
          }).catch(err => console.warn(err));

          updateDoc(requesterRef, {
            sentFollowRequests: arrayRemove(currentUid),
            following: arrayUnion(currentUid),
            followingCount: requester.followingCount
          }).catch(err => console.warn(err));

          addDoc(collection(db, 'notifications'), {
            uid: requesterUid,
            senderId: currentUid,
            senderUsername: currentUser.username || 'user',
            senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
            type: 'follow_accept',
            details: 'accepted your follow request',
            createdAt: acceptNotif.createdAt,
            read: false
          }).catch(err => console.warn(err));

          addDoc(collection(db, 'notifications'), {
            uid: currentUid,
            senderId: requesterUid,
            senderUsername: requester.username || 'user',
            senderProfilePhotoUrl: requester.profilePhotoUrl || '',
            type: 'follow',
            details: 'started following you',
            createdAt: followNotif.createdAt,
            read: false
          }).catch(err => console.warn(err));
        } catch (firestoreErr) {
          console.warn("Firestore follow-request accept sync failed:", firestoreErr);
        }
      }

      return NextResponse.json({
        success: true,
        followersCount: currentUser.followersCount
      });
    }

    // action === 'reject'
    // Save locally
    if (currentUser.uid) profiles.set(currentUser.uid, currentUser);
    if (currentUser.patrId) profiles.set(currentUser.patrId, currentUser);
    if (requester.uid) profiles.set(requester.uid, requester);
    if (requester.patrId) profiles.set(requester.patrId, requester);
    globalStore.registeredUserProfiles = profiles;

    persistGlobalStore();

    // Sync to Firestore
    if (!isMockFirebase) {
      try {
        const currentUserRef = doc(db, 'users', currentUid);
        const requesterRef = doc(db, 'users', requesterUid);

        updateDoc(currentUserRef, {
          pendingFollowRequests: arrayRemove(requesterUid)
        }).catch(err => console.warn(err));

        updateDoc(requesterRef, {
          sentFollowRequests: arrayRemove(currentUid)
        }).catch(err => console.warn(err));
      } catch (firestoreErr) {
        console.warn("Firestore follow-request reject sync failed:", firestoreErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
