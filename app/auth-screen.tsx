import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import {
  Mail,
  CheckCircle,
  XCircle,
  Car,
  User,
  Phone,
  FileText,
  CreditCard,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiPost } from '@/utils/api';

const LOGO = require('../assets/images/9829a994-e39e-4ffe-a130-d61d8cab00e2.png');

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  onBlur,
  keyboardType,
  autoCapitalize,
  icon,
  rightIcon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  keyboardType?: any;
  autoCapitalize?: any;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  const borderColor = error ? COLORS.danger : COLORS.border;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: COLORS.textSecondary,
          fontFamily: 'Nunito_600SemiBold',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: 14,
          height: 52,
        }}
      >
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTertiary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 15,
            color: COLORS.text,
            fontFamily: 'Nunito_400Regular',
          }}
        />
        {rightIcon ?? null}
      </View>
      {error ? (
        <Text
          style={{
            fontSize: 12,
            color: COLORS.danger,
            fontFamily: 'Nunito_400Regular',
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function AuthScreen() {
  const { signUpWithEmail } = useAuth();
  const { refreshProfile } = useProfile();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    country?: string;
    language?: string;
    userType?: string;
  }>();

  const country = params.country ?? null;
  const language = params.language ?? null;
  const userType = (params.userType as 'driver' | 'rider') ?? null;

  // Common fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Driver-only fields
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [nationalId, setNationalId] = useState('');

  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, []);

  const isDriver = userType === 'driver';
  const isRider = userType === 'rider';

  const userTypeLabel = isDriver ? 'Driver' : isRider ? 'Rider' : null;
  const userTypeDesc = isDriver ? 'I give rides' : isRider ? 'I need rides' : null;

  const validateEmail = () => {
    if (!email) { setEmailError('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email address'); return false; }
    setEmailError('');
    return true;
  };

  const emailsMatch = email.length > 0 && confirmEmail.length > 0 && email === confirmEmail;
  const emailsMismatch = confirmTouched && confirmEmail.length > 0 && email !== confirmEmail;
  const showConfirmIcon = confirmTouched && confirmEmail.length > 0;
  const confirmIconColor = emailsMatch ? '#22c55e' : COLORS.danger;
  const confirmBorderColor = emailsMismatch ? COLORS.danger : emailsMatch ? '#22c55e' : COLORS.border;

  const driverFieldsFilled = !isDriver || (
    vehicleMakeModel.trim().length > 0 &&
    licensePlate.trim().length > 0 &&
    nationalId.trim().length > 0
  );

  const isFormValid =
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    emailsMatch &&
    driverFieldsFilled;

  const isSubmitDisabled = loading || !isFormValid;

  const saveProfileData = async () => {
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const basePayload: Record<string, any> = {
      user_type: userType ?? 'rider',
      first_name: firstName,
      last_name: lastName,
      mobile_number: phone.trim(),
      country: country?.toLowerCase() ?? 'kenya',
      language: language?.toLowerCase() ?? 'english',
    };

    console.log('[AuthScreen] Saving profile data:', basePayload);
    await apiPost('/api/profiles/me', basePayload);

    if (isDriver) {
      const driverPayload = {
        car_make: vehicleMakeModel.trim(),
        car_registration: licensePlate.trim().toUpperCase(),
        national_id: nationalId.trim(),
      };
      console.log('[AuthScreen] Saving driver details:', driverPayload);
      await apiPost('/api/driver/details', driverPayload);
    }

    await refreshProfile();
  };

  const handleCreateAccount = async () => {
    console.log('[AuthScreen] Create Account pressed — name:', fullName, 'phone:', phone, 'email:', email, 'userType:', userType, 'country:', country);
    const emailOk = validateEmail();
    if (!emailOk || !emailsMatch) return;

    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(email, email, fullName.trim());
      console.log('[AuthScreen] Sign up successful');
      try {
        await saveProfileData();
        console.log('[AuthScreen] Profile saved successfully');
      } catch (profileErr: any) {
        console.warn('[AuthScreen] Profile save failed (non-fatal):', profileErr?.message);
      }
      console.log('[AuthScreen] Navigating to /(tabs)');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('[AuthScreen] Sign up error:', e);
      setError(e?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A' }}>
      <StatusBar style="light" backgroundColor="#1A1A1A" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              paddingTop: insets.top + 40,
              paddingBottom: 40,
              paddingHorizontal: 24,
              alignItems: 'center',
            }}
          >
            <Animated.View
              style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}
            >
              <Image
                source={LOGO}
                style={{ width: 100, height: 100, marginBottom: 16 }}
                contentFit="contain"
              />
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '800',
                  color: COLORS.primary,
                  fontFamily: 'Nunito_800ExtraBold',
                  letterSpacing: -0.5,
                  marginBottom: 6,
                  textAlign: 'center',
                }}
              >
                Uhuru East Africa
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Nunito_400Regular',
                  textAlign: 'center',
                }}
              >
                Ride with pride. Travel with freedom.
              </Text>
            </Animated.View>
          </View>

          {/* Form */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              paddingHorizontal: 24,
              paddingTop: 28,
            }}
          >
            {/* User type card */}
            {userTypeLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: COLORS.primaryBorder,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 24,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: COLORS.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDriver ? (
                    <Car size={22} color={COLORS.text} />
                  ) : (
                    <User size={22} color={COLORS.text} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: COLORS.text,
                      fontFamily: 'Nunito_700Bold',
                    }}
                  >
                    {userTypeLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: COLORS.textSecondary,
                      fontFamily: 'Nunito_400Regular',
                    }}
                  >
                    {userTypeDesc}
                  </Text>
                </View>
                {country ? (
                  <Text
                    style={{
                      fontSize: 13,
                      color: COLORS.textTertiary,
                      fontFamily: 'Nunito_400Regular',
                    }}
                  >
                    {country}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Heading */}
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: COLORS.text,
                fontFamily: 'Nunito_700Bold',
                marginBottom: 24,
              }}
            >
              Create your account
            </Text>

            {/* Full Name */}
            <InputField
              label="Full Name"
              value={fullName}
              onChangeText={(v) => {
                console.log('[AuthScreen] Full name changed');
                setFullName(v);
              }}
              placeholder="e.g. Amara Osei"
              keyboardType="default"
              autoCapitalize="words"
              icon={<User size={18} color={COLORS.textTertiary} />}
            />

            {/* Phone Number */}
            <InputField
              label="Phone Number"
              value={phone}
              onChangeText={(v) => {
                console.log('[AuthScreen] Phone number changed');
                setPhone(v);
              }}
              placeholder="e.g. +254 712 345 678"
              keyboardType="phone-pad"
              autoCapitalize="none"
              icon={<Phone size={18} color={COLORS.textTertiary} />}
            />

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: COLORS.textSecondary,
                  fontFamily: 'Nunito_600SemiBold',
                  marginBottom: 6,
                }}
              >
                Email address
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: emailError ? COLORS.danger : COLORS.border,
                  paddingHorizontal: 14,
                  height: 52,
                }}
              >
                <Mail size={18} color={COLORS.textTertiary} />
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    console.log('[AuthScreen] Email changed');
                    setEmail(v);
                  }}
                  onBlur={validateEmail}
                  placeholder="e.g. john@email.com"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    marginLeft: 10,
                    fontSize: 15,
                    color: COLORS.text,
                    fontFamily: 'Nunito_400Regular',
                  }}
                />
              </View>
              {emailError ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.danger,
                    fontFamily: 'Nunito_400Regular',
                    marginTop: 4,
                  }}
                >
                  {emailError}
                </Text>
              ) : null}
            </View>

            {/* Confirm Email */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: COLORS.textSecondary,
                  fontFamily: 'Nunito_600SemiBold',
                  marginBottom: 6,
                }}
              >
                Confirm email address
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: confirmBorderColor,
                  paddingHorizontal: 14,
                  height: 52,
                }}
              >
                <Mail size={18} color={COLORS.textTertiary} />
                <TextInput
                  value={confirmEmail}
                  onChangeText={(val) => {
                    setConfirmEmail(val);
                    if (!confirmTouched && val.length > 0) setConfirmTouched(true);
                  }}
                  placeholder="Re-enter your email"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    marginLeft: 10,
                    fontSize: 15,
                    color: COLORS.text,
                    fontFamily: 'Nunito_400Regular',
                  }}
                />
                {showConfirmIcon ? (
                  emailsMatch ? (
                    <CheckCircle size={20} color={confirmIconColor} />
                  ) : (
                    <XCircle size={20} color={confirmIconColor} />
                  )
                ) : null}
              </View>
              {emailsMismatch ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.danger,
                    fontFamily: 'Nunito_400Regular',
                    marginTop: 4,
                  }}
                >
                  Emails do not match
                </Text>
              ) : null}
            </View>

            {/* Driver-only fields */}
            {isDriver ? (
              <View
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: COLORS.primaryBorder,
                  padding: 16,
                  marginBottom: 24,
                  gap: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: COLORS.textSecondary,
                    fontFamily: 'Nunito_700Bold',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  Vehicle Details
                </Text>

                <InputField
                  label="Vehicle Make & Model"
                  value={vehicleMakeModel}
                  onChangeText={(v) => {
                    console.log('[AuthScreen] Vehicle make/model changed');
                    setVehicleMakeModel(v);
                  }}
                  placeholder="e.g. Toyota Corolla"
                  keyboardType="default"
                  autoCapitalize="words"
                  icon={<Car size={18} color={COLORS.textTertiary} />}
                />

                <InputField
                  label="License Plate Number"
                  value={licensePlate}
                  onChangeText={(v) => {
                    console.log('[AuthScreen] License plate changed');
                    setLicensePlate(v.toUpperCase());
                  }}
                  placeholder="e.g. KCA 123A"
                  keyboardType="default"
                  autoCapitalize="characters"
                  icon={<FileText size={18} color={COLORS.textTertiary} />}
                />

                <View style={{ marginBottom: 0 }}>
                  <InputField
                    label="National ID / Driver's License Number"
                    value={nationalId}
                    onChangeText={(v) => {
                      console.log('[AuthScreen] National ID changed');
                      setNationalId(v);
                    }}
                    placeholder="e.g. 12345678"
                    keyboardType="default"
                    autoCapitalize="none"
                    icon={<CreditCard size={18} color={COLORS.textTertiary} />}
                  />
                </View>
              </View>
            ) : null}

            {/* Error */}
            {error ? (
              <View
                style={{
                  backgroundColor: COLORS.dangerMuted,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: COLORS.danger,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: COLORS.danger,
                    fontFamily: 'Nunito_600SemiBold',
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Create Account Button */}
            <AnimatedPressable
              onPress={handleCreateAccount}
              disabled={isSubmitDisabled}
              style={{
                backgroundColor: isSubmitDisabled ? COLORS.border : COLORS.primary,
                borderRadius: 14,
                height: 54,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 32,
                boxShadow: isSubmitDisabled ? undefined : '0 4px 16px rgba(245,197,24,0.35)',
              }}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isSubmitDisabled ? COLORS.textTertiary : COLORS.text,
                    fontFamily: 'Nunito_700Bold',
                  }}
                >
                  Create Account
                </Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
