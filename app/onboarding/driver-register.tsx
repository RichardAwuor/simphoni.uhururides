import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const LOGO = require('@/assets/images/253887a8-e31b-40cd-9be6-6c2fb8849bc4.png');
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiPost } from '@/utils/api';
import { useProfile } from '@/contexts/ProfileContext';
import { Camera, ChevronDown } from 'lucide-react-native';

const CAR_MAKES = ['Toyota', 'Nissan', 'Ford', 'Mercedes', 'Volkswagen', 'Others'];
const CAR_COLORS = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Grey', 'Gold', 'Green', 'Brown', 'Orange', 'Others'];

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

function PickerField({
  label,
  value,
  onValueChange,
  items,
  error,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  items: string[];
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: error ? COLORS.danger : COLORS.border,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={{
            flex: 1,
            height: 52,
            color: value ? COLORS.text : COLORS.textTertiary,
          }}
          itemStyle={{ fontFamily: 'Nunito_400Regular', fontSize: 15 }}
        >
          <Picker.Item label={`Select ${label}`} value="" color={COLORS.textTertiary} />
          {items.map((item) => (
            <Picker.Item key={item} label={item} value={item} color={COLORS.text} />
          ))}
        </Picker>
        <ChevronDown size={18} color={COLORS.textTertiary} style={{ marginRight: 12 }} />
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function DriverRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ country: string; language: string; userType: string }>();
  const { refreshProfile } = useProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [district, setDistrict] = useState('');
  const [mobile, setMobile] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carReg, setCarReg] = useState('');
  const [carColor, setCarColor] = useState('');
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
    console.log('[DriverRegister] Pick image pressed');
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
    const checks = [
      validate('First Name', firstName),
      validate('Last Name', lastName),
      validate('Resident District', district),
      validate('Mobile Number', mobile),
      validate('Car Make', carMake),
      validate('Car Registration', carReg),
      validate('Car Color', carColor),
    ];
    if (checks.some((c) => !c)) return;

    setLoading(true);
    console.log('[DriverRegister] Creating driver profile:', { firstName, lastName, district, mobile, carMake, carReg, carColor });
    try {
      await apiPost('/api/profiles/me', {
        user_type: 'driver',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        resident_district: district.trim(),
        country: params.country || 'kenya',
        language: params.language || 'english',
        mobile_number: mobile.trim(),
        profile_picture_url: profilePicture || undefined,
      });
      console.log('[DriverRegister] Profile created, creating driver details');
      await apiPost('/api/driver/details', {
        car_make: carMake,
        car_registration: carReg.trim().toUpperCase(),
        car_color: carColor,
      });
      await refreshProfile();
      router.replace('/(tabs)/(home)');
    } catch (e: any) {
      console.error('[DriverRegister] Error:', e);
      Alert.alert('Error', e?.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Create Driver Profile' }} />
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

        {/* Section: Personal */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold', marginBottom: 12 }}>
          Personal Details
        </Text>

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
        <InputField
          label="Mobile Number *"
          value={mobile}
          onChangeText={setMobile}
          placeholder="e.g. +254712345678"
          error={errors['Mobile Number']}
          onBlur={() => validate('Mobile Number', mobile)}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />

        {/* Section: Vehicle */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold', marginBottom: 12, marginTop: 8 }}>
          Vehicle Details
        </Text>

        <PickerField
          label="Car Make *"
          value={carMake}
          onValueChange={(v) => {
            console.log('[DriverRegister] Car make selected:', v);
            setCarMake(v);
            if (v) setErrors((e) => ({ ...e, 'Car Make': '' }));
          }}
          items={CAR_MAKES}
          error={errors['Car Make']}
        />

        <InputField
          label="Car Registration Number *"
          value={carReg}
          onChangeText={(v) => setCarReg(v.toUpperCase())}
          placeholder="e.g. KCA 123A"
          error={errors['Car Registration']}
          onBlur={() => validate('Car Registration', carReg)}
          autoCapitalize="characters"
        />

        <PickerField
          label="Car Color *"
          value={carColor}
          onValueChange={(v) => {
            console.log('[DriverRegister] Car color selected:', v);
            setCarColor(v);
            if (v) setErrors((e) => ({ ...e, 'Car Color': '' }));
          }}
          items={CAR_COLORS}
          error={errors['Car Color']}
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
