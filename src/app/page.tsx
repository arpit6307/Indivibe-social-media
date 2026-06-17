'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { Landing3DCanvas } from '@/components/special/Landing3DCanvas';
import { BrutalistPreloader } from '@/components/ui/BrutalistPreloader';
import { ScrollToTop } from '@/components/ui/ScrollToTop';
import { 
  LogOut, 
  CheckCircle2, 
  Compass, 
  Radio, 
  Users2, 
  MessageSquareCode, 
  ArrowRight, 
  HelpCircle,
  EyeOff,
  UserPlus,
  LogIn,
  Layers,
  Heart,
  PartyPopper,
  Radar,
  Mic,
  BrainCircuit,
  Video,
  Menu,
  X,
  Home as HomeIcon,
  Search,
  PlusCircle,
  MessageSquare,
  Bell,
  User,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ToastContainer } from '@/components/ui/Toast';

// IndiVibe Social Media Tab Components
import FeedTab from '@/components/special/FeedTab';
import SearchTab from '@/components/special/SearchTab';
import CreateTab from '@/components/special/CreateTab';
import MessagesTab from '@/components/special/MessagesTab';
import ProfileTab from '@/components/special/ProfileTab';
import SettingsTab from '@/components/special/SettingsTab';
import EditProfileTab from '@/components/special/EditProfileTab';
import NotificationsTab from '@/components/special/NotificationsTab';
import CallOverlay from '@/components/special/CallOverlay';
import SearchProfileView from '@/components/special/SearchProfileView';
import { AvatarLightboxModal } from '@/components/ui/AvatarLightboxModal';
import { socialService } from '@/lib/socialService';

