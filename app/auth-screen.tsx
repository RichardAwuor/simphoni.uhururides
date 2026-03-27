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
import { Mail, CheckCircle, XCircle, Car, User } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiPost } from '@/utils/api';

const LOGO = require('@/assets/images/a11f821b-ef35-45fe-8a5e-5dcefb8655ce.png');

export default function AuthScreen() {
  const { signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();
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

  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, []);

  const validateEmail = () => {
    if (!email) { setEmailError('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email address'); return false; }
    setEmailError('');
    return true;
  };

  const emailsMatch = email.length > 0 && confirmEmail.length > 0 && email === confirmEmail;
  const emailsMismatch = confirmTouched && confirmEmail.length > 0 && email !== confirmEmail;
  const isSignUpDisabled = loading || !emailsMatch;

  const saveOnboardingData = async () => {
    if (!country && !language && !userType) return;
    try {
      console.log('[AuthScreen] Saving onboarding profile data:', { country, language, userType });
      await apiPost('/api/profiles/me', {
        country: country?.toLowerCase(),
        language: language?.toLowerCase(),
        user_type: userType,
      });
      await refreshProfile();
    } catch (e: any) {
      // Profile API may not exist yet — store is best-effort
      console.warn('[AuthScreen] Profile save failed (non-fatal):', e?.message);
    }
  };

  const handleEmailAuth = async () => {
    const emailOk = validateEmail();
    if (!emailOk || !emailsMatch) return;

    setLoading(true);
    setError('');
    console.log('[AuthScreen] Sign up pressed — email:', email, 'country:', country, 'language:', language, 'userType:', userType);
    try {
      await signUpWithEmail(email, email);
      console.log('[AuthScreen] Sign up successful');
      await saveOnboardingData();
      console.log('[AuthScreen] Navigating to /(tabs)');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('[AuthScreen] Sign up error:', e);
      setError(e?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setSocialLoading('apple');
    setError('');
    console.log('[AuthScreen] Apple sign in pressed');
    try {
      await signInWithApple();
      await saveOnboardingData();
      console.log('[AuthScreen] Apple sign in successful, navigating to /(tabs)');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('[AuthScreen] Apple auth error:', e);
      if (!e?.message?.includes('cancel')) {
        setError(e?.message || 'Apple sign in failed.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    setError('');
    console.log('[AuthScreen] Google sign in pressed');
    try {
      await signInWithGoogle();
      await saveOnboardingData();
      console.log('[AuthScreen] Google sign in successful, navigating to /(tabs)');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('[AuthScreen] Google auth error:', e);
      setError(e?.message || 'Google sign in failed.');
    } finally {
      setSocialLoading(null);
    }
  };

  const confirmBorderColor = emailsMismatch ? COLORS.danger : emailsMatch ? '#22c55e' : COLORS.border;
  const confirmIconColor = emailsMatch ? '#22c55e' : '#E63946';
  const showConfirmIcon = confirmTouched && confirmEmail.length > 0;

  const isDriver = userType === 'driver';
  const isRider = userType === 'rider';
  const hasUserType = isDriver || isRider;

  const userTypeLabel = isDriver ? 'Driver' : isRider ? 'Rider' : null;
  const userTypeDesc = isDriver ? 'I give rides' : isRider ? 'I need rides' : null;

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
            {/* User type context badge */}
            {hasUserType ? (
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
                    width: 44,
                    height: 44,
                    borderRadius: 22,
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
                  <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
                    {country}
                  </Text>
                ) : null}
              </View>
            ) : null}

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
                  onChangeText={setEmail}
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
                  style={{ fontSize: 13, color: COLORS.danger, fontFamily: 'Nunito_600SemiBold' }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Create Account */}
            <AnimatedPressable
              onPress={handleEmailAuth}
              disabled={isSignUpDisabled}
              style={{
                backgroundColor: isSignUpDisabled ? COLORS.border : COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                boxShadow: isSignUpDisabled ? undefined : '0 4px 16px rgba(245,197,24,0.35)',
              }}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isSignUpDisabled ? COLORS.textTertiary : COLORS.text,
                    fontFamily: 'Nunito_700Bold',
                  }}
                >
                  Create Account
                </Text>
              )}
            </AnimatedPressable>

            {/* Divider */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
              <Text
                style={{
                  marginHorizontal: 12,
                  fontSize: 13,
                  color: COLORS.textTertiary,
                  fontFamily: 'Nunito_400Regular',
                }}
              >
                or continue with
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            </View>

            {/* Apple */}
            <AnimatedPressable
              onPress={handleApple}
              disabled={socialLoading !== null}
              style={{
                backgroundColor: '#1A1A1A',
                borderRadius: 14,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={{ fontSize: 20, color: '#fff' }}>🍎</Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#fff',
                      fontFamily: 'Nunito_600SemiBold',
                    }}
                  >
                    Continue with Apple
                  </Text>
                </>
              )}
            </AnimatedPressable>

            {/* Google */}
            <AnimatedPressable
              onPress={handleGoogle}
              disabled={socialLoading !== null}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 24,
                borderWidth: 1.5,
                borderColor: COLORS.border,
              }}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: COLORS.text,
                      fontFamily: 'Nunito_600SemiBold',
                    }}
                  >
                    Continue with Google
                  </Text>
                </>
              )}
            </AnimatedPressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
