import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, getDocs } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { currentUid, targetUid } = body;

    if (!currentUid || !targetUid) {
      return NextResponse.json({ error: 'Missing currentUid or targetUid' }, { status: 400 });
    }

    if (currentUid === targetUid) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
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
        console.warn("Firestore sync before follow failed:", fErr);
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

    let targetUser = profiles.get(targetUid);
    if (!targetUser) {
      for (const [key, profile] of profiles.entries()) {
        if (profile.uid === targetUid) {
          targetUser = profile;
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
              createdAt: u.createdAt || new Date().toISOString()
            };
            profiles.set(currentUid, currentUser);
            profiles.set(resolvedPatrId, currentUser);
          }
        } catch (err) {
          console.warn("Error fetching current user profile from Firestore directly:", err);
        }
      }

      if (!targetUser) {
        try {
          const userRef = doc(db, 'users', targetUid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const u = docSnap.data();
            const resolvedPatrId = u.patrId || u.patrAddress || u.email || `${targetUid}@patr.in`;
            const fallbackUsername = resolvedPatrId.split('@')[0] || 'user';
            targetUser = {
              uid: u.uid || targetUid,
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
              createdAt: u.createdAt || new Date().toISOString()
            };
            profiles.set(targetUid, targetUser);
            profiles.set(resolvedPatrId, targetUser);
          }
        } catch (err) {
          console.warn("Error fetching target user profile from Firestore directly:", err);
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
        createdAt: new Date().toISOString()
      };
      profiles.set(currentUid, currentUser);
      profiles.set(`${currentUid}@patr.in`, currentUser);
    }

    if (!targetUser) {
      targetUser = {
        uid: targetUid,
        patrId: `${targetUid}@patr.in`,
        username: `user_${targetUid.substring(0, 5)}`,
        displayName: `User ${targetUid.substring(0, 5)}`,
        bio: '',
        profilePhotoUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${targetUid}`,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isPrivate: false,
        following: [],
        followers: [],
        createdAt: new Date().toISOString()
      };
      profiles.set(targetUid, targetUser);
      profiles.set(`${targetUid}@patr.in`, targetUser);
    }

    // 5. Perform the Toggle follow logic in memory
    currentUser.following = currentUser.following || [];
    targetUser.followers = targetUser.followers || [];

    const isFollowing = currentUser.following.includes(targetUid);

    // PRIVATE ACCOUNT FOLLOW REQUEST LOGIC
    if (!isFollowing && targetUser.isPrivate) {
      // Check if already sent a request
      targetUser.pendingFollowRequests = targetUser.pendingFollowRequests || [];
      currentUser.sentFollowRequests = currentUser.sentFollowRequests || [];

      const alreadyRequested = targetUser.pendingFollowRequests.includes(currentUid);

      if (alreadyRequested) {
        // Cancel the request
        targetUser.pendingFollowRequests = targetUser.pendingFollowRequests.filter((id: string) => id !== currentUid);
        currentUser.sentFollowRequests = currentUser.sentFollowRequests.filter((id: string) => id !== targetUid);

        // Save locally
        if (currentUser.uid) profiles.set(currentUser.uid, currentUser);
        if (currentUser.patrId) profiles.set(currentUser.patrId, currentUser);
        if (targetUser.uid) profiles.set(targetUser.uid, targetUser);
        if (targetUser.patrId) profiles.set(targetUser.patrId, targetUser);
        globalStore.registeredUserProfiles = profiles;
        persistGlobalStore();

        // Sync to Firestore
        if (!isMockFirebase) {
          try {
            const currentUserRef = doc(db, 'users', currentUid);
            const targetUserRef = doc(db, 'users', targetUid);
            updateDoc(currentUserRef, { sentFollowRequests: arrayRemove(targetUid) }).catch(err => console.warn(err));
            updateDoc(targetUserRef, { pendingFollowRequests: arrayRemove(currentUid) }).catch(err => console.warn(err));
          } catch (err) { console.warn(err); }
        }

        return NextResponse.json({
          following: false,
          requested: false,
          followersCount: targetUser.followersCount,
          followingCount: currentUser.followingCount
        });
      }

      // Send follow request
      targetUser.pendingFollowRequests.push(currentUid);
      currentUser.sentFollowRequests.push(targetUid);

      // Save locally
      if (currentUser.uid) profiles.set(currentUser.uid, currentUser);
      if (currentUser.patrId) profiles.set(currentUser.patrId, currentUser);
      if (targetUser.uid) profiles.set(targetUser.uid, targetUser);
      if (targetUser.patrId) profiles.set(targetUser.patrId, targetUser);
      globalStore.registeredUserProfiles = profiles;

      // Create follow_request notification
      const notificationId = `notif-${Math.random().toString(36).substring(2, 9)}`;
      const reqNotif = {
        notificationId,
        uid: targetUid,
        senderId: currentUid,
        senderUsername: currentUser.username || 'user',
        senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
        type: 'follow_request' as const,
        details: 'requested to follow you',
        createdAt: new Date().toISOString(),
        read: false
      };
      const notifications = globalStore.notifications || [];
      notifications.unshift(reqNotif);
      globalStore.notifications = notifications;

      persistGlobalStore();

      // Sync to Firestore
      if (!isMockFirebase) {
        try {
          const currentUserRef = doc(db, 'users', currentUid);
          const targetUserRef = doc(db, 'users', targetUid);
          updateDoc(currentUserRef, { sentFollowRequests: arrayUnion(targetUid) }).catch(err => console.warn(err));
          updateDoc(targetUserRef, { pendingFollowRequests: arrayUnion(currentUid) }).catch(err => console.warn(err));
          addDoc(collection(db, 'notifications'), {
            uid: targetUid,
            senderId: currentUid,
            senderUsername: currentUser.username || 'user',
            senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
            type: 'follow_request',
            details: 'requested to follow you',
            createdAt: reqNotif.createdAt,
            read: false
          }).catch(err => console.warn(err));
        } catch (err) { console.warn(err); }
      }

      return NextResponse.json({
        following: false,
        requested: true,
        followersCount: targetUser.followersCount,
        followingCount: currentUser.followingCount
      });
    }

    // PUBLIC ACCOUNT: Continue with normal toggle
    if (isFollowing) {
      currentUser.following = currentUser.following.filter((id: string) => id !== targetUid);
      targetUser.followers = targetUser.followers.filter((id: string) => id !== currentUid);
      // Also clean up any pending follow requests
      targetUser.pendingFollowRequests = (targetUser.pendingFollowRequests || []).filter((id: string) => id !== currentUid);
      currentUser.sentFollowRequests = (currentUser.sentFollowRequests || []).filter((id: string) => id !== targetUid);
    } else {
      currentUser.following.push(targetUid);
      targetUser.followers.push(currentUid);
    }

    currentUser.followingCount = currentUser.following.length;
    targetUser.followersCount = targetUser.followers.length;

    // Save locally
    if (currentUser.uid) profiles.set(currentUser.uid, currentUser);
    if (currentUser.patrId) profiles.set(currentUser.patrId, currentUser);
    if (targetUser.uid) profiles.set(targetUser.uid, targetUser);
    if (targetUser.patrId) profiles.set(targetUser.patrId, targetUser);
    globalStore.registeredUserProfiles = profiles;

    // Create follow notification
    let notificationId = `notif-${Math.random().toString(36).substring(2, 9)}`;
    const newNotif = {
      notificationId,
      uid: targetUid,
      senderId: currentUid,
      senderUsername: currentUser.username || 'user',
      senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
      type: 'follow' as const,
      details: 'started following you',
      createdAt: new Date().toISOString(),
      read: false
    };

    if (!isFollowing) {
      // Local notification list
      const notifications = globalStore.notifications || [];
      notifications.unshift(newNotif);
      globalStore.notifications = notifications;
    }

    persistGlobalStore();

    // 6. Try updating remote Firestore databases (Async, non-blocking for response)
    if (!isMockFirebase) {
      try {
        const currentUserRef = doc(db, 'users', currentUid);
        const targetUserRef = doc(db, 'users', targetUid);

        // Update current user's following list in Firestore
        updateDoc(currentUserRef, {
          following: isFollowing ? arrayRemove(targetUid) : arrayUnion(targetUid),
          followingCount: currentUser.followingCount
        }).catch(err => console.warn("Firestore update currentUser following failed:", err));

        // Also update target user's followers list in Firestore
        updateDoc(targetUserRef, {
          followers: isFollowing ? arrayRemove(currentUid) : arrayUnion(currentUid),
          followersCount: targetUser.followersCount
        }).catch(err => console.warn("Firestore update targetUser followers failed:", err));

        // Create notification in Firestore
        if (!isFollowing) {
          addDoc(collection(db, 'notifications'), {
            uid: targetUid,
            senderId: currentUid,
            senderUsername: currentUser.username || 'user',
            senderProfilePhotoUrl: currentUser.profilePhotoUrl || '',
            type: 'follow',
            details: 'started following you',
            createdAt: newNotif.createdAt,
            read: false
          }).catch(err => console.warn("Firestore create follow notification failed:", err));
        }
      } catch (firestoreErr) {
        console.warn("Firestore toggle follow sync failed:", firestoreErr);
      }
    }

    return NextResponse.json({
      following: !isFollowing,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
