import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const LOGO = require('@/assets/images/affbe497-25f0-4e5b-afa0-fdb877dfaf49.png');
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiPost } from '@/utils/api';
import { useProfile } from '@/contexts/ProfileContext';
import { Camera } from 'lucide-react-native';

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  onBlur,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'words'}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: error ? COLORS.danger : COLORS.border,
          paddingHorizontal: 14,
          height: 52,
          fontSize: 15,
          color: COLORS.text,
          fontFamily: 'Nunito_400Regular',
        }}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function RiderRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ country: string; language: string; userType: string }>();
  const { refreshProfile } = useProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [district, setDistrict] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (field: string, value: string) => {
    if (!value.trim()) {
      setErrors((e) => ({ ...e, [field]: `${field} is required` }));
      return false;
    }
    setErrors((e) => ({ ...e, [field]: '' }));
    return true;
  };

  const pickImage = async () => {
    console.log('[RiderRegister] Pick image pressed');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const f1 = validate('First Name', firstName);
    const f2 = validate('Last Name', lastName);
    const f3 = validate('Resident District', district);
    if (!f1 || !f2 || !f3) return;

    setLoading(true);
    console.log('[RiderRegister] Creating rider profile:', { firstName, lastName, district, country: params.country });
    try {
      await apiPost('/api/profiles/me', {
        user_type: 'rider',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        resident_district: district.trim(),
        country: params.country || 'kenya',
        language: params.language || 'english',
        profile_picture_url: profilePicture || undefined,
      });
      await refreshProfile();
      router.replace('/(tabs)/(home)');
    } catch (e: any) {
      console.error('[RiderRegister] Error creating profile:', e);
      Alert.alert('Error', e?.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Create Rider Profile' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ExpoImage source={LOGO} style={{ width: 100, height: 100 }} contentFit="contain" />
        </View>

        {/* Profile picture */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <AnimatedPressable onPress={pickImage}>
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: COLORS.primaryMuted,
                borderWidth: 2.5,
                borderColor: COLORS.primary,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={{ width: 100, height: 100 }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Camera size={28} color={COLORS.primary} />
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>
                    Add Photo
                  </Text>
                </View>
              )}
            </View>
          </AnimatedPressable>
        </View>

        <InputField
          label="First Name *"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. Amara"
          error={errors['First Name']}
          onBlur={() => validate('First Name', firstName)}
        />
        <InputField
          label="Last Name *"
          value={lastName}
          onChangeText={setLastName}
          placeholder="e.g. Osei"
          error={errors['Last Name']}
          onBlur={() => validate('Last Name', lastName)}
        />
        <InputField
          label="Resident County / District *"
          value={district}
          onChangeText={setDistrict}
          placeholder="e.g. Nairobi, Kampala Central"
          error={errors['Resident District']}
          onBlur={() => validate('Resident District', district)}
        />

        <AnimatedPressable
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 16,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            boxShadow: '0 4px 16px rgba(245,197,24,0.35)',
          }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
              Create Account
            </Text>
          )}
        </AnimatedPressable>
      </ScrollView>
    </>
  );
}
