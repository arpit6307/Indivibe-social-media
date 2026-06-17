import { NextResponse } from 'next/server';
import { syncGlobalStore, readMockDb } from '@/lib/firebase/dbHelper';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    syncGlobalStore();
    
    const { searchParams } = new URL(request.url);
    const queryStr = searchParams.get('q')?.toLowerCase() || '';
    const uid = searchParams.get('uid') || '';

    // 1. Load profiles from local db-mock.json first
    const mergedProfiles: { [uid: string]: any } = {};
    try {
      const dbData = readMockDb();
      const mockProfiles = Object.values(dbData.registeredUserProfiles || {});
      mockProfiles.forEach((p: any) => {
        if (p && p.uid) {
          // Fallback username if missing
          const fallbackUsername = p.patrId ? p.patrId.split('@')[0] : 'user';
          mergedProfiles[p.uid] = {
            ...p,
            username: p.username || fallbackUsername,
            displayName: p.displayName || fallbackUsername.toUpperCase()
          };
        }
      });
    } catch (err) {
      console.warn("Failed to read mock profiles:", err);
    }

    // 2. Fetch and merge from Firestore if enabled
    if (!isMockFirebase) {
      try {
        const usersRef = collection(db, 'users');
        const qSnapshot = await getDocs(usersRef);
        
        qSnapshot.forEach((d) => {
          const fUser = d.data();
          const fUid = fUser.uid;
          if (fUid) {
            const existing = mergedProfiles[fUid] || {};
            const fallbackUsername = fUser.patrAddress?.split('@')[0] || fUser.email?.split('@')[0] || 'user';
            
            // Merge: local db-mock data takes precedence for edited custom fields (username, bio, profilePhotoUrl)
            mergedProfiles[fUid] = {
              ...fUser,
              ...existing,
              username: existing.username || fUser.username || fallbackUsername,
              displayName: existing.displayName || fUser.displayName || fallbackUsername.toUpperCase(),
              bio: existing.bio || fUser.bio || '',
              profilePhotoUrl: existing.profilePhotoUrl || fUser.profilePhotoUrl || fUser.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
              isPrivate: existing.isPrivate !== undefined ? existing.isPrivate : (fUser.isPrivate || false)
            };
          }
        });
      } catch (firestoreErr) {
        console.warn("Firestore fetch users failed during merge, using mock data:", firestoreErr);
      }
    }

    const uniqueProfiles = Object.values(mergedProfiles);

    // 3. Filter single user query
    if (uid) {
      let single = uniqueProfiles.find(u => u.uid === uid || u.username?.toLowerCase() === uid.toLowerCase() || u.patrId?.toLowerCase() === uid.toLowerCase());
      
      if (!single && !isMockFirebase) {
        try {
          const userRef = doc(db, 'users', uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const u = docSnap.data();
            const fallbackUsername = u.patrAddress?.split('@')[0] || u.email?.split('@')[0] || 'user';
            single = {
              ...u,
              username: u.username || fallbackUsername,
              displayName: u.displayName || fallbackUsername.toUpperCase(),
              bio: u.bio || '',
              profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
              isPrivate: u.isPrivate || false
            };
          } else {
            // Try lookup by patrId / email as document ID
            const emailRef = doc(db, 'users', uid);
            const emailSnap = await getDoc(emailRef);
            if (emailSnap.exists()) {
              const u = emailSnap.data();
              const fallbackUsername = u.patrAddress?.split('@')[0] || u.email?.split('@')[0] || 'user';
              single = {
                ...u,
                username: u.username || fallbackUsername,
                displayName: u.displayName || fallbackUsername.toUpperCase(),
                bio: u.bio || '',
                profilePhotoUrl: u.profilePhotoUrl || u.photoURL || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default',
                isPrivate: u.isPrivate || false
              };
            }
          }
        } catch (err) {
          console.warn("Firestore direct single lookup failed:", err);
        }
      }
      return NextResponse.json(single || null);
    }

    // 4. Filter search query
    if (queryStr) {
      const filtered = uniqueProfiles.filter(u => 
        u.username?.toLowerCase().includes(queryStr) || 
        u.displayName?.toLowerCase().includes(queryStr) || 
        u.patrId?.toLowerCase().includes(queryStr)
      );
      return NextResponse.json(filtered);
    }

    return NextResponse.json(uniqueProfiles);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
