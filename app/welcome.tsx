import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';

const LOGO = require('@/assets/images/eb9079ba-77d3-4f39-a6db-ac178d863627.png');
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Car, User } from 'lucide-react-native';

type Country = 'kenya' | 'tanzania' | 'uganda';
type Language = 'english' | 'swahili' | 'luganda';
type UserType = 'driver' | 'rider';

const countries: { key: Country; label: string; flag: string }[] = [
  { key: 'kenya', label: 'Kenya', flag: '🇰🇪' },
  { key: 'tanzania', label: 'Tanzania', flag: '🇹🇿' },
  { key: 'uganda', label: 'Uganda', flag: '🇺🇬' },
];

const languages: { key: Language; label: string }[] = [
  { key: 'english', label: 'English' },
  { key: 'swahili', label: 'Swahili' },
  { key: 'luganda', label: 'Luganda' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [country, setCountry] = useState<Country | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);

  const canContinue = country && language && userType;

  const handleContinue = () => {
    if (!canContinue) return;
    console.log('[Welcome] Continue pressed, country:', country, 'language:', language, 'userType:', userType);
    if (userType === 'driver') {
      router.push({ pathname: '/onboarding/driver-register', params: { country, language, userType } });
    } else {
      router.push({ pathname: '/onboarding/rider-register', params: { country, language, userType } });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Image source={LOGO} style={{ width: 140, height: 140, marginBottom: 16 }} contentFit="contain" />
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: COLORS.text,
              fontFamily: 'Nunito_800ExtraBold',
              letterSpacing: -0.5,
              marginBottom: 6,
            }}
          >
            Welcome to Uhuru-Rides
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
            Let's set up your profile in a few steps
          </Text>
        </View>

        {/* Step 1: Country */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, fontFamily: 'Nunito_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 1 — Your Country
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {countries.map((c) => {
              const isSelected = country === c.key;
              return (
                <AnimatedPressable
                  key={c.key}
                  onPress={() => {
                    console.log('[Welcome] Country selected:', c.key);
                    setCountry(c.key);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: isSelected ? COLORS.primary : COLORS.border,
                    boxShadow: isSelected ? '0 4px 12px rgba(245,197,24,0.3)' : '0 1px 4px rgba(90,60,0,0.06)',
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{c.flag}</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isSelected ? COLORS.text : COLORS.textSecondary,
                      fontFamily: 'Nunito_700Bold',
                    }}
                  >
                    {c.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Step 2: Language */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, fontFamily: 'Nunito_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 2 — Language
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {languages.map((l) => {
              const isSelected = language === l.key;
              return (
                <AnimatedPressable
                  key={l.key}
                  onPress={() => {
                    console.log('[Welcome] Language selected:', l.key);
                    setLanguage(l.key);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                    borderRadius: 24,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: isSelected ? COLORS.primary : COLORS.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: isSelected ? COLORS.text : COLORS.textSecondary,
                      fontFamily: 'Nunito_700Bold',
                    }}
                  >
                    {l.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Step 3: User Type */}
        <View style={{ marginBottom: 36 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, fontFamily: 'Nunito_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 3 — I am a...
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {([
              { key: 'driver' as UserType, label: 'Driver', icon: <Car size={32} color={userType === 'driver' ? COLORS.text : COLORS.primary} />, desc: 'I give rides' },
              { key: 'rider' as UserType, label: 'Rider', icon: <User size={32} color={userType === 'rider' ? COLORS.text : COLORS.primary} />, desc: 'I need rides' },
            ]).map((ut) => {
              const isSelected = userType === ut.key;
              return (
                <AnimatedPressable
                  key={ut.key}
                  onPress={() => {
                    console.log('[Welcome] User type selected:', ut.key);
                    setUserType(ut.key);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: isSelected ? COLORS.primary : COLORS.surface,
                    borderRadius: 20,
                    padding: 20,
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: isSelected ? COLORS.primary : COLORS.border,
                    boxShadow: isSelected ? '0 4px 16px rgba(245,197,24,0.3)' : '0 1px 4px rgba(90,60,0,0.06)',
                    gap: 10,
                  }}
                >
                  {ut.icon}
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '800',
                      color: isSelected ? COLORS.text : COLORS.text,
                      fontFamily: 'Nunito_800ExtraBold',
                    }}
                  >
                    {ut.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isSelected ? COLORS.textSecondary : COLORS.textTertiary,
                      fontFamily: 'Nunito_400Regular',
                    }}
                  >
                    {ut.desc}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Continue button */}
        <AnimatedPressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={{
            backgroundColor: canContinue ? COLORS.primary : COLORS.primaryMuted,
            borderRadius: 16,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: canContinue ? '0 4px 16px rgba(245,197,24,0.35)' : undefined,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: canContinue ? COLORS.text : COLORS.textTertiary,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Continue
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}
