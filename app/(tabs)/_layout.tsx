import React from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { Stack } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';

export default function TabLayout() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const tabs = [
    {
      name: '(home)',
      route: '/(tabs)/(home)' as const,
      icon: 'directions-car' as const,
      label: t('rides'),
    },
    {
      name: 'profile',
      route: '/(tabs)/profile' as const,
      icon: 'person' as const,
      label: t('profile'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} containerWidth={320} />
    </View>
  );
}
