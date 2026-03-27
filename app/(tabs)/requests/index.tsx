import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';
import { apiGet } from '@/utils/api';
import { MapPin, Flag, Clock, Car } from 'lucide-react-native';
import { Animated } from 'react-native';

interface RideRequest {
  id: string;
  pickup_location: string;
  destination: string;
  price_offer: number;
  currency: string;
  status: string;
  created_at?: string;
  rider_first_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.primary,
  bargaining: '#F97316',
  accepted: COLORS.success,
  cancelled: COLORS.danger,
  completed: '#9E8A3A',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || COLORS.textTertiary;
  return (
    <View
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: `${color}40`,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color,
          fontFamily: 'Nunito_600SemiBold',
          textTransform: 'capitalize',
        }}
      >
        {status}
      </Text>
    </View>
  );
}

function formatCurrency(amount: number, currency: string): string {
  const num = Number(amount);
  return `${String(currency).toUpperCase()} ${num.toLocaleString()}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
      }}
    >
      <View style={{ height: 14, width: 120, borderRadius: 7, backgroundColor: COLORS.primaryMuted }} />
      <View style={{ height: 12, width: 200, borderRadius: 6, backgroundColor: COLORS.primaryMuted }} />
      <View style={{ height: 12, width: 80, borderRadius: 6, backgroundColor: COLORS.primaryMuted }} />
    </Animated.View>
  );
}

function RequestRow({ item, index }: { item: RideRequest; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const priceDisplay = formatCurrency(item.price_offer, item.currency);
  const dateDisplay = formatDate(item.created_at);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: '0 1px 6px rgba(90,60,0,0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
                {item.pickup_location}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Flag size={14} color={COLORS.accent} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
                {item.destination}
              </Text>
            </View>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>
            {priceDisplay}
          </Text>
          {dateDisplay ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
                {dateDisplay}
              </Text>
            </View>
          ) : null}
        </View>

        {item.rider_first_name ? (
          <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular', marginTop: 6 }}>
            Rider: {item.rider_first_name}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function RequestsScreen() {
  const { profile } = useProfile();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDriver = profile?.user_type === 'driver';
  const endpoint = isDriver ? '/api/driver/nearby-requests' : '/api/rides/my-requests';

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[RequestsScreen] Fetching requests, isDriver:', isDriver);
    try {
      const data = await apiGet<{ requests: RideRequest[] }>(endpoint);
      setRequests(data.requests || []);
    } catch (e) {
      console.error('[RequestsScreen] Failed to fetch:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint, isDriver]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const title = t('requests');
  const emptyMessage = isDriver
    ? 'No nearby ride requests at the moment'
    : 'You have not made any ride requests yet';
  const emptySubtitle = isDriver
    ? 'New requests from riders will appear here'
    : 'Request a ride from the Rides tab to get started';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginTop: 2 }}>
          {isDriver ? 'Nearby ride requests' : 'Your ride history'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRequests(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : requests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Car size={36} color={COLORS.primary} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' }}>
              {emptyMessage}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center', maxWidth: 260 }}>
              {emptySubtitle}
            </Text>
          </View>
        ) : (
          requests.map((req, i) => (
            <RequestRow key={req.id} item={req} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
