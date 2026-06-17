'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { ShieldAlert, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [registerUrl, setRegisterUrl] = useState('https://patr-india-ka-apna-mail.vercel.app/register');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const loginPath = origin + '/login';
      const params = `redirect_uri=${encodeURIComponent(loginPath)}&return_to=${encodeURIComponent(loginPath)}&redirect=${encodeURIComponent(loginPath)}&callbackUrl=${encodeURIComponent(loginPath)}&next=${encodeURIComponent(loginPath)}&continue=${encodeURIComponent(loginPath)}`;
      setRegisterUrl(`https://patr-india-ka-apna-mail.vercel.app/register?${params}`);
    }
  }, []);

  const [patrId, setPatrId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const addToast = useUIStore((state) => state.addToast);
  const setSession = useAuthStore((state) => state.setSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!patrId.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patrId: patrId.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      // Save user session in Zustand store
      setSession(data.user, data.token);

      addToast(`Logged in successfully! Welcome back, ${data.user.displayName}!`, 'success');
      router.push('/');

    } catch (err: any) {
      setError(err.message || 'Login failed.');
      addToast(err.message || 'Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-display uppercase mb-4 text-center">
        Log In
      </h2>
      <p className="text-sm font-bold text-mid-gray mb-6 text-center leading-normal">
        Sign in to your IndiVibe identity with your Patr ID.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative flex items-center">
          <Input
            label="Patr ID or Email"
            placeholder="e.g., arpitsingh"
            value={patrId}
            onChange={(e) => setPatrId(e.target.value)}
            disabled={loading}
            className="pr-18 font-bold"
            required
          />
          {!patrId.includes('@') && (
            <span className="absolute right-3 top-[38px] text-sm font-extrabold text-pure-black select-none pointer-events-none">
              @patr.in
            </span>
          )}
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />

        {error && (
          <div className="brutal-border bg-error-red/10 text-error-red p-3 rounded-md flex items-start gap-2.5 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-tight">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Verifying...' : (
            <>
              Log In <LogIn className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 border-t-2 border-pure-black pt-4 text-center">
        <a
          href={registerUrl}
          className="text-sm font-extrabold hover:underline text-pure-black"
        >
          New to IndiVibe? Claim your Patr ID &rarr;
        </a>
      </div>
    </Card>
  );
}
