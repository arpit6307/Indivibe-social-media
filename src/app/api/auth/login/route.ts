import { NextResponse } from 'next/server';
import { isMockFirebase, auth, db } from '@/lib/firebase/config';
import { syncGlobalStore } from '@/lib/firebase/dbHelper';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { sendEmail } from '@/lib/email';

const globalStore = globalThis as any;
if (!globalStore.registeredUserProfiles) {
  globalStore.registeredUserProfiles = new Map<string, any>([
    [
      'taken@patr.in',
      {
        uid: 'mock-uid-taken',
        patrId: 'taken@patr.in',
        username: 'taken',
        displayName: 'IndiViber Taken',
        bio: 'Hello, I am using IndiVibe, India\'s own 3D social media!',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&h=400',
        followersCount: 120,
        followingCount: 85,
        postsCount: 15,
        isPrivate: false,
        createdAt: new Date().toISOString()
      }
    ]
  ]);
}

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const registeredUsers = globalStore.registeredUsers || new Set(['taken@patr.in']);
    const registeredUserProfiles = globalStore.registeredUserProfiles || new Map();

    const { patrId, password } = await request.json();

    if (!patrId || !password) {
      return NextResponse.json({ error: 'Patr ID and password are required' }, { status: 400 });
    }

    let email = patrId.trim().toLowerCase();
    if (!email.endsWith('@patr.in')) {
      email = `${email}@patr.in`;
    }

    // Verify password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    // Live mode vs Mock mode
    if (isMockFirebase) {
      const exists = registeredUsers.has(email);
      if (!exists) {
        return NextResponse.json({ error: 'User does not exist. Please sign up first.' }, { status: 404 });
      }

      // Check if profile exists, if not create a default one
      let profile = registeredUserProfiles.get(email);
      if (!profile) {
        profile = {
          uid: `mock-uid-${Math.random().toString(36).substring(2, 11)}`,
          patrId: email,
          username: email.split('@')[0],
          displayName: email.split('@')[0].toUpperCase(),
          bio: 'Default Bio',
          profilePhotoUrl: '',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isPrivate: false,
          createdAt: new Date().toISOString()
        };
        registeredUserProfiles.set(email, profile);
      }

      // Send Welcome Email
      await sendEmail({
        to: email,
        subject: 'Welcome to IndiVibe!',
        text: `Hello ${profile.displayName}! Welcome back to IndiVibe. You have successfully logged in to your social profile.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid #111; background-color: #FAFAF8; max-width: 500px; margin: auto;">
            <h2 style="font-family: 'Arial Black', Impact, sans-serif; text-transform: uppercase; border-bottom: 3px solid #111; padding-bottom: 10px; color: #111;">Welcome back to IndiVibe!</h2>
            <p style="font-weight: bold; font-size: 16px;">Hello ${profile.displayName},</p>
            <p>You have successfully logged in to your IndiVibe 3D Social Space account with your Patr ID: <strong>${email}</strong>.</p>
            <div style="background-color: #FFE834; border: 2.5px solid #111; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; margin: 20px 0; box-shadow: 3px 3px 0px #111;">
              INDIA'S OWN 3D SOCIAL SPACE IS LIVE!
            </div>
            <p>Toggle between 2D list views and the 3D interactive planet sphere feed, host voice rooms, and co-create posts in real time.</p>
            <p style="font-size: 12px; color: #666; font-weight: bold;">If this login wasn't you, please reset your password immediately inside your profile settings.</p>
          </div>
        `
      });

      return NextResponse.json({
        success: true,
        message: 'Logged in successfully (Mock).',
        user: profile,
        token: 'mock-jwt-token-xyz'
      });
    } else {
      // In live Firebase mode, perform Firebase login.
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Try getting profile by email first, fallback to uid
        let profileDoc = await getDoc(doc(db, 'users', email));
        if (!profileDoc.exists()) {
          profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        }

        if (!profileDoc.exists()) {
          return NextResponse.json({ 
            error: 'Authenticated successfully, but no user profile was found in Firestore.' 
          }, { status: 404 });
        }

        const profileData = profileDoc.data();
        const token = await firebaseUser.getIdToken();
        const userObj = {
          uid: firebaseUser.uid,
          patrId: profileData.patrId || email,
          username: profileData.username || email.split('@')[0],
          displayName: profileData.displayName || email.split('@')[0].toUpperCase(),
          bio: profileData.bio || '',
          profilePhotoUrl: profileData.profilePhotoUrl || '',
          followersCount: profileData.followersCount || 0,
          followingCount: profileData.followingCount || 0,
          postsCount: profileData.postsCount || 0,
          isPrivate: profileData.isPrivate || false,
          createdAt: profileData.createdAt || new Date().toISOString()
        };

        // Send Welcome Email
        await sendEmail({
          to: email,
          subject: 'Welcome to IndiVibe!',
          text: `Hello ${userObj.displayName}! Welcome back to IndiVibe. You have successfully logged in to your social profile.`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid #111; background-color: #FAFAF8; max-width: 500px; margin: auto;">
              <h2 style="font-family: 'Arial Black', Impact, sans-serif; text-transform: uppercase; border-bottom: 3px solid #111; padding-bottom: 10px; color: #111;">Welcome back to IndiVibe!</h2>
              <p style="font-weight: bold; font-size: 16px;">Hello ${userObj.displayName},</p>
              <p>You have successfully logged in to your IndiVibe 3D Social Space account with your Patr ID: <strong>${email}</strong>.</p>
              <div style="background-color: #FFE834; border: 2.5px solid #111; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; margin: 20px 0; box-shadow: 3px 3px 0px #111;">
                INDIA'S OWN 3D SOCIAL SPACE IS LIVE!
              </div>
              <p>Toggle between 2D list views and the 3D interactive planet feed, host voice rooms, and co-create posts in real time.</p>
              <p style="font-size: 12px; color: #666; font-weight: bold;">If this login wasn't you, please reset your password immediately inside your profile settings.</p>
            </div>
          `
        });

        return NextResponse.json({
          success: true,
          message: 'Logged in successfully.',
          user: userObj,
          token
        });
      } catch (authError: any) {
        return NextResponse.json({ error: authError.message || 'Firebase login failed. Please verify credentials.' }, { status: 401 });
      }
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
