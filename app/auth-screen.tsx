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

const LOGO = require('@/assets/images/affbe497-25f0-4e5b-afa0-fdb877dfaf49.png');
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Mail, CheckCircle, XCircle } from 'lucide-react-native';
import { router } from 'expo-router';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
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
  const isSignInDisabled = loading || !email;

  const handleEmailAuth = async () => {
    const emailOk = validateEmail();
    if (!emailOk) return;
    if (isSignUp && !emailsMatch) return;

    setLoading(true);
    setError('');
    console.log('[AuthScreen] Email auth pressed, isSignUp:', isSignUp, 'email:', email);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, email);
        console.log('[AuthScreen] Sign up successful, navigating to /welcome');
        router.replace('/welcome');
      } else {
        await signInWithEmail(email, email);
        console.log('[AuthScreen] Sign in successful');
      }
    } catch (e: any) {
      console.error('[AuthScreen] Email auth error:', e);
      setError(e?.message || 'Authentication failed. Please try again.');
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
    } catch (e: any) {
      console.error('[AuthScreen] Google auth error:', e);
      setError(e?.message || 'Google sign in failed.');
    } finally {
      setSocialLoading(null);
    }
  };

  const toggleMode = () => {
    const next = !isSignUp;
    console.log('[AuthScreen] Toggle mode to:', next ? 'sign up' : 'sign in');
    setIsSignUp(next);
    setError('');
    setEmailError('');
    setConfirmEmail('');
    setConfirmTouched(false);
  };

  const buttonLabel = isSignUp ? 'Continue' : 'Sign In';
  const toggleLabel = isSignUp ? 'Already have an account? Sign in' : 'New here? Create account';
  const headingLabel = isSignUp ? 'Create your account' : 'Welcome back';

  const confirmIconColor = emailsMatch ? '#22c55e' : '#E63946';
  const showConfirmIcon = confirmTouched && confirmEmail.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A' }}>
    <StatusBar style="light" backgroundColor="#1A1A1A" />
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View
          style={{
            backgroundColor: '#1A1A1A',
            paddingTop: 80,
            paddingBottom: 48,
            paddingHorizontal: 24,
            alignItems: 'center',
          }}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
            <Image source={LOGO} style={{ width: 180, height: 180, marginBottom: 20 }} contentFit="contain" />
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: COLORS.primary,
                fontFamily: 'Nunito_800ExtraBold',
                letterSpacing: -0.5,
                marginBottom: 8,
              }}
            >
              Uhuru East Africa
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.65)',
                fontFamily: 'Nunito_400Regular',
                textAlign: 'center',
              }}
            >
              Ride with pride. Travel with freedom.
            </Text>
          </Animated.View>
        </View>

        {/* Form section */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingHorizontal: 24,
            paddingTop: 32,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: COLORS.text,
              fontFamily: 'Nunito_700Bold',
              marginBottom: 24,
            }}
          >
            {headingLabel}
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>
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
              <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>
                {emailError}
              </Text>
            ) : null}
          </View>

          {/* Confirm Email — sign up only */}
          {isSignUp ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>
                Confirm email address
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: emailsMismatch ? COLORS.danger : emailsMatch ? '#22c55e' : COLORS.border,
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
                <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>
                  Emails do not match
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ marginBottom: 24 }} />
          )}

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
              <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: 'Nunito_600SemiBold' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Primary button */}
          <AnimatedPressable
            onPress={handleEmailAuth}
            disabled={isSignUp ? isSignUpDisabled : isSignInDisabled}
            style={{
              backgroundColor: (isSignUp ? isSignUpDisabled : isSignInDisabled) ? COLORS.border : COLORS.primary,
              borderRadius: 14,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: (isSignUp ? isSignUpDisabled : isSignInDisabled) ? undefined : '0 4px 16px rgba(245,197,24,0.35)',
            }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
                {buttonLabel}
              </Text>
            )}
          </AnimatedPressable>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            <Text style={{ marginHorizontal: 12, fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
              or continue with
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
          </View>

          {/* Apple button — MUST be first */}
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
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Nunito_600SemiBold' }}>
                  Continue with Apple
                </Text>
              </>
            )}
          </AnimatedPressable>

          {/* Google button */}
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
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
                  Continue with Google
                </Text>
              </>
            )}
          </AnimatedPressable>

          {/* Toggle */}
          <AnimatedPressable onPress={toggleMode} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>
              {toggleLabel}
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}
