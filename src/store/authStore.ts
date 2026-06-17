import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  uid: string;
  patrId: string;
  username: string;
  displayName: string;
  bio: string;
  profilePhotoUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  createdAt: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (user: UserProfile | null, token: string | null) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      setSession: (user, token) => set({ user, token, isAuthenticated: !!user }),
      updateProfile: (profile) => set((state) => ({
        user: state.user ? { ...state.user, ...profile } : null
      })),
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'indivibe-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
