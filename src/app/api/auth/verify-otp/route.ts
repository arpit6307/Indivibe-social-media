import { NextResponse } from 'next/server';
import { isMockFirebase } from '@/lib/firebase/config';

const globalStore = globalThis as any;
const pendingSignups = globalStore.pendingSignups || new Map();
const registeredUsers = globalStore.registeredUsers || new Set();

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pending = pendingSignups.get(cleanEmail);

    if (!pending) {
      return NextResponse.json({ error: 'No verification request found for this email. Please request a new OTP.' }, { status: 404 });
    }

    if (Date.now() > pending.expires) {
      pendingSignups.delete(cleanEmail);
      return NextResponse.json({ error: 'This OTP has expired (validity 10 mins). Please request a new one.' }, { status: 410 });
    }

    if (pending.attempts >= 3) {
      return NextResponse.json({ 
        error: 'Too many incorrect attempts. Please try again after 30 minutes.' 
      }, { status: 429 });
    }

    if (pending.otp !== otp.trim()) {
      pending.attempts += 1;
      pendingSignups.set(cleanEmail, pending);
      const remaining = 3 - pending.attempts;
      return NextResponse.json({ 
        error: `Incorrect OTP. ${remaining} attempts remaining.` 
      }, { status: 401 });
    }

    // Success! Clear the pending signup
    pendingSignups.delete(cleanEmail);

    // Generate a mock UID
    const username = cleanEmail.split('@')[0];
    const mockUid = `mock-uid-${Math.random().toString(36).substring(2, 11)}`;

    // Return session data.
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully.',
      session: {
        uid: mockUid,
        email: cleanEmail,
        username,
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
