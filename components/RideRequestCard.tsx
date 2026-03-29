import React, { useRef, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { MapPin, Flag, User } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useTranslation } from '@/hooks/useTranslation';

export interface RideRequest {
  id: string;
  rider_id?: string;
  rider_first_name?: string;
  rider_profile_picture?: string;
  pickup_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  destination: string;
  price_offer: number;
  currency: string;
  status: string;
  created_at?: string;
}

interface RideRequestCardProps {
  request: RideRequest;
  index: number;
  onAccept: (id: string) => void;
  onBargain: (id: string, currentPrice: number, currency: string) => void;
  onIgnore: (id: string) => void;
}

function formatCurrency(amount: number, currency: string): string {
  const num = Number(amount);
  const formatted = num.toLocaleString();
  return `${currency.toUpperCase()} ${formatted}`;
}

export function RideRequestCard({ request, index, onAccept, onBargain, onIgnore }: RideRequestCardProps) {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const initials = (request.rider_first_name || 'R')[0].toUpperCase();
  const priceDisplay = formatCurrency(request.price_offer, request.currency);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: '0 2px 10px rgba(90,60,0,0.07)',
        }}
      >
        {/* Rider info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: COLORS.primary,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
              {request.rider_first_name || 'Passenger'}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
              Ride Request
            </Text>
          </View>
          <View
            style={{
              backgroundColor: COLORS.primaryMuted,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: COLORS.primary,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>
              {priceDisplay}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={{ gap: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MapPin size={16} color={COLORS.primary} />
            <Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {request.pickup_location}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Flag size={16} color={COLORS.accent} />
            <Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {request.destination}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Accept pressed for ride:', request.id);
              onAccept(request.id);
            }}
            style={{
              flex: 1,
              backgroundColor: COLORS.success,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
              {t('accept')}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Bargain pressed for ride:', request.id);
              onBargain(request.id, request.price_offer, request.currency);
            }}
            style={{
              flex: 1,
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
              {t('bargain')}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Ignore pressed for ride:', request.id);
              onIgnore(request.id);
            }}
            style={{
              flex: 1,
              borderWidth: 1.5,
              borderColor: COLORS.accent,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.accent, fontFamily: 'Nunito_700Bold' }}>
              {t('reject')}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}
