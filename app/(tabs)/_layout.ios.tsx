import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
      }}
    >
      <NativeTabs.Trigger name="(home)">
        <Icon sf="car.fill" />
        <Label>{t('rides')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf="person.fill" />
        <Label>{t('profile')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
