'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  Sun, 
  Moon, 
  Eye, 
  EyeOff, 
  Bell, 
  Lock, 
  HelpCircle, 
  LogOut, 
  X, 
  Copy,
  Info,
  Palette,
  ShieldAlert,
  Smartphone,
  Trash2,
  Check,
  FileText
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

interface SettingsTabProps {
  currentUserId: string;
  currentUserProfile: any;
  onRefreshProfile: () => void;
  onLogout: () => void;
  onCancel?: () => void;
}

type SettingsSubPage = 'general' | 'theme' | 'notifications' | 'privacy' | 'security' | 'support' | null;

const ACCENT_COLORS = [
  { name: 'Brutal Yellow', color: '#FFE834', class: 'bg-[#FFE834]' },
  { name: 'Cyber Cyan', color: '#00FFFF', class: 'bg-[#00FFFF]' },
  { name: 'Hot Pink', color: '#FF007F', class: 'bg-[#FF007F]' },
  { name: 'Neon Green', color: '#39FF14', class: 'bg-[#39FF14]' },
  { name: 'Electric Orange', color: '#FF5F1F', class: 'bg-[#FF5F1F]' }
];

export default function SettingsTab({
  currentUserId,
  currentUserProfile,
  onRefreshProfile,
  onLogout,
  onCancel
}: SettingsTabProps) {
  const addToast = useUIStore((state) => state.addToast);
  const updateAuthStoreProfile = useAuthStore((state) => state.updateProfile);

  // Active sub-page state
  const [activeSubPage, setActiveSubPage] = useState<SettingsSubPage>(null);

  // Settings states
  const [isPrivate, setIsPrivate] = useState(currentUserProfile?.isPrivate || false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColor] = useState('Brutal Yellow');

  // Notifications State
  const [pushEnabled, setPushEnabled] = useState(true);
  const [likesAlert, setLikesAlert] = useState('everyone');
  const [commentsAlert, setCommentsAlert] = useState('everyone');
  const [messagesAlert, setMessagesAlert] = useState('everyone');

  // Help state
  const [bugDescription, setBugDescription] = useState('');
  const [bugCategory, setBugCategory] = useState('Bug');
  const [faqOpenIdx, setFaqOpenIdx] = useState<number | null>(null);

  // General Settings States
  const [selectedLanguage, setSelectedLanguage] = useState('English (IN)');
  const [autoPlayVideos, setAutoPlayVideos] = useState(true);
  const [fontSize, setFontSize] = useState('Medium');
  const [clearingCache, setClearingCache] = useState(false);

  // Security & PIN States
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState('');
  const [sessions, setSessions] = useState([
    { id: '1', device: 'Chrome Browser (Windows 11 PC)', location: 'Delhi, India', active: true },
    { id: '2', device: 'IndiVibe App (iPhone 14 Pro)', location: 'Mumbai, India', active: false },
    { id: '3', device: 'Safari Browser (MacBook Air)', location: 'Bengaluru, India', active: false }
  ]);

  // Load configuration from local storage on mount
  useEffect(() => {
    const isDark = document.body.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
    
    const storedPin = localStorage.getItem('indivibe-pin');
    if (storedPin) setSavedPin(storedPin);

    const storedAccent = localStorage.getItem('indivibe-accent');
    if (storedAccent) setAccentColor(storedAccent);
  }, []);

  // Copy Username helper
  const handleCopyUsername = () => {
    navigator.clipboard.writeText(currentUserProfile?.username || '');
    addToast("Username copied to clipboard!", "success");
  };

  // Theme Swapper
  const handleToggleTheme = (selectedTheme: 'light' | 'dark') => {
    setTheme(selectedTheme);
    localStorage.setItem('indivibe-theme', selectedTheme);
    if (selectedTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    addToast(`Theme switched to ${selectedTheme} mode!`, 'success');
  };

  // Accent Color Handler
  const handleAccentChange = (name: string) => {
    setAccentColor(name);
    localStorage.setItem('indivibe-accent', name);
    addToast(`Theme accent color set to ${name}!`, 'success');
  };

  // Privacy toggler API sync
  const handleTogglePrivacy = async (nextPrivacy: boolean) => {
    setIsPrivate(nextPrivacy);
    try {
      const updatedData = {
        displayName: currentUserProfile?.displayName || currentUserUsername.toUpperCase(),
        username: currentUserProfile?.username || '',
        bio: currentUserProfile?.bio || '',
        profilePhotoUrl: currentUserProfile?.profilePhotoUrl || '',
        gender: currentUserProfile?.gender || '',
        category: currentUserProfile?.category || '',
        isPrivate: nextPrivacy
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

      if (!res.ok) throw new Error("Failed to sync privacy");
      updateAuthStoreProfile({ isPrivate: nextPrivacy });
      onRefreshProfile();
      addToast(`Account privacy updated to ${nextPrivacy ? 'Private' : 'Public'}!`, 'success');
    } catch (err) {
      console.error(err);
      addToast("Failed to sync privacy setting", "error");
      setIsPrivate(!nextPrivacy); // rollback
    }
  };

  const handlePasswordReset = () => {
    addToast(`Password reset link dispatched to ${currentUserProfile?.patrId || 'associated email'}!`, 'success');
  };

  // Simulate Cache Clear
  const handleClearCache = () => {
    setClearingCache(true);
    addToast("Calculating cache size...", "info");
    setTimeout(() => {
      setClearingCache(false);
      addToast("142.5 MB of temporary cache deleted successfully!", "success");
    }, 1800);
  };

  // PIN pad handlers
  const handlePinPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  const handleSavePin = () => {
    if (pin.length !== 4) {
      addToast("Please enter a valid 4-digit PIN", "error");
      return;
    }
    localStorage.setItem('indivibe-pin', pin);
    setSavedPin(pin);
    setPin('');
    addToast("App Security PIN set successfully!", "success");
  };

  const handleRemovePin = () => {
    localStorage.removeItem('indivibe-pin');
    setSavedPin('');
    setPin('');
    addToast("App Security PIN removed successfully!", "info");
  };

  const handleRevokeSession = (id: string, device: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    addToast(`Session for ${device} revoked successfully!`, 'success');
  };

  const currentUserUsername = currentUserProfile?.username || 'user';

  const faqs = [
    { q: "How do I make my account private?", a: "Go to settings, open the 'Account Privacy' page, and toggle on 'Private Account Space'. Only approved followers can view your content." },
    { q: "Theme mode is not persisting?", a: "Ensure your browser does not clear local storage automatically. IndiVibe saves themes under 'indivibe-theme'." },
    { q: "What does the PIN code lock do?", a: "Setting a security PIN creates an access gate lock within your local device browser session to protect sensitive social media details." },
    { q: "How do I change my username?", a: "Go to your profile page, click 'Edit Space', and update your username. Note: it must be unique and contain no special characters except underscores." }
  ];

  // --- RENDERING SUB PAGES ---

  // 1. GENERAL SETTINGS
  if (activeSubPage === 'general') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">General Settings</h2>
        </div>

        <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-6">
          {/* Language Selection */}
          <div className="space-y-1.5">
            <span className="font-display text-xs uppercase block text-pure-black">App Language</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-light-gray brutal-border text-xs px-3 py-2.5 outline-none font-bold text-pure-black cursor-pointer"
            >
              <option value="English (IN)">English (IN)</option>
              <option value="Hindi (IN)">Hindi (IN)</option>
              <option value="Spanish (ES)">Spanish (ES)</option>
              <option value="French (FR)">French (FR)</option>
              <option value="German (DE)">German (DE)</option>
            </select>
          </div>

          {/* Font Size Selection */}
          <div className="space-y-1.5">
            <span className="font-display text-xs uppercase block text-pure-black">Interface Font Size</span>
            <div className="grid grid-cols-3 gap-2">
              {['Small', 'Medium', 'Large'].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`py-2 px-3 text-[10px] font-display uppercase brutal-border shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                    fontSize === sz ? 'bg-brutal-yellow text-pure-black' : 'bg-white text-pure-black'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Autoplay Media Switch */}
          <div className="flex items-center justify-between brutal-border bg-light-gray/30 p-4 rounded-lg">
            <div>
              <span className="font-display text-xs uppercase block text-pure-black">Autoplay Media</span>
              <span className="text-[9px] font-bold text-mid-gray uppercase block mt-0.5 leading-tight">
                Automatically play story streams & videos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAutoPlayVideos(!autoPlayVideos)}
              className={`w-12 h-6 rounded-full brutal-border flex items-center p-0.5 cursor-pointer transition-colors ${
                autoPlayVideos ? 'bg-brutal-yellow' : 'bg-mid-gray/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white brutal-border transition-transform ${autoPlayVideos ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>

          {/* Clear Cache Button */}
          <div className="pt-2 border-t border-dashed border-pure-black/20">
            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearingCache}
              className="w-full py-3 brutal-border bg-white text-pure-black hover:bg-light-gray text-xs font-display uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Trash2 className="w-4 h-4" />
              {clearingCache ? 'Clearing cache files...' : 'Clear Temp App Cache'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // 2. THEME & DISPLAY CUSTOMIZER
  if (activeSubPage === 'theme') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">Theme Customizer</h2>
        </div>

        <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-6">
          
          {/* Light / Dark Mode Selectors */}
          <div className="space-y-3">
            <span className="font-display text-xs uppercase block text-pure-black">Display Mode</span>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleToggleTheme('light')}
                className={`p-4 brutal-border rounded-xl text-center flex flex-col items-center gap-2 shadow-[4px_4px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-light-gray transition-colors ${
                  theme === 'light' ? 'bg-brutal-yellow/15 border-brutal-yellow border-3' : 'bg-white'
                }`}
              >
                <Sun className="w-8 h-8 text-pure-black" />
                <span className="font-display text-xs uppercase text-pure-black">Light Theme</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTheme('dark')}
                className={`p-4 brutal-border rounded-xl text-center flex flex-col items-center gap-2 shadow-[4px_4px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-light-gray transition-colors ${
                  theme === 'dark' ? 'bg-brutal-yellow/15 border-brutal-yellow border-3' : 'bg-white'
                }`}
              >
                <Moon className="w-8 h-8 text-pure-black" />
                <span className="font-display text-xs uppercase text-pure-black">Dark Theme</span>
              </button>
            </div>
          </div>

          {/* Accent Color Chips */}
          <div className="space-y-3 pt-3 border-t border-dashed border-pure-black/20">
            <div className="flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-pure-black" />
              <span className="font-display text-xs uppercase text-pure-black">Accent Highlights</span>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_COLORS.map((colorItem) => (
                <button
                  key={colorItem.name}
                  type="button"
                  onClick={() => handleAccentChange(colorItem.name)}
                  className={`w-9 h-9 rounded-full border-2 border-pure-black flex items-center justify-center cursor-pointer transition-transform hover:scale-105 shadow-[2px_2px_0px_#111] ${colorItem.class}`}
                  title={colorItem.name}
                >
                  {accentColor === colorItem.name && (
                    <Check className="w-4 h-4 text-pure-black stroke-[3.5]" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-bold text-mid-gray uppercase leading-normal">
              Current Active Highlight Accent: <span className="text-pure-black font-mono">{accentColor}</span>
            </p>
          </div>

          <div className="bg-brutal-yellow/20 brutal-border p-3.5 rounded text-[9px] font-extrabold uppercase text-mid-gray leading-normal">
            DISPLAY RULES ARE PERSISTED IMMEDIATELY IN LOCAL STORAGE CACHE.
          </div>
        </Card>
      </div>
    );
  }

  // 3. PUSH ALERTS
  if (activeSubPage === 'notifications') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">Push Notifications</h2>
        </div>

        <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-5">
          <div className="flex items-center justify-between brutal-border bg-light-gray/30 p-4 rounded-lg">
            <div>
              <span className="font-display text-xs uppercase block text-pure-black">Enable Push Alerts</span>
              <span className="text-[9px] font-bold text-mid-gray uppercase block mt-0.5 leading-tight">
                Receive notifications when you are away.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPushEnabled(!pushEnabled)}
              className={`w-12 h-6 rounded-full brutal-border flex items-center p-0.5 cursor-pointer transition-colors ${
                pushEnabled ? 'bg-brutal-yellow' : 'bg-mid-gray/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white brutal-border transition-transform ${pushEnabled ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>

          {pushEnabled ? (
            <div className="space-y-4 pt-3 border-t border-dashed border-pure-black/20">
              <div className="space-y-1.5">
                <span className="font-display text-xs uppercase block text-pure-black">Likes Feed Alerts</span>
                <select
                  value={likesAlert}
                  onChange={(e) => setLikesAlert(e.target.value)}
                  className="w-full bg-light-gray brutal-border text-xs px-3 py-2 outline-none font-bold text-pure-black cursor-pointer"
                >
                  <option value="off">Off</option>
                  <option value="following">From People I Follow</option>
                  <option value="everyone">From Everyone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="font-display text-xs uppercase block text-pure-black">Comments Alerts</span>
                <select
                  value={commentsAlert}
                  onChange={(e) => setCommentsAlert(e.target.value)}
                  className="w-full bg-light-gray brutal-border text-xs px-3 py-2 outline-none font-bold text-pure-black cursor-pointer"
                >
                  <option value="off">Off</option>
                  <option value="following">From People I Follow</option>
                  <option value="everyone">From Everyone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="font-display text-xs uppercase block text-pure-black">Direct Messages Alerts</span>
                <select
                  value={messagesAlert}
                  onChange={(e) => setMessagesAlert(e.target.value)}
                  className="w-full bg-light-gray brutal-border text-xs px-3 py-2 outline-none font-bold text-pure-black cursor-pointer"
                >
                  <option value="off">Off</option>
                  <option value="following">From People I Follow</option>
                  <option value="everyone">From Everyone</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-error-red/10 border-2 border-error-red/30 rounded text-center text-xs font-bold uppercase text-error-red">
              All push notifications are currently muted.
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 4. ACCOUNT PRIVACY
  if (activeSubPage === 'privacy') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">Account Privacy</h2>
        </div>

        <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-6">
          
          {/* Private Space Toggle */}
          <div className="flex items-center justify-between brutal-border bg-light-gray/30 p-4 rounded-lg">
            <div>
              <div className="flex items-center gap-1.5">
                {isPrivate ? <EyeOff className="w-4 h-4 text-pure-black" /> : <Eye className="w-4 h-4 text-pure-black" />}
                <span className="font-display text-xs uppercase block text-pure-black">Private Account Space</span>
              </div>
              <span className="text-[9px] font-bold text-mid-gray uppercase block mt-1 leading-tight">
                Only approved followers can view your content.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePrivacy(!isPrivate)}
              className={`w-12 h-6 rounded-full brutal-border flex items-center p-0.5 cursor-pointer transition-colors ${
                isPrivate ? 'bg-brutal-yellow' : 'bg-mid-gray/20'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white brutal-border transition-transform ${isPrivate ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>

          {/* Activity Status Toggle */}
          <div className="flex items-center justify-between brutal-border bg-light-gray/30 p-4 rounded-lg">
            <div>
              <span className="font-display text-xs uppercase block text-pure-black">Show Activity Status</span>
              <span className="text-[9px] font-bold text-mid-gray uppercase block mt-1 leading-tight">
                Allow profiles to see when you are active.
              </span>
            </div>
            <button
              type="button"
              className="w-12 h-6 rounded-full brutal-border flex items-center p-0.5 cursor-pointer bg-brutal-yellow"
            >
              <div className="w-5 h-5 rounded-full bg-white brutal-border translate-x-6"></div>
            </button>
          </div>

          {/* Blocked Accounts Mock List */}
          <div className="space-y-2.5 pt-3 border-t border-dashed border-pure-black/20">
            <span className="font-display text-xs uppercase block text-pure-black">Blocked Accounts</span>
            <div className="border-2 border-pure-black rounded-lg divide-y-2 divide-pure-black overflow-hidden bg-light-gray/20">
              <div className="p-3 flex items-center justify-between text-xs bg-white">
                <div>
                  <span className="font-display text-[10px] block uppercase text-pure-black">@spammer_bot_99</span>
                  <span className="text-[8px] font-bold text-mid-gray uppercase">Blocked on June 12, 2026</span>
                </div>
                <button
                  type="button"
                  onClick={() => addToast("User unblocked successfully!", "success")}
                  className="py-1 px-2.5 brutal-border bg-white text-[9px] font-display uppercase shadow-[1px_1px_0px_#111] hover:bg-brutal-yellow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  Unblock
                </button>
              </div>
              <div className="p-3 flex items-center justify-between text-xs bg-white">
                <div>
                  <span className="font-display text-[10px] block uppercase text-pure-black">@toxic_profile</span>
                  <span className="text-[8px] font-bold text-mid-gray uppercase">Blocked on May 28, 2026</span>
                </div>
                <button
                  type="button"
                  onClick={() => addToast("User unblocked successfully!", "success")}
                  className="py-1 px-2.5 brutal-border bg-white text-[9px] font-display uppercase shadow-[1px_1px_0px_#111] hover:bg-brutal-yellow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  Unblock
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 5. SECURITY & PIN
  if (activeSubPage === 'security') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">Security & PIN</h2>
        </div>

        <div className="space-y-6">
          {/* Reset Password card */}
          <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4.5 h-4.5 text-pure-black" />
              <span className="font-display text-xs uppercase block text-pure-black">Secure Password Reset</span>
            </div>
            <p className="text-[9px] font-bold text-mid-gray uppercase leading-normal">
              Trigger a secure password reset link to your registered email address `{currentUserProfile?.patrId || 'user@example.com'}`.
            </p>
            <Button
              onClick={handlePasswordReset}
              className="text-[9px] font-display uppercase py-2 px-3 bg-white hover:bg-light-gray border-2 shadow-[2px_2px_0px_#111]"
            >
              Send Secure Reset Link
            </Button>
          </Card>

          {/* Neobrutalist PIN Pad Card */}
          <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-5">
            <div className="flex items-center gap-2 border-b-2 border-pure-black pb-3">
              <ShieldAlert className="w-4.5 h-4.5 text-pure-black" />
              <span className="font-display text-xs uppercase block text-pure-black">Device PIN Gate Lock</span>
            </div>

            <div className="text-center space-y-3">
              {/* Show Status */}
              <div>
                <span className="text-[9px] font-extrabold uppercase text-mid-gray block">PIN GATE STATUS:</span>
                <span className={`inline-block text-[10px] font-display uppercase px-2 py-0.5 rounded border-2 mt-1 ${
                  savedPin ? 'bg-success-green/10 text-success-green border-success-green' : 'bg-error-red/10 text-error-red border-error-red'
                }`}>
                  {savedPin ? 'Lock Enabled' : 'No PIN Configured'}
                </span>
              </div>

              {/* Enter PIN Display screen */}
              <div className="bg-light-gray brutal-border py-4 px-2 rounded-lg max-w-[200px] mx-auto text-center font-mono text-xl font-extrabold tracking-[0.75rem] text-pure-black">
                {pin.padEnd(4, '_').split('').map((char, idx) => (
                  <span key={idx} className="mx-1">
                    {char === '_' ? '_' : '•'}
                  </span>
                ))}
              </div>

              {/* Custom Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[200px] mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinPress(num)}
                    className="h-10 w-10 mx-auto rounded brutal-border bg-white text-xs font-display hover:bg-brutal-yellow transition-colors shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-10 w-10 mx-auto rounded brutal-border bg-error-red/10 text-[9px] font-display text-error-red hover:bg-error-red/20 transition-colors shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  CLR
                </button>
                <button
                  type="button"
                  onClick={() => handlePinPress('0')}
                  className="h-10 w-10 mx-auto rounded brutal-border bg-white text-xs font-display hover:bg-brutal-yellow transition-colors shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinDelete}
                  className="h-10 w-10 mx-auto rounded brutal-border bg-white text-[9px] font-display hover:bg-light-gray transition-colors shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  DEL
                </button>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleSavePin}
                  disabled={pin.length !== 4}
                  className="flex-1 py-2 brutal-border bg-brutal-yellow text-pure-black disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-display uppercase shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  Save PIN Code
                </button>
                {savedPin && (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="flex-1 py-2 brutal-border bg-error-red/10 border-error-red text-error-red text-[10px] font-display uppercase shadow-[2px_2px_0px_rgba(224,36,36,0.2)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    Remove PIN
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Active login sessions */}
          <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4.5 h-4.5 text-pure-black" />
              <span className="font-display text-xs uppercase block text-pure-black">Active Device Sessions</span>
            </div>

            <div className="space-y-3.5 pt-1.5">
              {sessions.map(sess => (
                <div key={sess.id} className="brutal-border bg-light-gray/25 p-3 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-display text-[9px] block uppercase text-pure-black leading-none mb-1">{sess.device}</span>
                    <span className="block text-[8px] font-mono text-mid-gray uppercase">{sess.location} • {sess.active ? 'ACTIVE NOW' : 'LAST ACTIVE 2D AGO'}</span>
                  </div>
                  {sess.active ? (
                    <span className="text-[8px] font-extrabold uppercase bg-success-green/20 text-success-green border border-success-green px-1.5 py-0.5 rounded">
                      This Device
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRevokeSession(sess.id, sess.device)}
                      className="text-[8px] font-display uppercase bg-white hover:bg-error-red/10 border border-pure-black px-2 py-1 rounded cursor-pointer shadow-[1px_1px_0px_#111] active:translate-x-0.5 active:translate-y-0.5"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 6. SUPPORT & FAQS
  if (activeSubPage === 'support') {
    return (
      <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
        <div className="border-b-3 border-pure-black pb-4 mb-6 flex items-center gap-3">
          <button 
            onClick={() => setActiveSubPage(null)}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="font-display text-xl uppercase text-pure-black">Help & Support</h2>
        </div>

        <div className="space-y-6">
          {/* FAQs List */}
          <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-pure-black pb-2.5">
              <FileText className="w-4.5 h-4.5 text-pure-black" />
              <span className="font-display text-xs uppercase block text-pure-black">Frequently Asked Questions</span>
            </div>

            <div className="space-y-2 pt-1.5">
              {faqs.map((faq, idx) => (
                <div key={idx} className="brutal-border rounded-md overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setFaqOpenIdx(faqOpenIdx === idx ? null : idx)}
                    className="w-full p-3 text-left bg-light-gray/20 hover:bg-light-gray/40 transition-colors flex justify-between items-center text-xs font-display uppercase cursor-pointer text-pure-black"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight className={`w-4 h-4 text-pure-black transition-transform ${faqOpenIdx === idx ? 'rotate-90' : ''}`} />
                  </button>
                  {faqOpenIdx === idx && (
                    <div className="p-3 border-t border-pure-black bg-white text-[10px] font-bold leading-normal text-mid-gray uppercase">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Submit Bug Form */}
          <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-pure-black" />
              <span className="font-display text-xs uppercase block text-pure-black">Register Support Ticket</span>
            </div>

            <div className="space-y-3 pt-1.5">
              {/* Category */}
              <div className="space-y-1">
                <span className="text-[9px] font-display uppercase text-mid-gray">Ticket Category</span>
                <select
                  value={bugCategory}
                  onChange={(e) => setBugCategory(e.target.value)}
                  className="w-full bg-light-gray brutal-border text-xs px-2.5 py-2 outline-none font-bold text-pure-black cursor-pointer"
                >
                  <option value="Bug">Technical Bug / Crash</option>
                  <option value="Account">Account Access / Privacy</option>
                  <option value="Suggestion">Feature Suggestion</option>
                  <option value="Other">Other / General Inquiry</option>
                </select>
              </div>

              {/* Message */}
              <div className="space-y-1">
                <span className="text-[9px] font-display uppercase text-mid-gray">Ticket Details</span>
                <textarea
                  placeholder="Detail your issue, browser steps, or feature request in detail..."
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  className="w-full bg-light-gray brutal-border text-xs p-3 outline-none font-bold text-pure-black min-h-[95px]"
                />
              </div>

              <Button
                onClick={() => {
                  if (!bugDescription.trim()) {
                    addToast("Please fill in ticket details before submitting.", "error");
                    return;
                  }
                  addToast(`Support ticket for ${bugCategory} registered!`, "success");
                  setBugDescription('');
                  setActiveSubPage(null);
                }}
                className="text-[9px] font-display uppercase py-2.5 px-4 bg-brutal-yellow border-2 shadow-[2px_2px_0px_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                Submit Support Ticket
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --- MAIN SETTINGS OPTIONS LIST (Dashboard style!) ---

  return (
    <div className="max-w-4xl mx-auto pb-16 select-none animate-[fadeIn_0.12s_ease-out]">
      
      {/* Settings Header Block */}
      <div className="border-b-3 border-pure-black pb-4 mb-6 flex justify-between items-center">
        <div>
          <h2 className="font-display text-2xl uppercase text-pure-black">Settings tab</h2>
          <p className="text-xs font-bold text-mid-gray uppercase tracking-wider mt-1 leading-none">
            IndiVibe Space Controls & preferences
          </p>
        </div>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="p-1.5 rounded brutal-border bg-white text-pure-black hover:bg-light-gray transition-colors cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Close settings"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Profile Card Mockup style at top */}
      <Card className="p-6 bg-white border-3 shadow-[4px_4px_0px_#111] text-center mb-6 relative overflow-hidden">
        <div className="absolute top-4 right-4 flex items-center justify-center bg-brutal-yellow text-pure-black border border-pure-black font-display text-[8px] px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#111] select-none">
          PATR ID ACTIVE
        </div>

        <div className="w-20 h-20 mx-auto rounded-xl brutal-border overflow-hidden bg-white shadow-[2px_2px_0px_#111] mb-3 relative">
          <img
            src={currentUserProfile?.profilePhotoUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}
            alt="User Avatar"
            className="w-full h-full object-cover"
          />
        </div>

        <h3 className="font-display text-lg uppercase tracking-tight text-pure-black leading-tight">
          {currentUserProfile?.displayName || currentUserUsername.toUpperCase()}
        </h3>
        
        <button 
          onClick={handleCopyUsername}
          className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono font-bold text-mid-gray hover:text-pure-black transition-colors"
          title="Click to copy username"
        >
          @{currentUserUsername} <Copy className="w-3.5 h-3.5" />
        </button>

        <div className="mt-4 pt-3 border-t border-dashed border-pure-black/25 flex justify-around text-center">
          <div>
            <span className="block text-xs font-display font-bold text-pure-black">{currentUserProfile?.postsCount || 0}</span>
            <span className="block text-[8px] font-extrabold uppercase text-mid-gray">Posts</span>
          </div>
          <div>
            <span className="block text-xs font-display font-bold text-pure-black">{currentUserProfile?.followersCount || 0}</span>
            <span className="block text-[8px] font-extrabold uppercase text-mid-gray">Followers</span>
          </div>
          <div>
            <span className="block text-xs font-display font-bold text-pure-black">{currentUserProfile?.followingCount || 0}</span>
            <span className="block text-[8px] font-extrabold uppercase text-mid-gray">Following</span>
          </div>
        </div>
      </Card>

      {/* Settings Option List rows (Mockup styling!) */}
      <Card className="bg-white border-3 shadow-[4px_4px_0px_#111] overflow-hidden">
        
        {/* General Settings */}
        <button
          type="button"
          onClick={() => setActiveSubPage('general')}
          className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-pure-black hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <Settings className="w-5 h-5 text-pure-black" />
            <span className="font-display text-xs uppercase font-bold text-pure-black">General Settings</span>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

        {/* Theme Mode selector */}
        <button
          type="button"
          onClick={() => setActiveSubPage('theme')}
          className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-pure-black hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <Palette className="w-5 h-5 text-pure-black" />
            <div>
              <span className="font-display text-xs uppercase font-bold text-pure-black block">Display Theme</span>
              <span className="text-[8px] font-bold text-mid-gray uppercase block mt-0.5">Custom Colors & light/dark modes</span>
            </div>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

        {/* Push notifications */}
        <button
          type="button"
          onClick={() => setActiveSubPage('notifications')}
          className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-pure-black hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <Bell className="w-5 h-5 text-pure-black" />
            <span className="font-display text-xs uppercase font-bold text-pure-black">Push Notifications</span>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

        {/* Account Privacy */}
        <button
          type="button"
          onClick={() => setActiveSubPage('privacy')}
          className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-pure-black hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <Eye className="w-5 h-5 text-pure-black" />
            <span className="font-display text-xs uppercase font-bold text-pure-black">Account Privacy</span>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

        {/* Security & Password reset */}
        <button
          type="button"
          onClick={() => setActiveSubPage('security')}
          className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-pure-black hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <Lock className="w-5 h-5 text-pure-black" />
            <span className="font-display text-xs uppercase font-bold text-pure-black">Security & PIN code</span>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

        {/* Help & Support */}
        <button
          type="button"
          onClick={() => setActiveSubPage('support')}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-light-gray transition-colors text-left cursor-pointer active:bg-light-gray"
        >
          <div className="flex items-center gap-3.5">
            <HelpCircle className="w-5 h-5 text-pure-black" />
            <span className="font-display text-xs uppercase font-bold text-pure-black">Support Help Desk</span>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-pure-black stroke-[2.5]" />
        </button>

      </Card>

      {/* Log out button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-4 brutal-border border-error-red bg-error-red/10 text-error-red font-display text-xs uppercase font-bold hover:bg-error-red/20 transition-colors shadow-[4px_4px_0px_rgba(224,36,36,0.25)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
        >
          <LogOut className="w-4.5 h-4.5" /> Log Out Space Account
        </button>
      </div>

    </div>
  );
}
