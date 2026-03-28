import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/utils/api';

export interface Profile {
  id: string;
  user_id: string;
  user_type: 'driver' | 'rider';
  first_name: string;
  last_name: string;
  resident_district: string;
  country: string;
  language: string;
  mobile_number?: string;
  profile_picture_url?: string;
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
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setDriverDetails(null);
      return;
    }
    setProfileLoading(true);
    try {
      const data = await apiGet<Profile>('/api/profiles/me');
      setProfile(data);
      if (data.user_type === 'driver') {
        try {
          const dd = await apiGet<DriverDetails>('/api/driver/details');
          setDriverDetails(dd);
        } catch {
          setDriverDetails(null);
        }
      }
    } catch {
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
