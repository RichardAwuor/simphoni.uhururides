import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';
import { useProfile } from '@/contexts/ProfileContext';

export default function TabLayout() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const isDriver = ['role', 'user_type', 'user_role'].some(
    key => typeof (profile as any)?.[key] === 'string' && (profile as any)[key].toLowerCase().includes('driver')
  );
  const homeLabel = isDriver ? 'Drive' : t('rides');

  return (
    <NativeTabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
      }}
    >
      <NativeTabs.Trigger name="(home)">
        <Icon sf="car.fill" />
        <Label>{homeLabel}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf="person.fill" />
        <Label>{t('profile')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
