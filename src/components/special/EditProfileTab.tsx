'use client';

import React, { useState } from 'react';
import { Camera, Sparkles, User, Globe, Save, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { ImageCropperModal } from '@/components/ui/ImageCropperModal';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi1',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi2',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi3',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi4',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=indi5',
];

interface EditProfileTabProps {
  currentUserId: string;
  currentUserProfile: any;
  onRefreshProfile: () => void;
  onCancel: () => void;
}

export default function EditProfileTab({
  currentUserId,
  currentUserProfile,
  onRefreshProfile,
  onCancel
}: EditProfileTabProps) {
  const addToast = useUIStore((state) => state.addToast);
  const updateAuthStoreProfile = useAuthStore((state) => state.updateProfile);

  const [displayName, setDisplayName] = useState(currentUserProfile?.displayName || '');
  const [username, setUsername] = useState(currentUserProfile?.username || '');
  const [bio, setBio] = useState(currentUserProfile?.bio || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(currentUserProfile?.profilePhotoUrl || PRESET_AVATARS[0]);
  const [gender, setGender] = useState(currentUserProfile?.gender || '');
  const [category, setCategory] = useState(currentUserProfile?.category || '');
  const [isPrivate, setIsPrivate] = useState(currentUserProfile?.isPrivate || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('File too large. Max size is 5MB.', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError("Display Name cannot be empty.");
      addToast("Display Name cannot be empty.", "error");
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError("Username cannot be empty.");
      addToast("Username cannot be empty.", "error");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setError("Username must be 3-30 chars, containing only letters, numbers, and underscores.");
      addToast("Invalid username format.", "error");
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = profilePhotoUrl.trim();

      // If it's a newly uploaded base64 data URL, upload to Cloudinary first
      if (finalPhotoUrl.startsWith('data:image')) {
        addToast("Uploading profile photo to cloud storage...", "info");
        try {
          const cloudRes = await fetch('/api/cloudinary', {
            method: 'POST',
            body: JSON.stringify({ file: finalPhotoUrl, folder: 'indivibe_avatars' }),
            headers: { 'Content-Type': 'application/json' }
          });
          const cloudData = await cloudRes.json();
          if (cloudData.success && cloudData.secure_url) {
            finalPhotoUrl = cloudData.secure_url;
            addToast("Photo uploaded to cloud successfully!", "success");
          } else {
            console.warn("Cloudinary upload failed, using fallback URL:", cloudData.error || cloudData.message);
          }
        } catch (uploadErr) {
          console.error("Cloudinary upload error:", uploadErr);
        }
      }

      const updatedData = {
        displayName: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        profilePhotoUrl: finalPhotoUrl,
        gender,
        category,
        isPrivate
      };

      const res = await fetch(`/api/social/users/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: currentUserId, 
          patrId: currentUserProfile?.patrId,
          profileData: updatedData 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      updateAuthStoreProfile(updatedData);
      onRefreshProfile();
      addToast("Profile details updated successfully!", "success");
      onCancel();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update profile");
      addToast(err.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.15s_ease-out]">
      
      {/* Header */}
      <div className="border-b-3 border-pure-black pb-4 mb-6 flex justify-between items-center">
        <div>
          <h2 className="font-display text-2xl uppercase">Edit Social Space</h2>
          <p className="text-xs font-bold text-mid-gray uppercase tracking-wider mt-1">
            Configure your IndiVibe identity, avatar photo, and bio details
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray transition-colors cursor-pointer"
          aria-label="Close Editor"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {error && (
        <div className="bg-error-red/15 border-2 border-error-red text-error-red p-3 rounded text-xs font-bold uppercase mb-5 leading-normal">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Card for Identity */}
        <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-5">
          
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3 border-b-2 border-pure-black pb-5">
            <div className="relative w-20 h-20 rounded-full brutal-border overflow-hidden bg-white shadow-[2px_2px_0px_#111]">
              <img src={profilePhotoUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
            </div>
            
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white brutal-border text-[10px] font-extrabold uppercase hover:bg-brutal-yellow transition-colors cursor-pointer shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111]">
              <Camera className="w-3.5 h-3.5" />
              Upload Custom Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={saving} />
            </label>

            {/* Presets */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
              <span className="text-[9px] font-extrabold text-mid-gray uppercase">Presets:</span>
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setProfilePhotoUrl(url)}
                  className={`w-6 h-6 rounded-full border border-pure-black overflow-hidden bg-white hover:-translate-y-0.5 transition-transform ${
                    profilePhotoUrl === url ? 'ring-2 ring-brutal-yellow' : ''
                  }`}
                  disabled={saving}
                >
                  <img src={url} alt="Preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-display uppercase tracking-wider text-mid-gray flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pure-black" /> Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-light-gray brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black font-mono lowercase"
              disabled={saving}
              placeholder="e.g. arpit_yadav"
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-display uppercase tracking-wider text-mid-gray flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-pure-black" /> Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-light-gray brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black"
              disabled={saving}
              placeholder="Your full name"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-display uppercase tracking-wider text-mid-gray flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-pure-black" /> Space Bio details
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-light-gray brutal-border text-xs p-3 outline-none font-bold text-pure-black min-h-[90px]"
              disabled={saving}
              placeholder="Tell other space travelers about yourself..."
            />
          </div>

          {/* Gender & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-display uppercase text-mid-gray">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-light-gray brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black cursor-pointer"
                disabled={saving}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-display uppercase text-mid-gray">Profile Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-light-gray brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black cursor-pointer"
                disabled={saving}
              >
                <option value="">Select Category</option>
                <option value="Creator">Creator</option>
                <option value="Artist">Artist</option>
                <option value="Developer">Developer</option>
                <option value="Vlogger">Vlogger</option>
                <option value="Gamer">Gamer</option>
                <option value="Business">Business</option>
              </select>
            </div>
          </div>

        </Card>

        {/* Buttons */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="flex-1 text-xs py-3 brutal-border shadow-[3px_3px_0px_#111] bg-white text-pure-black border-2"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 text-xs py-3 brutal-border shadow-[3px_3px_0px_#111] bg-brutal-yellow text-pure-black border-2"
            disabled={saving}
          >
            <Save className="w-4 h-4 shrink-0" /> Save Profile Details
          </Button>
        </div>

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
    </div>
  );
}
