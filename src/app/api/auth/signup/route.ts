import { NextResponse } from 'next/server';
import { isMockFirebase, db } from '@/lib/firebase/config';
import { syncGlobalStore } from '@/lib/firebase/dbHelper';
import { doc, getDoc } from 'firebase/firestore';
import { sendEmail } from '@/lib/email';

// Global cache for pending OTPs (survives dev server reloads)
const globalStore = globalThis as any;
if (!globalStore.pendingSignups) {
  globalStore.pendingSignups = new Map<string, { otp: string; expires: number; attempts: number }>();
}
if (!globalStore.registeredUsers) {
  // Pre-seed some mock users to test taken state
  globalStore.registeredUsers = new Set<string>(['taken@patr.in', 'admin@patr.in']);
}

const pendingSignups = globalStore.pendingSignups;
const registeredUsers = globalStore.registeredUsers;

export async function POST(request: Request) {
  try {
    syncGlobalStore();
    const { patrId } = await request.json();

    if (!patrId) {
      return NextResponse.json({ error: 'Patr ID is required' }, { status: 400 });
    }

    // Clean up the handle
    let email = patrId.trim().toLowerCase();
    if (!email.endsWith('@patr.in')) {
      email = `${email}@patr.in`;
    }

    const username = email.split('@')[0];
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json({ 
        error: 'Patr ID must be between 3 and 30 characters, containing only letters, numbers, and underscores.' 
      }, { status: 400 });
    }

    // Check availability
    let isTaken = false;
    if (isMockFirebase) {
      isTaken = registeredUsers.has(email);
    } else {
      // In live Firebase, query Firestore 'users' collection where patrId == email
      try {
        const profileDoc = await getDoc(doc(db, 'users', email));
        isTaken = profileDoc.exists();
      } catch (err) {
        console.error("Firestore query error during signup check:", err);
        isTaken = registeredUsers.has(email);
      }
    }

    if (isTaken) {
      return NextResponse.json({ error: 'This Patr ID is already taken.' }, { status: 409 });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in global pending signups
    pendingSignups.set(email, { otp, expires, attempts: 0 });

    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'IndiVibe Identity Verification OTP',
      text: `Your 6-digit OTP verification code is: ${otp}. It is valid for 10 minutes. Please enter it to verify your Patr ID setup.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid #111; background-color: #FAFAF8; max-width: 500px; margin: auto;">
          <h2 style="font-family: 'Arial Black', Impact, sans-serif; text-transform: uppercase; border-bottom: 3px solid #111; padding-bottom: 10px; color: #111;">IndiVibe Verification</h2>
          <p style="font-weight: bold; font-size: 16px;">Welcome to India's own 3D Social Media space!</p>
          <p>To verify ownership and claim your <strong>${email}</strong> Patr ID, please use the following 6-digit OTP code:</p>
          <div style="background-color: #FFE834; border: 2.5px solid #111; padding: 15px; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 20px 0; box-shadow: 4px 4px 0px #111;">
            ${otp}
          </div>
          <p style="font-size: 12px; color: #666; font-weight: bold;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      `
    });

    console.log(`\n======================================================`);
    console.log(`[IndiVibe AUTH ENGINE]`);
    console.log(`Sending OTP to: ${email}`);
    console.log(`Your 6-digit OTP code is: ${otp}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`======================================================\n`);

    // Return the OTP in the response ONLY in mock mode so the frontend can display it or the developer can copy it instantly
    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to ${email}.`,
      email,
      // For testing convenience when no real email server is connected:
      mockOtp: isMockFirebase ? otp : undefined,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
