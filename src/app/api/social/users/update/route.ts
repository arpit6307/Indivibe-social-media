import { NextResponse } from 'next/server';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { doc, updateDoc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const body = await request.json();
    const { uid, patrId, profileData } = body;

    if (!uid || !profileData) {
      return NextResponse.json({ error: 'Missing uid or profileData' }, { status: 400 });
    }

    const newUsername = profileData.username?.trim().toLowerCase();

    // 1. Validate Username Format
    if (newUsername) {
      if (!/^[a-z0-9_]{3,30}$/.test(newUsername)) {
        return NextResponse.json({ 
          error: 'Username must be between 3 and 30 characters, containing only letters, numbers, and underscores.' 
        }, { status: 400 });
      }

      // 2. Validate Username Uniqueness
      if (!isMockFirebase) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('username', '==', newUsername));
          const qSnapshot = await getDocs(q);
          let taken = false;
          qSnapshot.forEach((doc) => {
            if (doc.data().uid !== uid) {
              taken = true;
            }
          });
          if (taken) {
            return NextResponse.json({ error: 'This username is already taken by another user.' }, { status: 409 });
          }
        } catch (fErr) {
          console.warn("Firestore uniqueness check failed, using fallback:", fErr);
        }
      }

      // Fallback/Mock Uniqueness check
      const globalStore = globalThis as any;
      const profiles = globalStore.registeredUserProfiles || new Map();
      const profilesList = Array.from(profiles.values() as any);
      const isTaken = profilesList.some((p: any) => p.username?.toLowerCase() === newUsername && p.uid !== uid);
      
      if (isTaken) {
        return NextResponse.json({ error: 'This username is already taken by another user.' }, { status: 409 });
      }
    }

    // Prepare updated data with gender and category
    const cleanProfileData = {
      ...profileData,
      displayName: profileData.displayName?.trim(),
      bio: profileData.bio?.trim(),
      profilePhotoUrl: profileData.profilePhotoUrl?.trim(),
      username: newUsername,
      gender: profileData.gender || '',
      category: profileData.category || ''
    };

    if (!isMockFirebase) {
      try {
        const userRef = doc(db, 'users', uid);
        const docSnapshot = await getDoc(userRef);
        if (docSnapshot.exists()) {
          await updateDoc(userRef, cleanProfileData);
          // Also update by email if email is a doc key
          const email = docSnapshot.data().patrId;
          if (email) {
            await setDoc(doc(db, 'users', email), { ...docSnapshot.data(), ...cleanProfileData });
          }
          return NextResponse.json({ success: true, user: { ...docSnapshot.data(), ...cleanProfileData } });
        } else if (patrId) {
          const newProfile = {
            uid,
            patrId,
            username: newUsername || patrId.split('@')[0],
            displayName: cleanProfileData.displayName || patrId.split('@')[0].toUpperCase(),
            bio: cleanProfileData.bio || '',
            profilePhotoUrl: cleanProfileData.profilePhotoUrl || '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            isPrivate: cleanProfileData.isPrivate || false,
            gender: cleanProfileData.gender || '',
            category: cleanProfileData.category || '',
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), newProfile);
          await setDoc(doc(db, 'users', patrId), newProfile);
          return NextResponse.json({ success: true, user: newProfile });
        }
      } catch (firestoreErr) {
        console.warn("Firestore update profile failed, falling back to local storage:", firestoreErr);
      }
    }

    // Fallback to local server db-mock.json
    const globalStore = globalThis as any;
    const profiles = globalStore.registeredUserProfiles || new Map();
    
    let userEmail = '';
    let foundProfile: any = null;

    for (const [email, profile] of profiles.entries()) {
      if (profile.uid === uid) {
        userEmail = email;
        foundProfile = profile;
        break;
      }
    }

    if (!foundProfile && !isMockFirebase) {
      try {
        const userRef = doc(db, 'users', uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const u = docSnap.data();
          const resolvedPatrId = u.patrId || u.patrAddress || u.email || patrId || `${uid}@patr.in`;
          const fallbackUsername = resolvedPatrId.split('@')[0] || 'user';
          foundProfile = {
            uid: u.uid || uid,
            patrId: resolvedPatrId,
            username: u.username || fallbackUsername,
            displayName: u.displayName || fallbackUsername.toUpperCase(),
            bio: u.bio || '',
            profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
            followersCount: u.followersCount || 0,
            followingCount: u.followingCount || 0,
            postsCount: u.postsCount || 0,
            isPrivate: u.isPrivate || false,
            gender: u.gender || '',
            category: u.category || '',
            createdAt: u.createdAt || new Date().toISOString()
          };
          userEmail = resolvedPatrId;
          profiles.set(uid, foundProfile);
          profiles.set(resolvedPatrId, foundProfile);
        }
      } catch (err) {
        console.warn("Error fetching profile from Firestore during update fallback:", err);
      }
    }

    if (!foundProfile && patrId) {
      foundProfile = {
        uid,
        patrId,
        username: newUsername || patrId.split('@')[0],
        displayName: cleanProfileData.displayName || patrId.split('@')[0].toUpperCase(),
        bio: '',
        profilePhotoUrl: '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isPrivate: false,
        gender: '',
        category: '',
        createdAt: new Date().toISOString()
      };
      userEmail = patrId;

      const registeredUsers = globalStore.registeredUsers || new Set();
      registeredUsers.add(patrId);
      globalStore.registeredUsers = registeredUsers;
    }

    if (foundProfile) {
      const updated = { ...foundProfile, ...cleanProfileData };
      profiles.set(userEmail || updated.patrId || uid, updated);
      profiles.set(uid, updated);
      globalStore.registeredUserProfiles = profiles;
      persistGlobalStore();
      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
