import { NextResponse } from 'next/server';
import { isMockFirebase, auth, db } from '@/lib/firebase/config';
import { syncGlobalStore, persistGlobalStore } from '@/lib/firebase/dbHelper';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const globalStore = globalThis as any;

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const registeredUsers = globalStore.registeredUsers || new Set();
    const registeredUserProfiles = globalStore.registeredUserProfiles || new Map();

    const { email, password, displayName, bio, profilePhotoUrl } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Email, password, and display name are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (registeredUsers.has(cleanEmail)) {
      return NextResponse.json({ error: 'Account already exists for this Patr ID.' }, { status: 409 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const username = cleanEmail.split('@')[0];

    if (!isMockFirebase) {
      try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const firebaseUser = userCredential.user;

        // Create profile structure
        const profile = {
          uid: firebaseUser.uid,
          patrId: cleanEmail,
          username,
          displayName: displayName.trim(),
          bio: (bio || '').trim(),
          profilePhotoUrl: profilePhotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&h=400', // Default if empty
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isPrivate: false,
          createdAt: new Date().toISOString()
        };

        // Write both under email and under uid for compatibility
        await setDoc(doc(db, 'users', cleanEmail), profile);
        await setDoc(doc(db, 'users', firebaseUser.uid), profile);

        const token = await firebaseUser.getIdToken();

        return NextResponse.json({
          success: true,
          message: 'Account created and profile configured successfully.',
          user: profile,
          token
        });
      } catch (firebaseErr: any) {
        return NextResponse.json({ error: firebaseErr.message || 'Firebase account creation failed.' }, { status: 400 });
      }
    }

    // Create profile structure for Mock Mode
    const profile = {
      uid: `mock-uid-${Math.random().toString(36).substring(2, 11)}`,
      patrId: cleanEmail,
      username,
      displayName: displayName.trim(),
      bio: (bio || '').trim(),
      profilePhotoUrl: profilePhotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&h=400', // Default if empty
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isPrivate: false,
      createdAt: new Date().toISOString()
    };

    // Store in global registers
    registeredUsers.add(cleanEmail);
    registeredUserProfiles.set(cleanEmail, profile);

    // Persist to local JSON database backup
    persistGlobalStore();

    console.log(`[IndiVibe MOCK AUTH ENGINE] Registered new user: ${cleanEmail}`);
    console.log(profile);

    return NextResponse.json({
      success: true,
      message: 'Account created and profile configured successfully.',
      user: profile,
      token: 'mock-jwt-token-xyz'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
