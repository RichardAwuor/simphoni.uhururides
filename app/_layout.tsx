import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { COLORS } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, profileLoading } = useProfile();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (authLoading || profileLoading) return;

    const inAuthScreen = segments[0] === 'auth-screen';
    const inWelcome = segments[0] === 'welcome';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    const inAuthPopup = segments[0] === 'auth-popup';
    const inAuthCallback = segments[0] === 'auth-callback';

    if (!user) {
      if (!inWelcome && !inAuthScreen && !inAuthPopup && !inAuthCallback) {
        console.log('[NavigationGuard] No user, redirecting to welcome');
        router.replace('/welcome');
      }
    } else if (!profile) {
      if (!inWelcome && !inOnboarding) {
        console.log('[NavigationGuard] User exists but no profile, redirecting to welcome');
        router.replace('/welcome');
      }
    } else {
      if (!inTabs) {
        console.log('[NavigationGuard] User + profile found, redirecting to tabs');
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, authLoading, profileLoading, segments]);

  if (authLoading || profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
          <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
        <SystemBars style="auto" />
      </NavigationGuard>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="auto" animated />
        <AuthProvider>
          <ProfileProvider>
            <RootLayoutInner />
          </ProfileProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
