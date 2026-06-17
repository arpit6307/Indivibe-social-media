'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Camera, ShieldAlert, Sparkles } from 'lucide-react';
import { ImageCropperModal } from '@/components/ui/ImageCropperModal';

// Predefined fun Brutalist Avatars
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi1',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi2',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi3',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi4',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi5',
];

function ProfileSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(PRESET_AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null);
  
  const addToast = useUIStore((state) => state.addToast);
  const setSession = useAuthStore((state) => state.setSession);

  // File upload change handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast('File too large. Max size is 2MB.', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim() || !password.trim()) {
      setError('Password and Display Name are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/profile-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim(),
          bio: bio.trim(),
          profilePhotoUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete profile setup');
      }

      // Update Zustand Auth Store with session
      setSession(data.user, data.token);

      addToast('Welcome to IndiVibe! Profile created successfully.', 'success');
      router.push('/');

    } catch (err: any) {
      setError(err.message || 'Signup failed.');
      addToast(err.message || 'Profile setup failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-display uppercase mb-4 text-center">
        Complete Profile
      </h2>
      <p className="text-xs font-bold text-mid-gray mb-6 text-center uppercase tracking-wide">
        Finish setting up your credentials for <span className="text-pure-black font-extrabold">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar Uploader UI */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group w-24 h-24 rounded-full brutal-border overflow-hidden bg-white mb-4 shadow-[3px_3px_0px_#111111]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profilePhotoUrl}
              alt="Avatar Preview"
              className="w-full h-full object-cover"
            />
            <label className="absolute inset-0 bg-pure-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer brutal-transition">
              <Camera className="w-6 h-6 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-mid-gray text-center leading-normal">
            Upload custom photo (max 2MB)
          </span>

          {/* Preset Avatar Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
            <span className="text-xs font-extrabold text-pure-black mr-1 uppercase">Preset:</span>
            {PRESET_AVATARS.map((url, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setProfilePhotoUrl(url)}
                className={`w-8 h-8 rounded-full border-2 border-pure-black overflow-hidden bg-white transition hover:-translate-y-0.5 active:translate-y-0 ${
                  profilePhotoUrl === url ? 'ring-2 ring-brutal-yellow' : ''
                }`}
                disabled={loading}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Preset ${index}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Display Name Input */}
        <Input
          label="Display Name"
          placeholder="e.g., Arpit Singh Yadav"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={loading}
          required
        />

        {/* Password Input */}
        <Input
          label="Choose Password"
          type="password"
          placeholder="Minimum 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />

        {/* Bio Textarea */}
        <div className="w-full flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-pure-black select-none">
              Bio
            </label>
            <span className="text-xs font-bold text-mid-gray uppercase">
              {150 - bio.length} chars left
            </span>
          </div>
          <textarea
            maxLength={150}
            rows={3}
            placeholder="Tell India what you're vibing with..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={loading}
            className="w-full bg-light-gray text-pure-black brutal-border px-4 py-2.5 rounded-[4px] text-sm placeholder:text-mid-gray focus:outline-none focus:bg-white focus:border-brutal-yellow resize-none"
          />
        </div>

        {error && (
          <div className="brutal-border bg-error-red/10 text-error-red p-3 rounded-md flex items-start gap-2.5 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-tight">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Creating Account...' : (
            <>
              Complete Setup <Sparkles className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      {photoToCrop && (
        <ImageCropperModal
          imageSrc={photoToCrop}
          onCrop={(cropped) => {
            setProfilePhotoUrl(cropped);
            setPhotoToCrop(null);
            addToast('Profile picture cropped successfully!', 'success');
          }}
          onClose={() => setPhotoToCrop(null)}
        />
      )}
    </Card>
  );
}

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={
      <Card className="text-center bg-brutal-yellow">
        <p className="font-display uppercase text-sm">Loading profile setup screen...</p>
      </Card>
    }>
      <ProfileSetupForm />
    </Suspense>
  );
}
