import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/utils/api';

export interface Profile {
  id: string;
  user_id: string;
  /** Backend returns "role" field with values "rider" | "driver" */
  role: 'driver' | 'rider';
  /** Alias for role — kept for backward compat */
  user_type: 'driver' | 'rider';
  user_role?: 'driver' | 'rider';
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
      const normalized: Profile = {
        ...raw,
        role: rawRoleStr as 'driver' | 'rider',
        user_type: rawRoleStr as 'driver' | 'rider',
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
