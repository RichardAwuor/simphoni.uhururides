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
import { Image } from 'expo-image';

const LOGO = require('@/assets/images/bdc4a1e4-99be-444d-bc2e-af445de9d03c.png');
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
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

  const validatePassword = () => {
    if (!password) { setPasswordError('Password is required'); return false; }
    if (password.length < 6) { setPasswordError('Password must be at least 6 characters'); return false; }
    setPasswordError('');
    return true;
  };

  const handleEmailAuth = async () => {
    const emailOk = validateEmail();
    const passOk = validatePassword();
    if (!emailOk || !passOk) return;
    setLoading(true);
    setError('');
    console.log('[AuthScreen] Email auth pressed, isSignUp:', isSignUp, 'email:', email);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
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
    console.log('[AuthScreen] Toggle mode to:', !isSignUp ? 'sign up' : 'sign in');
    setIsSignUp(!isSignUp);
    setError('');
    setEmailError('');
    setPasswordError('');
  };

  const buttonLabel = isSignUp ? 'Create Account' : 'Sign In';
  const toggleLabel = isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up";

  return (
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
            {isSignUp ? 'Create your account' : 'Welcome back'}
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

          {/* Password */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>
              Password
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: passwordError ? COLORS.danger : COLORS.border,
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <Lock size={18} color={COLORS.textTertiary} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onBlur={validatePassword}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 15,
                  color: COLORS.text,
                  fontFamily: 'Nunito_400Regular',
                }}
              />
              <AnimatedPressable onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} color={COLORS.textTertiary} /> : <Eye size={18} color={COLORS.textTertiary} />}
              </AnimatedPressable>
            </View>
            {passwordError ? (
              <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>
                {passwordError}
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
              <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: 'Nunito_600SemiBold' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Primary button */}
          <AnimatedPressable
            onPress={handleEmailAuth}
            disabled={loading}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 4px 16px rgba(245,197,24,0.35)',
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
  );
}
