'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const loginPath = origin + '/login';
      const params = `redirect_uri=${encodeURIComponent(loginPath)}&return_to=${encodeURIComponent(loginPath)}&redirect=${encodeURIComponent(loginPath)}&callbackUrl=${encodeURIComponent(loginPath)}&next=${encodeURIComponent(loginPath)}&continue=${encodeURIComponent(loginPath)}`;
      const redirectUrl = `https://patr-india-ka-apna-mail.vercel.app/register?${params}`;
      window.location.href = redirectUrl;
    }
  }, []);

  const [patrId, setPatrId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mockOtpInfo, setMockOtpInfo] = useState<{ visible: boolean; otp: string; email: string }>({
    visible: false,
    otp: '',
    email: '',
  });

  const router = useRouter();
  const addToast = useUIStore((state) => state.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!patrId.trim()) {
      setError('Please choose a Patr ID.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patrId: patrId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      addToast('Patr ID is available! Sending OTP...', 'success');

      if (data.mockOtp) {
        // If mock OTP is returned, display it so the developer knows what to type next
        setMockOtpInfo({
          visible: true,
          otp: data.mockOtp,
          email: data.email,
        });
      } else {
        // Redirect directly to verify route in production
        router.push(`/verify?email=${encodeURIComponent(data.email)}`);
      }

    } catch (err: any) {
      setError(err.message || 'Server error. Please try again.');
      addToast(err.message || 'Failed to claim ID.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <h2 className="text-2xl font-display uppercase mb-4 text-center">
          Create Account
        </h2>
        <p className="text-sm font-bold text-mid-gray mb-6 text-center leading-normal">
          Pick your handle. Your handle will serve as your @patr.in email and social identity.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="relative flex items-center">
              <Input
                label="Choose Patr ID"
                placeholder="e.g., arpitsingh"
                value={patrId}
                onChange={(e) => setPatrId(e.target.value)}
                disabled={loading}
                error={error}
                className="pr-18 font-bold"
              />
              <span className="absolute right-3 top-[38px] text-sm font-extrabold text-pure-black select-none pointer-events-none">
                @patr.in
              </span>
            </div>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Checking Availability...' : (
              <>
                Claim My Patr ID <Sparkles className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t-2 border-pure-black pt-4 text-center">
          <Link
            href="/login"
            className="text-sm font-extrabold hover:underline text-pure-black"
          >
            Already have a Patr ID? Log In →
          </Link>
        </div>
      </Card>

      {/* Mock OTP display Modal */}
      {mockOtpInfo.visible && (
        <div className="fixed inset-0 bg-pure-black/60 flex items-center justify-center p-4 z-50 animate-[fadeIn_0.15s_ease-out]">
          <Card className="max-w-sm w-full relative bg-brutal-yellow text-pure-black">
            <h3 className="text-xl font-display uppercase mb-3">
              [MOCK AUTH MODULE]
            </h3>
            <p className="text-sm font-bold mb-4 leading-relaxed">
              We did not find a real email server configured. The simulation generated this OTP for <span className="font-extrabold underline">{mockOtpInfo.email}</span>:
            </p>
            <div className="brutal-border bg-white text-center py-4 mb-5 rounded-[4px]">
              <span className="font-display text-4xl tracking-widest">{mockOtpInfo.otp}</span>
            </div>
            <p className="text-xs font-bold mb-5 leading-normal opacity-85">
              Copy this code, we will enter it in the next verification step. This is logged to your server console too!
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                router.push(`/verify?email=${encodeURIComponent(mockOtpInfo.email)}`);
              }}
            >
              Continue to Verification <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