const capabilities = [
  {
    badge: '3D',
    icon: Compass,
    title: '3D Sphere Feed',
    desc: 'Browse posts rendered on an interactive rotating Three.js 3D sphere. Drag to spin or switch to classic 2D list feed.',
  },
  {
    badge: 'MR',
    icon: Radio,
    title: 'Mood Rooms',
    desc: 'Host temporary audio rooms (Lo-Fi Study, Gossip, Chill, Focus) using WebRTC (100ms.live) with room chat and preset music.',
  },
  {
    badge: 'SB',
    icon: EyeOff,
    title: 'Story Blur Tech',
    desc: 'Screen Capture and Visibility API detection automatically blurs your 24-hr story if a viewer attempts to take a screenshot.',
  },
  {
    badge: 'CC',
    icon: Layers,
    title: 'Co-Create Posts',
    desc: 'Invite friends to create posts together. Live cursor synchronization via Firebase RTDB lets both editors update captions and photos.',
  },
  {
    badge: 'RD',
    icon: Radar,
    title: 'Nearby Radar',
    desc: 'Opt-in proximity feed. Discover posts made within a 1km radius anonymously without ever exposing your exact location.',
  },
  {
    badge: 'AI',
    icon: BrainCircuit,
    title: 'AI Post Lens',
    desc: 'Long-press any post to activate a Claude-powered AI overlay detailing sentiment levels, topic tags, and context summaries.',
  },
  {
    badge: 'VM',
    icon: Mic,
    title: 'Voice DM Waveform',
    desc: 'Send voice notes in chats that display animated audio waveforms (using Web Audio and Canvas APIs) upon delivery.',
  },
  {
    badge: 'RR',
    icon: Video,
    title: 'Reaction Reels',
    desc: 'Express yourself by attaching a 15-second camera video reaction directly to any post as a visible side-thumbnail.',
  },
];

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  
  // Track custom preloader state
  const [preloaderComplete, setPreloaderComplete] = useState(false);

  // Track visitor history via localStorage
  const [hasVisitedBefore, setHasVisitedBefore] = useState<boolean | null>(null);

  // Tab-based Routing state
  const [currentTab, setCurrentTab] = useState('feed');
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);

  // Key to force refresh profile details (Zustand profile syncing)
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [avatarOptionsUser, setAvatarOptionsUser] = useState<any | null>(null);
  const [zoomedAvatarUser, setZoomedAvatarUser] = useState<any | null>(null);

  // Intercept profile DP clicks globally
  const handleViewProfileClick = async (uid: string) => {
    try {
      const profile = await socialService.getUserProfile(uid);
      if (profile) {
        setAvatarOptionsUser(profile);
      } else {
        setSelectedProfileUid(uid);
        setCurrentTab(uid === user?.uid ? 'profile' : 'search-profile');
      }
    } catch (err) {
      setSelectedProfileUid(uid);
      setCurrentTab(uid === user?.uid ? 'profile' : 'search-profile');
    }
  };

  // Active calling overlay state
  const [activeCallSession, setActiveCallSession] = useState<{
    partnerProfile: any;
    type: 'audio' | 'video';
    incomingCallState?: any;
  } | null>(null);

  // Load and apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('indivibe-theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, []);

  // Sync profile details on load and refresh
  const refreshProfileData = async () => {
    if (!user?.patrId) return;
    try {
      const freshProfile = await socialService.getUserProfile(user.patrId);
      if (freshProfile) {
        setCurrentUserProfile(freshProfile);
        useAuthStore.getState().updateProfile(freshProfile);
      }
    } catch (err) {
      console.warn("Could not sync fresh profile:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshProfileData();
    }
  }, [isAuthenticated, profileRefreshKey]);

  // WebRTC Calling signaling channel listener
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;

    let activeCallListeners: { [chatId: string]: () => void } = {};

    const setupListeners = async () => {
      try {
        const chatsList = await socialService.getChats(user.uid);
        const anyUnread = chatsList.some((chat: any) => chat.unreadBy?.includes(user.uid));
        setHasUnreadMessages(anyUnread);

        chatsList.forEach(chat => {
          if (!activeCallListeners[chat.chatId]) {
            const unsub = socialService.subscribeToCall(chat.chatId, (call) => {
              // If incoming call is active and ringing, display overlay
              if (call && call.status === 'ringing' && call.receiverId === user.uid) {
                const partnerProfile = chat.partner || {
                  uid: call.callerId,
                  username: call.callerUsername,
                  displayName: call.callerUsername.toUpperCase(),
                  profilePhotoUrl: ''
                };
                setActiveCallSession({
                  partnerProfile,
                  type: call.type,
                  incomingCallState: call
                });
              }
            });
            activeCallListeners[chat.chatId] = unsub;
          }
        });
      } catch (err) {
        console.error("Call signaling subscription error:", err);
      }
    };

    setupListeners();
    const interval = setInterval(setupListeners, 5000); // Check for new chats periodically

    return () => {
      clearInterval(interval);
      Object.values(activeCallListeners).forEach(unsub => unsub());
    };
  }, [isAuthenticated, user?.uid]);

  // Mobile menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Track scroll position to hide sticky bottom banner
  const [showStickyBanner, setShowStickyBanner] = useState(true);

  // Mobile swipe deck state
  const [currentCard, setCurrentCard] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const handleNextCard = () => {
    if (exitDirection) return;
    setExitDirection('left');
    setTimeout(() => {
      setCurrentCard((prev) => (prev + 1) % capabilities.length);
      setExitDirection(null);
      setSwipeOffset(0);
    }, 250);
  };

  const handlePrevCard = () => {
    if (exitDirection) return;
    setExitDirection('right');
    setTimeout(() => {
      setCurrentCard((prev) => (prev - 1 + capabilities.length) % capabilities.length);
      setExitDirection(null);
      setSwipeOffset(0);
    }, 250);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (exitDirection) return;
    setTouchStart(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || exitDirection) return;
    const currentTouchX = e.touches[0].clientX;
    const diffX = currentTouchX - touchStart;
    setSwipeOffset(diffX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping || exitDirection) return;
    setIsSwiping(false);
    if (swipeOffset > 80) {
      setExitDirection('right');
      setTimeout(() => {
        setCurrentCard((prev) => (prev - 1 + capabilities.length) % capabilities.length);
        setExitDirection(null);
        setSwipeOffset(0);
      }, 250);
    } else if (swipeOffset < -80) {
      setExitDirection('left');
      setTimeout(() => {
        setCurrentCard((prev) => (prev + 1) % capabilities.length);
        setExitDirection(null);
        setSwipeOffset(0);
      }, 250);
    } else {
      setSwipeOffset(0);
    }
    setTouchStart(null);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setShowStickyBanner(false);
      } else {
        setShowStickyBanner(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const visited = localStorage.getItem('indivibe-visited') === 'true';
      setHasVisitedBefore(visited);
    }
  }, []);

  // Redirect logic for returning non-authenticated visitors
  useEffect(() => {
    if (!isLoading && !isAuthenticated && hasVisitedBefore === true && preloaderComplete) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, hasVisitedBefore, router, preloaderComplete]);

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully.', 'info');
    router.push('/login');
  };

  // Click handler for entering the app
  const enterApp = (targetPath: '/signup' | '/login') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('indivibe-visited', 'true');
    }
    if (targetPath === '/signup') {
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        const loginPath = origin + '/login';
        const params = `redirect_uri=${encodeURIComponent(loginPath)}&return_to=${encodeURIComponent(loginPath)}&redirect=${encodeURIComponent(loginPath)}&callbackUrl=${encodeURIComponent(loginPath)}&next=${encodeURIComponent(loginPath)}&continue=${encodeURIComponent(loginPath)}`;
        const redirectUrl = `https://patr-india-ka-apna-mail.vercel.app/register?${params}`;
        window.location.href = redirectUrl;
      }
    } else {
      router.push(targetPath);
    }
  };

  // CASE 1: Render the Custom Brutalist Preloader first
  if (!preloaderComplete) {
    return <BrutalistPreloader onComplete={() => setPreloaderComplete(true)} />;
  }

  // Show a brief intermediate loader if auth state or localStorage isn't resolved yet
  if (isLoading || hasVisitedBefore === null) {
    return (
      <div className="min-h-screen w-full bg-off-white flex flex-col items-center justify-center py-12 px-4 relative">
        <Card className="max-w-xs w-full text-center bg-brutal-yellow">
          <div className="animate-spin inline-block w-8 h-8 border-[4px] border-current border-t-transparent text-pure-black rounded-full mb-3" role="status" />
          <p className="font-display text-lg uppercase tracking-tight">Syncing...</p>
        </Card>
      </div>
    );
  }

  // CASE 2: USER IS AUTHENTICATED -> SHOW APP DASHBOARD (Phase 1 Home view)
  if (isAuthenticated) {
    const activeUser = user!;
    return (
      <div className="min-h-screen w-full bg-off-white relative select-none">
        {/* Brutalist backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.02] pointer-events-none" />

        {/* 1. Desktop sidebar (hidden on mobile) */}
        <aside className={`hidden md:flex flex-col border-r-4 border-pure-black h-screen fixed top-0 left-0 bg-[#FAFAF8] p-5 justify-between z-30 shadow-[3px_0px_0px_#111] transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className="space-y-6 relative">
            {/* Collapse/Expand toggle button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute top-2 -right-8 w-7 h-7 rounded-full bg-white hover:bg-brutal-yellow border-2 border-pure-black shadow-[2px_2px_0px_#111] flex items-center justify-center cursor-pointer z-50 transition-all hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_#111] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none"
              aria-label={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4 text-pure-black stroke-[2.5]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-pure-black stroke-[2.5]" />
              )}
            </button>

            {/* Extreme Neo-Brutalist brand box */}
            {sidebarOpen ? (
              <div 
                className="flex flex-col p-4 bg-brutal-yellow border-3 border-pure-black shadow-[4px_4px_0px_#111] -rotate-2 cursor-pointer transition-transform hover:rotate-0 mt-2 rounded-lg"
                onClick={() => { setCurrentTab('feed'); setSelectedProfileUid(null); }}
              >
                <span className="font-display text-2xl font-black uppercase tracking-tight text-pure-black leading-none">IndiVibe</span>
                <span className="text-[8px] font-mono uppercase font-black text-pure-black/85 mt-1">India's Own Space</span>
              </div>
            ) : (
              <div 
                className="flex items-center justify-center p-2 bg-brutal-yellow border-3 border-pure-black shadow-[2px_2px_0px_#111] rotate-3 cursor-pointer transition-transform hover:rotate-0 mt-2 rounded-lg w-10 h-10 mx-auto"
                onClick={() => { setCurrentTab('feed'); setSelectedProfileUid(null); }}
                title="IndiVibe"
              >
                <span className="font-display text-lg font-black uppercase tracking-tight text-pure-black leading-none">IV</span>
              </div>
            )}
            
            <nav className={`flex flex-col gap-3.5 font-display text-xs uppercase pt-6 ${sidebarOpen ? '' : 'items-center'}`}>
              <button 
                onClick={() => { setCurrentTab('feed'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'feed' 
                    ? 'bg-brutal-yellow text-pure-black shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] -rotate-1' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-brutal-yellow/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "Home Feed"}
              >
                <HomeIcon className="w-4.5 h-4.5 shrink-0" />
                {sidebarOpen && <span>Home Feed</span>}
              </button>
              
              <button 
                onClick={() => { setCurrentTab('search'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'search' || currentTab === 'search-profile' 
                    ? 'bg-[#00FFCC] text-pure-black shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] rotate-1.5' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-[#00FFCC]/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "Explore Spaces"}
              >
                <Search className="w-4.5 h-4.5 shrink-0" />
                {sidebarOpen && <span>Explore Spaces</span>}
              </button>
              
              <button 
                onClick={() => { setCurrentTab('create'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'create' 
                    ? 'bg-[#FF3366] text-white shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] -rotate-1.5' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-[#FF3366]/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "Creation Studio"}
              >
                <PlusCircle className="w-4.5 h-4.5 shrink-0" />
                {sidebarOpen && <span>Creation Studio</span>}
              </button>
              
              <button 
                onClick={() => { setCurrentTab('messages'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'messages' 
                    ? 'bg-[#FFCC00] text-pure-black shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] rotate-1' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-[#FFCC00]/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "Messages"}
              >
                <div className="relative shrink-0">
                  <MessageSquare className="w-4.5 h-4.5" />
                  {hasUnreadMessages && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2A85] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF2A85] border border-white"></span>
                    </span>
                  )}
                </div>
                {sidebarOpen && <span>Messages</span>}
                {sidebarOpen && hasUnreadMessages && (
                  <span className="ml-auto w-2.5 h-2.5 bg-error-red rounded-full animate-pulse" />
                )}
                {!sidebarOpen && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2A85] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF2A85] border border-white"></span>
                  </span>
                )}
              </button>
              
              <button 
                onClick={() => { setCurrentTab('notifications'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'notifications' 
                    ? 'bg-[#FF00FF] text-white shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] -rotate-2' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-[#FF00FF]/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "Activity Logs"}
              >
                <Bell className="w-4.5 h-4.5 shrink-0" />
                {sidebarOpen && <span>Activity Logs</span>}
              </button>
              
              <button 
                onClick={() => { setCurrentTab('profile'); setSelectedProfileUid(null); }} 
                className={`flex items-center border-3 border-pure-black font-extrabold transition-all duration-75 cursor-pointer rounded-lg relative active:translate-x-0 active:translate-y-0 active:shadow-none ${
                  sidebarOpen 
                    ? 'gap-3 p-3 text-left w-full' 
                    : 'justify-center p-3 w-11 h-11'
                } ${
                  currentTab === 'profile' 
                    ? 'bg-[#3366FF] text-white shadow-[4px_4px_0px_#111] -translate-x-[2px] -translate-y-[2px] rotate-2' 
                    : 'bg-white text-pure-black shadow-[2px_2px_0px_#111] hover:bg-[#3366FF]/15 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#111]'
                }`}
                title={sidebarOpen ? undefined : "My Profile"}
              >
                <User className="w-4.5 h-4.5 shrink-0" />
                {sidebarOpen && <span>My Profile</span>}
              </button>
            </nav>
          </div>

          <button 
            onClick={handleLogout} 
            className={`flex items-center border-3 border-pure-black bg-white hover:bg-error-red hover:text-white text-error-red hover:shadow-[4px_4px_0px_#111] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all duration-75 font-display text-xs uppercase cursor-pointer font-black rounded-lg shadow-[2px_2px_0px_#111] active:translate-x-0 active:translate-y-0 active:shadow-none ${
              sidebarOpen 
                ? 'gap-3 p-3 text-left w-full' 
                : 'justify-center p-3 w-11 h-11 mx-auto'
            }`}
            title={sidebarOpen ? undefined : "Exit App"}
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            {sidebarOpen && <span>Exit App</span>}
          </button>
        </aside>

        {/* 2. Mobile Top Bar (hidden on desktop) */}
        <header className="md:hidden h-16 border-b-4 border-pure-black fixed top-0 left-0 right-0 bg-[#FAFAF8] px-4 flex justify-between items-center z-30 shadow-[0_3px_0px_#111]">
          <div 
            className="font-display text-base font-black uppercase tracking-tight bg-brutal-yellow border-2.5 border-pure-black px-3 py-1 shadow-[2px_2px_0px_#111] -rotate-2 cursor-pointer transition-transform active:rotate-0 rounded"
            onClick={() => { setCurrentTab('feed'); setSelectedProfileUid(null); }}
          >
            IndiVibe
          </div>
          {currentTab === 'profile' ? (
            <button 
              onClick={() => { setCurrentTab('settings'); }}
              className="p-2.5 rounded-md border-2.5 border-pure-black bg-brutal-yellow text-pure-black shadow-[2.5px_2.5px_0px_#111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              aria-label="Settings Menu"
            >
              <Menu className="w-5 h-5 stroke-[2.5]" />
            </button>
          ) : (
            <button 
              onClick={() => { setCurrentTab('notifications'); setSelectedProfileUid(null); }}
              className={`p-2.5 rounded-md border-2.5 border-pure-black text-pure-black shadow-[2.5px_2.5px_0px_#111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer relative ${
                currentTab === 'notifications' ? 'bg-brutal-yellow' : 'bg-white'
              }`}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* 3. Mobile Bottom Navigation Bar (hidden on desktop) */}
        <nav className="md:hidden h-20 border-t-4 border-pure-black fixed bottom-0 left-0 right-0 bg-[#FAFAF8] flex justify-around items-center z-40 shadow-[0_-3px_0px_#111] px-2">
          <button 
            onClick={() => { setCurrentTab('feed'); setSelectedProfileUid(null); }}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-3 border-pure-black transition-all duration-150 cursor-pointer ${
              currentTab === 'feed' 
                ? 'bg-brutal-yellow shadow-[2.5px_2.5px_0px_#111] -translate-x-[1.5px] -translate-y-[1.5px] rotate-[-4deg]' 
                : 'bg-white hover:bg-light-gray active:translate-y-0.5'
            }`}
            aria-label="Feed"
          >
            <HomeIcon className="w-5.5 h-5.5 text-pure-black" />
          </button>
          
          <button 
            onClick={() => { setCurrentTab('search'); setSelectedProfileUid(null); }}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-3 border-pure-black transition-all duration-150 cursor-pointer ${
              currentTab === 'search' || currentTab === 'search-profile' 
                ? 'bg-brutal-yellow shadow-[2.5px_2.5px_0px_#111] -translate-x-[1.5px] -translate-y-[1.5px] rotate-[3deg]' 
                : 'bg-white hover:bg-light-gray active:translate-y-0.5'
            }`}
            aria-label="Search"
          >
            <Search className="w-5.5 h-5.5 text-pure-black" />
          </button>
          
          <button 
            onClick={() => { setCurrentTab('create'); setSelectedProfileUid(null); }}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-3 border-pure-black transition-all duration-150 cursor-pointer ${
              currentTab === 'create' 
                ? 'bg-brutal-yellow shadow-[2.5px_2.5px_0px_#111] -translate-x-[1.5px] -translate-y-[1.5px] rotate-[-2deg]' 
                : 'bg-white hover:bg-light-gray active:translate-y-0.5'
            }`}
            aria-label="Create Post"
          >
            <PlusCircle className="w-5.5 h-5.5 text-pure-black" />
          </button>
          
          <button 
            onClick={() => { setCurrentTab('messages'); setSelectedProfileUid(null); }}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-3 border-pure-black transition-all duration-150 cursor-pointer relative ${
              currentTab === 'messages' 
                ? 'bg-brutal-yellow shadow-[2.5px_2.5px_0px_#111] -translate-x-[1.5px] -translate-y-[1.5px] rotate-[4deg]' 
                : 'bg-white hover:bg-light-gray active:translate-y-0.5'
            }`}
            aria-label="Direct Messages"
          >
            <MessageSquare className="w-5.5 h-5.5 text-pure-black" />
            {hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#FF2A85] rounded-full border-2 border-pure-black flex items-center justify-center animate-pulse shadow-[1px_1px_0px_#111]">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
              </span>
            )}
          </button>
          
          <button 
            onClick={() => { setCurrentTab('profile'); setSelectedProfileUid(null); }}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-3 border-pure-black transition-all duration-150 cursor-pointer ${
              currentTab === 'profile' 
                ? 'bg-brutal-yellow shadow-[2.5px_2.5px_0px_#111] -translate-x-[1.5px] -translate-y-[1.5px] rotate-[-3deg]' 
                : 'bg-white hover:bg-light-gray active:translate-y-0.5'
            }`}
            aria-label="My Profile"
          >
            <User className="w-5.5 h-5.5 text-pure-black" />
          </button>
        </nav>

        {/* 4. Main Tab View Router Container */}
        <main className={`min-h-screen bg-off-white pt-24 pb-28 md:pt-8 md:pb-8 px-4 sm:px-6 md:px-8 transition-all duration-300 ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'}`}>
          <div className="max-w-6xl mx-auto">
            {currentTab === 'feed' && (
              <FeedTab
                currentUserId={activeUser.uid}
                currentUserUsername={activeUser.username}
                currentUserProfile={currentUserProfile || activeUser}
                onViewProfile={handleViewProfileClick}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'search' && (
              <SearchTab
                currentUserId={activeUser.uid}
                currentUserUsername={activeUser.username}
                onViewProfile={handleViewProfileClick}
                onRefreshProfile={() => setProfileRefreshKey(prev => prev + 1)}
              />
            )}

            {currentTab === 'search-profile' && selectedProfileUid && (
              <SearchProfileView
                currentUserId={activeUser.uid}
                currentUserUsername={activeUser.username}
                targetUserId={selectedProfileUid}
                onBack={() => {
                  setSelectedProfileUid(null);
                  setCurrentTab('search');
                }}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                onRefreshProfile={() => setProfileRefreshKey(prev => prev + 1)}
                onViewProfile={handleViewProfileClick}
              />
            )}

            {currentTab === 'create' && (
              <CreateTab
                currentUserId={activeUser.uid}
                currentUserUsername={activeUser.username}
                currentUserProfile={currentUserProfile || activeUser}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'messages' && (
              <MessagesTab
                currentUserId={activeUser.uid}
                currentUserUsername={activeUser.username}
                onViewProfile={handleViewProfileClick}
                onInitiateCall={(partnerProfile, type) => {
                  setActiveCallSession({
                    partnerProfile,
                    type
                  });
                }}
              />
            )}

            {currentTab === 'notifications' && (
              <NotificationsTab
                currentUserId={activeUser.uid}
                onViewProfile={handleViewProfileClick}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileTab
                currentUserId={activeUser.uid}
                currentUserProfile={currentUserProfile || activeUser}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                onViewProfile={handleViewProfileClick}
                onRefreshProfile={() => setProfileRefreshKey(prev => prev + 1)}
              />
            )}

            {currentTab === 'edit-profile' && (
              <EditProfileTab
                currentUserId={activeUser.uid}
                currentUserProfile={currentUserProfile || activeUser}
                onRefreshProfile={() => setProfileRefreshKey(prev => prev + 1)}
                onCancel={() => setCurrentTab('profile')}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsTab
                currentUserId={activeUser.uid}
                currentUserProfile={currentUserProfile || activeUser}
                onRefreshProfile={() => setProfileRefreshKey(prev => prev + 1)}
                onLogout={handleLogout}
                onCancel={() => setCurrentTab('profile')}
              />
            )}
          </div>
        </main>

        {/* 5. Live Audio/Video Calling WebRTC Overlay Portal */}
        {activeCallSession && (
          <CallOverlay
            chatId={activeCallSession.incomingCallState?.chatId || 'mock-chat-id'}
            currentUserId={activeUser.uid}
            currentUserUsername={activeUser.username}
            partnerProfile={activeCallSession.partnerProfile}
            incomingCallState={activeCallSession.incomingCallState}
            onClose={() => setActiveCallSession(null)}
          />
        )}

        {/* 6. Avatar Options Choices Modal */}
        {avatarOptionsUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pure-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
            <Card className="w-full max-w-xs bg-white border-4 border-pure-black shadow-[6px_6px_0px_#111] p-6 text-center space-y-4">
              <div className="flex flex-col items-center space-y-2 pb-2 border-b-2 border-pure-black">
                <div className="w-16 h-16 rounded-full border-3 border-pure-black overflow-hidden bg-white shadow-[2px_2px_0px_#111]">
                  <img 
                    src={avatarOptionsUser.profilePhotoUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarOptionsUser.uid}`} 
                    alt="Avatar Options" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-display text-sm uppercase text-pure-black leading-tight">
                    {avatarOptionsUser.displayName}
                  </h4>
                  <p className="text-[9px] font-mono text-mid-gray uppercase">
                    @{avatarOptionsUser.username}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 pt-1">
                <Button 
                  variant="primary" 
                  className="w-full py-2.5 text-xs font-display uppercase tracking-wider"
                  onClick={() => {
                    setSelectedProfileUid(avatarOptionsUser.uid);
                    setCurrentTab(avatarOptionsUser.uid === user?.uid ? 'profile' : 'search-profile');
                    setAvatarOptionsUser(null);
                  }}
                >
                  View Space Profile
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full py-2.5 text-xs font-display uppercase tracking-wider border-pure-black bg-white hover:bg-brutal-yellow"
                  onClick={() => {
                    setZoomedAvatarUser(avatarOptionsUser);
                    setAvatarOptionsUser(null);
                  }}
                >
                  View Profile Photo
                </Button>
                <button 
                  onClick={() => setAvatarOptionsUser(null)}
                  className="w-full py-2 text-[10px] font-display uppercase tracking-wider text-mid-gray hover:text-error-red hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* 7. Avatar Fullscreen Lightbox Modal */}
        {zoomedAvatarUser && (
          <AvatarLightboxModal
            userProfile={zoomedAvatarUser}
            onClose={() => setZoomedAvatarUser(null)}
            onViewProfile={() => {
              setSelectedProfileUid(zoomedAvatarUser.uid);
              setCurrentTab(zoomedAvatarUser.uid === user?.uid ? 'profile' : 'search-profile');
              setZoomedAvatarUser(null);
            }}
          />
        )}

        <ToastContainer />
      </div>
    );
  }

  // CASE 3: FIRST TIME VISITOR -> RENDER THE 3D INTERACTIVE LANDING PAGE
  return (
    <div className="min-h-screen w-full bg-off-white text-pure-black relative overflow-x-hidden pt-[80px]">
      {/* Brutalist Grid Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.05] pointer-events-none" />

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-off-white/95 border-b-3 border-pure-black px-4 sm:px-6 py-4 flex justify-between items-center select-none backdrop-blur-md">
        <div className="flex flex-col">
          <span className="font-display text-2xl uppercase tracking-tight -rotate-1">IndiVibe</span>
          <span className="text-[9px] font-extrabold uppercase bg-brutal-yellow text-pure-black border border-pure-black px-1.5 py-0.5 rounded mt-0.5">India's Own Space</span>
        </div>
        
        {/* Desktop Buttons */}
        <div className="hidden md:flex gap-3">
          <Button variant="secondary" className="py-1.5 px-3 text-xs shadow-none border-pure-black active:translate-y-0" onClick={() => enterApp('/login')}>
            <LogIn className="w-3.5 h-3.5 mr-1" /> Log In
          </Button>
          <Button variant="primary" className="py-1.5 px-3 text-xs shadow-none active:translate-y-0" onClick={() => enterApp('/signup')}>
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Sign Up
          </Button>
        </div>

        {/* Mobile Hamburger menu Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden brutal-border bg-brutal-yellow text-pure-black p-2 rounded-md brutal-shadow-btn active:translate-x-0 active:translate-y-0 active:shadow-none hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_#111111] cursor-pointer focus:outline-none"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="w-6 h-6 stroke-[2.5]" />
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-4 z-50 bg-off-white/95 backdrop-blur-md flex flex-col p-6 border-4 border-pure-black shadow-[8px_8px_0px_#111] rounded-2xl animate-[fadeIn_0.2s_ease-out] select-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.04] pointer-events-none rounded-2xl" />
          
          {/* Drawer Header */}
          <div className="flex justify-between items-center border-b-3 border-pure-black pb-4 z-10">
            <div className="flex flex-col">
              <span className="font-display text-2xl uppercase tracking-tight -rotate-1">IndiVibe</span>
              <span className="text-[9px] font-extrabold uppercase bg-brutal-yellow text-pure-black border border-pure-black px-1.5 py-0.5 rounded mt-0.5 w-fit shadow-[1px_1px_0px_#111]">India's Own Space</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="brutal-border bg-error-red text-white p-2 rounded-md brutal-shadow-btn active:translate-x-0 active:translate-y-0 active:shadow-none cursor-pointer focus:outline-none hover:bg-error-red/90"
              aria-label="Close mobile menu"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Drawer Links */}
          <div className="flex-1 flex flex-col justify-center gap-6 z-10">
            <Card 
              hoverable 
              className="bg-brutal-yellow text-center py-6 border-3 cursor-pointer select-none shadow-[4px_4px_0px_#111] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] transition-all" 
              onClick={() => { setMobileMenuOpen(false); enterApp('/signup'); }}
            >
              <span className="font-display text-2xl uppercase tracking-wider flex items-center justify-center gap-3">
                Claim Patr ID <UserPlus className="w-7 h-7" />
              </span>
            </Card>
            
            <Card 
              hoverable 
              className="bg-white text-center py-6 border-3 cursor-pointer select-none shadow-[4px_4px_0px_#111] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111] transition-all" 
              onClick={() => { setMobileMenuOpen(false); enterApp('/login'); }}
            >
              <span className="font-display text-2xl uppercase tracking-wider flex items-center justify-center gap-3">
                Log In <LogIn className="w-7 h-7" />
              </span>
            </Card>

            <nav className="flex flex-col items-center gap-5 mt-8 border-t-2 border-pure-black border-dashed pt-6">
              <a
                href="#capabilities"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  const el = document.getElementById('features');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="font-display text-lg uppercase flex items-center gap-2 hover:translate-x-1 hover:text-brutal-yellow transition-all text-pure-black"
              >
                <Layers className="w-5 h-5" /> Capabilities
              </a>
              <a
                href="#guide"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  const el = document.getElementById('guide');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="font-display text-lg uppercase flex items-center gap-2 hover:translate-x-1 hover:text-brutal-yellow transition-all text-pure-black"
              >
                <HelpCircle className="w-5 h-5" /> Onboarding Guide
              </a>
            </nav>
          </div>

          {/* Footer in Drawer */}
          <div className="border-t-3 border-pure-black pt-4 flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-mid-gray z-10">
            <span>IndiVibe v1.0.0</span>
            <div className="w-5 h-3.5 border border-pure-black flex flex-col shrink-0 overflow-hidden shadow-[1px_1px_0px_#111]">
              <div className="h-1/3 bg-[#FF9933]"></div>
              <div className="h-1/3 bg-white flex items-center justify-center relative">
                <div className="w-1 h-1 rounded-full bg-[#000080]"></div>
              </div>
              <div className="h-1/3 bg-[#128807]"></div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
        {/* Left Side Info */}
        <div className="md:col-span-7 space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 bg-pure-black text-brutal-yellow text-xs font-display px-3 py-1 uppercase tracking-wider rotate-[-2deg] brutal-shadow-btn brutal-border border-brutal-yellow">
            Patr Ecosystem Identity
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl uppercase leading-[0.95] tracking-tight">
            CONNECT IN <br className="hidden md:inline" />
            <span className="bg-brutal-yellow brutal-border px-3 py-1 inline-block rotate-1 my-1">3D INTERACTIVE</span> <br />
            SPACES
          </h1>
          <p className="text-base md:text-lg font-bold text-mid-gray leading-normal max-w-xl">
            Say goodbye to boring traditional social grids. IndiVibe is India's own Brutalist, Three.js 3D social platform. Access the entire network directly using your secure @patr.in email ID—no separate accounts or phone numbers required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
            <Button variant="primary" className="py-3 px-8 text-base brutal-shadow-card hover:shadow-[7px_7px_0px_#111111]" onClick={() => enterApp('/signup')}>
              Enter IndiVibe <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="secondary" className="py-3 px-8 text-base hover:bg-light-gray" onClick={() => enterApp('/login')}>
              Claimed Patr ID? Log In <LogIn className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Right Side 3D Interactive Model */}
        <div className="md:col-span-5 flex justify-center items-center">
          <Card className="w-full max-w-md h-[280px] sm:h-[320px] md:h-[400px] p-2 relative bg-white overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing hover:rotate-1 transition-transform">
            <div className="absolute top-3 left-3 bg-pure-black text-white text-[10px] font-display py-0.5 px-2 brutal-border border-white uppercase z-10 shadow-[2px_2px_0px_#FFE834]">
              Drag to Rotate / Scroll to Zoom
            </div>
            <Landing3DCanvas />
          </Card>
        </div>
      </section>

      {/* Feature Section (Scroll Trigger Base Layout) */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-12 scroll-mt-20">
        <div className="border-y-3 border-pure-black py-8 mb-12 text-center md:text-left">
          <h2 className="font-display text-3xl md:text-5xl uppercase">
            Exclusive Capabilities
          </h2>
          <p className="text-sm font-bold text-mid-gray uppercase tracking-wider mt-1">
            Explore IndiVibe's unique features, built from scratch with free open stack tools
          </p>
        </div>

        {/* Desktop Layout - 4 Column Grid */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {capabilities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card key={idx} hoverable className="space-y-3 bg-[#FAFAF8] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-brutal-yellow brutal-border border-r-0 border-t-0 flex items-center justify-center font-display text-sm select-none">
                  {item.badge}
                </div>
                <Icon className="w-8 h-8 text-pure-black mt-2" />
                <h3 className="font-display text-lg uppercase">{item.title}</h3>
                <p className="text-xs font-bold text-mid-gray leading-normal">
                  {item.desc}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Mobile Layout - Custom Stacked Flick/Swipe Deck */}
        <div className="block md:hidden select-none">
          <div className="text-center mb-6">
            <span className="inline-block text-[10px] font-extrabold uppercase bg-brutal-yellow text-pure-black border border-pure-black px-2.5 py-0.5 rounded tracking-wide mb-1 animate-pulse">
              Swipe left/right or tap arrows to flick
            </span>
          </div>

          <div className="relative w-full max-w-[310px] sm:max-w-[340px] mx-auto h-[290px]">
            {/* Card 3 (Back of stack) */}
            {(() => {
              const idx3 = (currentCard + 2) % capabilities.length;
              const item3 = capabilities[idx3];
              const Icon3 = item3.icon;
              return (
                <Card className="absolute inset-0 z-10 space-y-3 bg-[#FAFAF8] brutal-border shadow-[4px_4px_0px_#111111] translate-x-4 translate-y-4 scale-[0.92] opacity-40 pointer-events-none transition-all duration-300">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-brutal-yellow brutal-border border-r-0 border-t-0 flex items-center justify-center font-display text-sm select-none">
                    {item3.badge}
                  </div>
                  <Icon3 className="w-8 h-8 text-pure-black mt-2" />
                  <h3 className="font-display text-lg uppercase">{item3.title}</h3>
                  <p className="text-xs font-bold text-mid-gray leading-normal line-clamp-4">
                    {item3.desc}
                  </p>
                </Card>
              );
            })()}

            {/* Card 2 (Middle of stack) */}
            {(() => {
              const idx2 = (currentCard + 1) % capabilities.length;
              const item2 = capabilities[idx2];
              const Icon2 = item2.icon;
              return (
                <Card className="absolute inset-0 z-20 space-y-3 bg-[#FAFAF8] brutal-border shadow-[4px_4px_0px_#111111] translate-x-2 translate-y-2 scale-[0.96] opacity-80 pointer-events-none transition-all duration-300">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-brutal-yellow brutal-border border-r-0 border-t-0 flex items-center justify-center font-display text-sm select-none">
                    {item2.badge}
                  </div>
                  <Icon2 className="w-8 h-8 text-pure-black mt-2" />
                  <h3 className="font-display text-lg uppercase">{item2.title}</h3>
                  <p className="text-xs font-bold text-mid-gray leading-normal line-clamp-4">
                    {item2.desc}
                  </p>
                </Card>
              );
            })()}

            {/* Card 1 (Front of stack - Interactive) */}
            {(() => {
              const idx1 = currentCard;
              const item1 = capabilities[idx1];
              const Icon1 = item1.icon;
              const frontTransform = exitDirection === 'left'
                ? 'translate-x-[-120%] rotate-[-15deg] opacity-0 transition-all duration-250 ease-out'
                : exitDirection === 'right'
                ? 'translate-x-[120%] rotate-[15deg] opacity-0 transition-all duration-250 ease-out'
                : isSwiping
                ? '' // inline style applies
                : 'translate-x-0 rotate-0 scale-100 transition-all duration-200 ease-out';

              const frontStyle = isSwiping
                ? { transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg) scale(1.02)` }
                : {};

              return (
                <div
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={frontStyle}
                  className={`absolute inset-0 z-30 ${frontTransform}`}
                >
                  <Card className="w-full h-full space-y-3 bg-white brutal-border shadow-[4px_4px_0px_#111111] cursor-grab active:cursor-grabbing relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-brutal-yellow brutal-border border-r-0 border-t-0 flex items-center justify-center font-display text-sm select-none">
                        {item1.badge}
                      </div>
                      <Icon1 className="w-8 h-8 text-pure-black mt-2" />
                      <h3 className="font-display text-lg uppercase">{item1.title}</h3>
                      <p className="text-xs font-bold text-mid-gray leading-normal">
                        {item1.desc}
                      </p>
                    </div>
                    
                    {/* Tiny swipe hint inside card */}
                    <div className="w-full text-right text-[9px] font-bold text-mid-gray uppercase tracking-wider select-none pt-2 border-t border-light-gray">
                      &larr; Drag left or right &rarr;
                    </div>
                  </Card>
                </div>
              );
            })()}
          </div>

          {/* Indicator bars */}
          <div className="flex justify-center items-center gap-1.5 mt-8 select-none">
            {capabilities.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentCard(idx)}
                className={`h-3.5 brutal-border transition-all duration-300 cursor-pointer ${
                  currentCard === idx ? 'w-8 bg-brutal-yellow' : 'w-3.5 bg-white'
                }`}
                aria-label={`Go to feature ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons and index fractional number */}
          <div className="flex justify-between items-center mt-6 px-4 w-full max-w-[310px] sm:max-w-[340px] mx-auto">
            <Button
              variant="secondary"
              className="py-1.5 px-3.5 text-xs border-pure-black shadow-none active:translate-y-0 select-none uppercase font-display"
              onClick={handlePrevCard}
            >
              &larr; Prev
            </Button>
            <span className="font-display text-sm tracking-widest font-extrabold bg-light-gray brutal-border py-1 px-3">
              {String(currentCard + 1).padStart(2, '0')} / {String(capabilities.length).padStart(2, '0')}
            </span>
            <Button
              variant="primary"
              className="py-1.5 px-3.5 text-xs shadow-none active:translate-y-0 select-none uppercase font-display"
              onClick={handleNextCard}
            >
              Next &rarr;
            </Button>
          </div>
        </div>
      </section>

      {/* Guide Section: Account Creation and Usage */}
      <section id="guide" className="max-w-4xl mx-auto px-6 py-12 scroll-mt-20">
        <Card className="bg-pure-black text-white p-4 sm:p-8 brutal-shadow-card">
          <div className="flex items-center gap-2 mb-6 border-b border-white/20 pb-4">
            <HelpCircle className="w-6 h-6 text-brutal-yellow" />
            <h2 className="font-display text-2xl uppercase tracking-tight">
              Getting Started Guide
            </h2>
          </div>

          <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2.5px] before:bg-brutal-yellow/30">
            {/* Step 1 */}
            <div className="flex gap-6 relative">
              <div className="w-8 h-8 rounded-full brutal-border bg-brutal-yellow text-pure-black font-display flex items-center justify-center text-sm shrink-0 z-10 shadow-[2px_2px_0px_#fff]">
                1
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base uppercase text-brutal-yellow">Claim your Patr ID handle</h3>
                <p className="text-xs font-bold text-white/80 leading-normal">
                  Type your desired username on the signup screen. This ID functions as your secure `@patr.in` email and unified IndiVibe social identity.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6 relative">
              <div className="w-8 h-8 rounded-full brutal-border bg-brutal-yellow text-pure-black font-display flex items-center justify-center text-sm shrink-0 z-10 shadow-[2px_2px_0px_#fff]">
                2
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base uppercase text-brutal-yellow">Verify the email OTP</h3>
                <p className="text-xs font-bold text-white/80 leading-normal">
                  Check your `@patr.in` email account. Enter the 6-digit numeric verification code within 10 minutes to verify ownership of the handle.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6 relative">
              <div className="w-8 h-8 rounded-full brutal-border bg-brutal-yellow text-pure-black font-display flex items-center justify-center text-sm shrink-0 z-10 shadow-[2px_2px_0px_#fff]">
                3
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base uppercase text-brutal-yellow">Configure Profile & Password</h3>
                <p className="text-xs font-bold text-white/80 leading-normal">
                  Choose a secure login password, fill in your public display name and bio details, and upload your custom photo or pick a preset character avatar.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-6 relative">
              <div className="w-8 h-8 rounded-full brutal-border bg-brutal-yellow text-pure-black font-display flex items-center justify-center text-sm shrink-0 z-10 shadow-[2px_2px_0px_#fff]">
                4
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base uppercase text-brutal-yellow">Explore & Interact</h3>
                <p className="text-xs font-bold text-white/80 leading-normal">
                  You are all set! Toggle between 2D lists and the 3D Sphere Feed, spin posts, chat in real-time, record Voice notes, or start group audio calls!
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              Ready to claim your handle?
            </span>
            <Button variant="primary" className="py-2.5 px-6 text-sm flex items-center gap-2 border-white" onClick={() => enterApp('/signup')}>
              Claim Patr ID Now <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="w-full bg-pure-black text-white border-t-3 border-pure-black py-10 px-6 mt-20 pb-28 md:pb-10 select-none">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-white/60 font-display text-[10px] tracking-widest text-center md:text-left">
            &copy; {new Date().getFullYear()} INDIVIBE. ALL RIGHTS RESERVED.
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2 bg-brutal-yellow text-pure-black px-4 py-2 rounded brutal-border shadow-[3px_3px_0px_#ffffff] text-[10px] font-extrabold tracking-wider">
            <span>POWERED BY PATR</span>
            <span className="opacity-40">&bull;</span>
            <span className="flex items-center gap-1">
              DEVELOPED WITH <Heart className="w-3.5 h-3.5 text-error-red fill-current inline-block animate-pulse" /> BY ARPIT SINGH YADAV
            </span>
          </div>
        </div>
      </footer>

      {/* Sticky Banner CTA */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md brutal-border bg-brutal-yellow text-pure-black py-3 px-5 rounded-lg shadow-[5px_5px_0px_#111111] flex items-center justify-between gap-4 select-none transition-all duration-300 ${
        showStickyBanner ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'
      }`}>
        <div className="flex flex-col">
          <span className="font-display text-sm uppercase">India's 3D Social Space</span>
          <span className="text-[10px] font-bold opacity-80 uppercase leading-none">Claim your @patr.in handle free!</span>
        </div>
        <Button variant="secondary" className="py-1.5 px-3.5 text-xs border-pure-black shadow-none active:translate-y-0" onClick={() => enterApp('/signup')}>
          Join Now
        </Button>
      </div>

      {/* Scroll-To-Top and Toast Notification container */}
      <ScrollToTop />
      <ToastContainer />
    </div>
  );
}
