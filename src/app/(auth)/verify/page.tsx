'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { Check } from 'lucide-react';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const addToast = useUIStore((state) => state.addToast);

  // Timer countdown logic
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Format time (e.g. 09:59)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (otp.length !== 6 || isNaN(Number(otp))) {
      setError('Please enter a valid 6-digit numeric OTP.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      addToast('OTP verified successfully! Set up your profile.', 'success');
      router.push(`/profile-setup?email=${encodeURIComponent(email)}`);

    } catch (err: any) {
      setError(err.message || 'OTP Verification failed.');
      addToast(err.message || 'Verification failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setOtp('');
    setTimeLeft(600); // Reset timer
    addToast('Requesting new OTP...', 'info');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patrId: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast('A new OTP has been generated.', 'success');
      if (data.mockOtp) {
        addToast(`New Mock OTP: ${data.mockOtp}`, 'info', 6000);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to resend OTP.', 'error');
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-display uppercase mb-4 text-center">
        Verify OTP
      </h2>
      <p className="text-sm font-bold text-mid-gray mb-6 text-center leading-normal">
        Enter the 6-digit verification code sent to your inbox: <br />
        <span className="text-pure-black font-extrabold underline">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Verification Code"
          type="text"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          disabled={loading}
          error={error}
          className="text-center text-2xl font-display tracking-widest"
        />

        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span className="text-pure-black">
            Time Remaining: <span className={timeLeft < 60 ? 'text-error-red animate-pulse' : 'text-pure-black'}>{formatTime(timeLeft)}</span>
          </span>
          {timeLeft <= 0 ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-pure-black underline hover:no-underline cursor-pointer"
            >
              Resend OTP
            </button>
          ) : (
            <span className="text-mid-gray">Resend in {formatTime(timeLeft)}</span>
          )}
        </div>

        <Button type="submit" variant="primary" fullWidth disabled={loading || timeLeft <= 0}>
          {loading ? 'Verifying...' : (
            <>
              Verify OTP <Check className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <Card className="text-center bg-brutal-yellow">
        <p className="font-display uppercase text-sm">Loading verification screen...</p>
      </Card>
    }>
      <VerifyForm />
    </Suspense>
  );
}
