import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { COLORS } from '@/constants/colors';
import { apiGet, apiPost } from '@/utils/api';
import { MapPin, Flag, Clock, Car, CheckCircle } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';

interface Ride {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  vehicle_type: string;
  fare: number | null;
  status: string;
  created_at?: string;
  rider_name?: string;
  rider_phone?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F5A623',
  accepted: COLORS.success,
  completed: '#9E8A3A',
  cancelled: COLORS.danger,
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

function DriverRideCard({ item, index, onAccept, onComplete, actionLoading }: {
  item: Ride;
  index: number;
  onAccept: (id: string) => void;
  onComplete: (id: string) => void;
  actionLoading: string | null;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const dateDisplay = formatDate(item.created_at);
  const riderInitial = (item.rider_name || 'R')[0].toUpperCase();
  const isLoading = actionLoading === item.id;
  const isAccepted = item.status === 'accepted';

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
          shadowColor: '#5A3C00',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Rider row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: COLORS.primary,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#F5A623', fontFamily: 'Nunito_700Bold' }}>
              {riderInitial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
              {item.rider_name || 'Rider'}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular', textTransform: 'capitalize' }}>
              {item.vehicle_type}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Route */}
        <View style={{ gap: 6, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} color={COLORS.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {item.pickup_location}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Flag size={14} color={COLORS.accent} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {item.dropoff_location}
            </Text>
          </View>
        </View>

        {dateDisplay ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <Clock size={12} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
              {dateDisplay}
            </Text>
          </View>
        ) : null}

        {/* Action buttons for pending/accepted */}
        {item.status === 'pending' ? (
          <AnimatedPressable
            onPress={() => {
              console.log('[RequestsScreen] Accept ride pressed:', item.id);
              onAccept(item.id);
            }}
            disabled={isLoading}
            style={{
              backgroundColor: '#22C55E',
              borderRadius: 12,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <CheckCircle size={15} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                  Accept Ride
                </Text>
              </>
            )}
          </AnimatedPressable>
        ) : isAccepted ? (
          <AnimatedPressable
            onPress={() => {
              console.log('[RequestsScreen] Complete ride pressed:', item.id);
              onComplete(item.id);
            }}
            disabled={isLoading}
            style={{
              backgroundColor: '#F5A623',
              borderRadius: 12,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <>
                <CheckCircle size={15} color="#1A1A1A" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' }}>
                  Mark Complete
                </Text>
              </>
            )}
          </AnimatedPressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function RiderRideCard({ item, index }: { item: Ride; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

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
          shadowColor: '#5A3C00',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
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
                {item.dropoff_location}
              </Text>
            </View>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular', textTransform: 'capitalize' }}>
            {item.vehicle_type}
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
      </View>
    </Animated.View>
  );
}

export default function RequestsScreen() {
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDriver = (profile?.role ?? profile?.user_type) === 'driver';
  const endpoint = isDriver ? '/api/rides/available' : '/api/rides/my';

  const fetchRides = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[RequestsScreen] Fetching rides, isDriver:', isDriver, 'endpoint:', endpoint);
    try {
      const data = await apiGet<Ride[]>(endpoint);
      const list = Array.isArray(data) ? data : [];
      console.log('[RequestsScreen] Rides fetched:', list.length);
      setRides(list);
    } catch (e) {
      console.error('[RequestsScreen] Failed to fetch:', e);
      setRides([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint, isDriver]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const handleAccept = async (rideId: string) => {
    console.log('[RequestsScreen] Accept ride pressed:', rideId);
    setActionLoading(rideId);
    try {
      await apiPost(`/api/rides/${rideId}/accept`, {});
      console.log('[RequestsScreen] Ride accepted:', rideId);
      await fetchRides(true);
    } catch (e) {
      console.error('[RequestsScreen] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (rideId: string) => {
    console.log('[RequestsScreen] Complete ride pressed:', rideId);
    setActionLoading(rideId);
    try {
      await apiPost(`/api/rides/${rideId}/complete`, {});
      console.log('[RequestsScreen] Ride completed:', rideId);
      await fetchRides(true);
    } catch (e) {
      console.error('[RequestsScreen] Complete failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const title = isDriver ? 'Available Rides' : 'My Rides';
  const subtitle = isDriver ? 'Pending ride requests near you' : 'Your ride history';
  const emptyMessage = isDriver ? 'No pending rides right now' : 'No rides yet';
  const emptySubtitle = isDriver
    ? 'New requests from riders will appear here'
    : 'Book a ride from the Rides tab to get started';

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
          {subtitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log('[RequestsScreen] Pull-to-refresh triggered');
              setRefreshing(true);
              fetchRides();
            }}
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
        ) : rides.length === 0 ? (
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
        ) : isDriver ? (
          rides.map((ride, i) => (
            <DriverRideCard
              key={ride.id}
              item={ride}
              index={i}
              onAccept={handleAccept}
              onComplete={handleComplete}
              actionLoading={actionLoading}
            />
          ))
        ) : (
          rides.map((ride, i) => (
            <RiderRideCard key={ride.id} item={ride} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
