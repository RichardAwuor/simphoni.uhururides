import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Car, User, ChevronDown, Check } from 'lucide-react-native';
import { countryToLanguage } from '@/constants/translations';

const LOGO = require('../assets/images/98f09b5e-58e7-47eb-94a3-11af3165b0a3.png');

type UserType = 'driver' | 'rider';

const COUNTRIES = [
  { key: 'Kenya', label: 'Kenya', flag: '🇰🇪' },
  { key: 'Uganda', label: 'Uganda', flag: '🇺🇬' },
  { key: 'Tanzania', label: 'Tanzania', flag: '🇹🇿' },
  { key: 'Rwanda', label: 'Rwanda', flag: '🇷🇼' },
  { key: 'Ethiopia', label: 'Ethiopia', flag: '🇪🇹' },
  { key: 'Burundi', label: 'Burundi', flag: '🇧🇮' },
  { key: 'South Sudan', label: 'South Sudan', flag: '🇸🇸' },
];

const LANGUAGES = [
  { key: 'English', label: 'English' },
  { key: 'Swahili', label: 'Swahili' },
  { key: 'French', label: 'French' },
  { key: 'Amharic', label: 'Amharic' },
];

function SelectorModal({
  visible,
  title,
  items,
  selectedKey,
  onSelect,
  onClose,
  renderItem,
}: {
  visible: boolean;
  title: string;
  items: { key: string; label: string; flag?: string }[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  renderItem?: (item: { key: string; label: string; flag?: string }) => React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          maxHeight: '70%',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: COLORS.border,
            alignSelf: 'center',
            marginBottom: 16,
          }}
        />
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: COLORS.text,
            fontFamily: 'Nunito_700Bold',
            paddingHorizontal: 24,
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = selectedKey === item.key;
            return (
              <TouchableOpacity
                onPress={() => {
                  console.log(`[Welcome] ${title} selected:`, item.key);
                  onSelect(item.key);
                  onClose();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  backgroundColor: isSelected ? COLORS.primaryMuted : 'transparent',
                }}
                activeOpacity={0.7}
              >
                {item.flag ? (
                  <Text style={{ fontSize: 24, marginRight: 14 }}>{item.flag}</Text>
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? COLORS.text : COLORS.textSecondary,
                    fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_400Regular',
                  }}
                >
                  {item.label}
                </Text>
                {isSelected ? <Check size={18} color={COLORS.primary} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [country, setCountry] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  // Auto-derive language code from country selection
  const handleCountrySelect = (key: string) => {
    console.log('[Welcome] Country selected:', key);
    setCountry(key);
    const autoLang = countryToLanguage(key);
    console.log('[Welcome] Auto-setting language code:', autoLang);
    setLanguage(autoLang);
  };

  const canContinue = country !== null && language !== null && userType !== null;

  const selectedCountryObj = COUNTRIES.find((c) => c.key === country);
  const selectedLanguageObj = LANGUAGES.find((l) => l.key === language);

  const countryLabel = selectedCountryObj ? selectedCountryObj.label : 'Select country';
  const countryFlag = selectedCountryObj ? selectedCountryObj.flag : null;
  const languageLabel = selectedLanguageObj ? selectedLanguageObj.label : 'Select language';

  const driverSelected = userType === 'driver';
  const riderSelected = userType === 'rider';

  const driverIconColor = driverSelected ? COLORS.text : COLORS.primary;
  const riderIconColor = riderSelected ? COLORS.text : COLORS.primary;

  const handleContinue = () => {
    if (!canContinue) return;
    console.log('[Welcome] Continue pressed — country:', country, 'language:', language, 'userType:', userType);
    router.push({
      pathname: '/auth-screen',
      params: { country, language, userType },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF7F0' }}>
      <StatusBar style="dark" />

      <SelectorModal
        visible={countryModalOpen}
        title="Select Country"
        items={COUNTRIES}
        selectedKey={country}
        onSelect={handleCountrySelect}
        onClose={() => setCountryModalOpen(false)}
      />
      <SelectorModal
        visible={languageModalOpen}
        title="Select Language"
        items={LANGUAGES}
        selectedKey={language}
        onSelect={setLanguage}
        onClose={() => setLanguageModalOpen(false)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Image
            source={LOGO}
            style={{ width: 160, height: 160, marginBottom: 20 }}
            contentFit="contain"
          />
          <Text
            style={{
              fontSize: 34,
              fontWeight: '800',
              color: COLORS.text,
              fontFamily: 'Nunito_800ExtraBold',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Uhuru-Rides
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: COLORS.textSecondary,
              fontFamily: 'Nunito_400Regular',
              textAlign: 'center',
            }}
          >
            Your ride, your price
          </Text>
        </View>

        {/* Country Selector */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: COLORS.textTertiary,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Country
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Welcome] Country picker opened');
              setCountryModalOpen(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: country ? COLORS.primary : COLORS.border,
              paddingHorizontal: 16,
              height: 56,
              boxShadow: country ? '0 2px 10px rgba(245,197,24,0.18)' : '0 1px 4px rgba(90,60,0,0.06)',
            }}
          >
            {countryFlag ? (
              <Text style={{ fontSize: 22, marginRight: 12 }}>{countryFlag}</Text>
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: COLORS.primaryMuted,
                  marginRight: 12,
                }}
              />
            )}
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: country ? '600' : '400',
                color: country ? COLORS.text : COLORS.textTertiary,
                fontFamily: country ? 'Nunito_600SemiBold' : 'Nunito_400Regular',
              }}
            >
              {countryLabel}
            </Text>
            <ChevronDown size={18} color={COLORS.textTertiary} />
          </AnimatedPressable>
        </View>

        {/* Language Selector */}
        <View style={{ marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: COLORS.textTertiary,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Language
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Welcome] Language picker opened');
              setLanguageModalOpen(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: language ? COLORS.primary : COLORS.border,
              paddingHorizontal: 16,
              height: 56,
              boxShadow: language ? '0 2px 10px rgba(245,197,24,0.18)' : '0 1px 4px rgba(90,60,0,0.06)',
            }}
          >
            <Text style={{ fontSize: 20, marginRight: 12 }}>🌐</Text>
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: language ? '600' : '400',
                color: language ? COLORS.text : COLORS.textTertiary,
                fontFamily: language ? 'Nunito_600SemiBold' : 'Nunito_400Regular',
              }}
            >
              {languageLabel}
            </Text>
            <ChevronDown size={18} color={COLORS.textTertiary} />
          </AnimatedPressable>
        </View>

        {/* User Type Cards */}
        <View style={{ marginBottom: 36 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: COLORS.textTertiary,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            I am a...
          </Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {/* Driver Card */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Welcome] User type selected: driver');
                setUserType('driver');
              }}
              style={{
                flex: 1,
                backgroundColor: driverSelected ? COLORS.primary : COLORS.surface,
                borderRadius: 20,
                paddingVertical: 28,
                paddingHorizontal: 16,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: driverSelected ? COLORS.primary : COLORS.border,
                boxShadow: driverSelected
                  ? '0 6px 20px rgba(245,197,24,0.35)'
                  : '0 1px 6px rgba(90,60,0,0.07)',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: driverSelected ? 'rgba(26,26,26,0.12)' : COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Car size={30} color={driverIconColor} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: COLORS.text,
                  fontFamily: 'Nunito_800ExtraBold',
                }}
              >
                Driver
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: driverSelected ? COLORS.textSecondary : COLORS.textTertiary,
                  fontFamily: 'Nunito_400Regular',
                  textAlign: 'center',
                }}
              >
                I give rides
              </Text>
              {driverSelected ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: COLORS.text,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={13} color={COLORS.primary} />
                </View>
              ) : null}
            </AnimatedPressable>

            {/* Rider Card */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Welcome] User type selected: rider');
                setUserType('rider');
              }}
              style={{
                flex: 1,
                backgroundColor: riderSelected ? COLORS.primary : COLORS.surface,
                borderRadius: 20,
                paddingVertical: 28,
                paddingHorizontal: 16,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: riderSelected ? COLORS.primary : COLORS.border,
                boxShadow: riderSelected
                  ? '0 6px 20px rgba(245,197,24,0.35)'
                  : '0 1px 6px rgba(90,60,0,0.07)',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: riderSelected ? 'rgba(26,26,26,0.12)' : COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={30} color={riderIconColor} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: COLORS.text,
                  fontFamily: 'Nunito_800ExtraBold',
                }}
              >
                Rider
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: riderSelected ? COLORS.textSecondary : COLORS.textTertiary,
                  fontFamily: 'Nunito_400Regular',
                  textAlign: 'center',
                }}
              >
                I need rides
              </Text>
              {riderSelected ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: COLORS.text,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={13} color={COLORS.primary} />
                </View>
              ) : null}
            </AnimatedPressable>
          </View>
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          <View
            style={{
              width: country ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: country ? COLORS.primary : COLORS.border,
            }}
          />
          <View
            style={{
              width: language ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: language ? COLORS.primary : COLORS.border,
            }}
          />
          <View
            style={{
              width: userType ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: userType ? COLORS.primary : COLORS.border,
            }}
          />
        </View>

        {/* Continue Button */}
        <AnimatedPressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={{
            backgroundColor: canContinue ? COLORS.primary : COLORS.primaryMuted,
            borderRadius: 16,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: canContinue ? COLORS.primary : COLORS.border,
            boxShadow: canContinue ? '0 4px 18px rgba(245,197,24,0.38)' : undefined,
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
    </View>
  );
}
