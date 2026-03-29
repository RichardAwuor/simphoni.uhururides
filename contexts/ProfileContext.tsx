import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/utils/api';

export interface Profile {
  id: string;
  user_id: string;
  /** Backend returns "role" field with values "passenger" | "driver" */
  role: 'driver' | 'passenger';
  /** Alias for role — kept for backward compat */
  user_type: 'driver' | 'passenger';
  user_role?: 'driver' | 'passenger';
  name: string;
  email: string;
  phone?: string;
  mobile_number?: string;
  phone_number?: string;
  city?: string;
  created_at: string;
}

export interface DriverDetails {
  id: string;
  user_id: string;
  car_make: string;
  car_registration: string;
  car_color: string;
  created_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  driverDetails: DriverDetails | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverDetails, setDriverDetails] = useState<DriverDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setDriverDetails(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    console.log('[ProfileContext] Fetching profile for user:', user.id);
    try {
      const raw = await apiGet<any>('/api/profiles/me');
      console.log('[ProfileContext] Profile fetched:', raw);
      const rawRoleStr = ((raw.user_type ?? raw.role ?? raw.user_role ?? '') as string).toLowerCase().trim();
      console.log('[ProfileContext] Raw profile fields — user_type:', raw.user_type, 'role:', raw.role, 'user_role:', raw.user_role, 'normalized:', rawRoleStr);
      let finalRole = rawRoleStr;
      if (finalRole !== 'driver' && finalRole !== 'passenger') {
        const stored = await AsyncStorage.getItem('user_type');
        console.log('[ProfileContext] AsyncStorage fallback user_type:', stored);
        if (stored === 'driver' || stored === 'passenger') {
          finalRole = stored;
        }
      }
      const normalized: Profile = {
        ...raw,
        role: finalRole as 'driver' | 'passenger',
        user_type: finalRole as 'driver' | 'passenger',
      };
      setProfile(normalized);
      setDriverDetails(null);
    } catch (e) {
      console.error('[ProfileContext] Failed to fetch profile:', e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, driverDetails, profileLoading, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
