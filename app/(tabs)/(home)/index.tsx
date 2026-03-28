import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost } from '@/utils/api';
import { MapPin, Flag, Car, CheckCircle, RefreshCw } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  vehicle_type: string;
  fare: number | null;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  // rider info (from /api/rides/available)
  rider_name?: string;
  rider_phone?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { label: 'Boda Boda (Motorcycle)', value: 'boda' },
  { label: 'Saloon Car', value: 'saloon' },
  { label: 'SUV / 4x4', value: 'suv' },
  { label: 'Minibus / Matatu', value: 'minibus' },
  { label: 'Tuk Tuk', value: 'tuktuk' },
];

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Searching for driver...',
    accepted: 'Driver on the way',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Pulse animation ──────────────────────────────────────────────────────────

function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
        transform: [{ scale: pulse }],
      }}
    />
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: '#F5A623',
  accepted: COLORS.success,
  completed: '#9E8A3A',
  cancelled: COLORS.danger,
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || COLORS.textTertiary;
  const label = formatStatus(status);
  return (
    <View
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: `${color}40`,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color, fontFamily: 'Nunito_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Ride History Card ────────────────────────────────────────────────────────

function RideHistoryCard({ ride, index }: { ride: Ride; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const dateDisplay = formatDate(ride.created_at);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={styles.historyCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={14} color={COLORS.primary} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.pickup_location}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Flag size={14} color={COLORS.accent} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.dropoff_location}</Text>
            </View>
          </View>
          <StatusBadge status={ride.status} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.vehicleText}>{ride.vehicle_type}</Text>
          <Text style={styles.dateText}>{dateDisplay}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Driver Screen ────────────────────────────────────────────────────────────

function DriverRidesScreen() {
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAvailable = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[DriverRidesScreen] Fetching available rides');
    try {
      const data = await apiGet<Ride[]>('/api/rides/available');
      const list = Array.isArray(data) ? data : [];
      console.log('[DriverRidesScreen] Available rides count:', list.length);
      setRides(list);
    } catch (e) {
      console.error('[DriverRidesScreen] Failed to fetch available rides:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailable();
    intervalRef.current = setInterval(() => fetchAvailable(true), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAvailable]);

  const handleAccept = async (rideId: string) => {
    console.log('[DriverRidesScreen] Accept ride pressed:', rideId);
    setActionLoading(rideId);
    try {
      await apiPost(`/api/rides/${rideId}/accept`, {});
      console.log('[DriverRidesScreen] Ride accepted:', rideId);
      await fetchAvailable(true);
    } catch (e) {
      console.error('[DriverRidesScreen] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (rideId: string) => {
    console.log('[DriverRidesScreen] Complete ride pressed:', rideId);
    setActionLoading(rideId);
    try {
      await apiPost(`/api/rides/${rideId}/complete`, {});
      console.log('[DriverRidesScreen] Ride completed:', rideId);
      await fetchAvailable(true);
    } catch (e) {
      console.error('[DriverRidesScreen] Complete failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Available Rides</Text>
        <AnimatedPressable
          onPress={() => {
            console.log('[DriverRidesScreen] Manual refresh pressed');
            fetchAvailable();
          }}
          style={styles.refreshBtn}
        >
          <RefreshCw size={18} color={COLORS.textSecondary} />
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading rides...</Text>
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No ride requests right now</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to refresh or wait — new requests appear every 10 seconds.
            </Text>
          </View>
        ) : (
          rides.map((ride) => {
            const riderInitial = (ride.rider_name || 'R')[0].toUpperCase();
            const isAccepted = ride.status === 'accepted';
            const isLoading = actionLoading === ride.id;

            return (
              <View key={ride.id} style={styles.card}>
                {/* Rider row */}
                <View style={styles.riderRow}>
                  <View style={styles.riderAvatar}>
                    <Text style={styles.riderAvatarText}>{riderInitial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.riderName}>{ride.rider_name || 'Rider'}</Text>
                    <Text style={styles.vehicleChip}>{ride.vehicle_type}</Text>
                  </View>
                  <StatusBadge status={ride.status} />
                </View>

                {/* Route */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeRow}>
                    <MapPin size={15} color={COLORS.primary} />
                    <Text style={styles.routeLabel} numberOfLines={1}>{ride.pickup_location}</Text>
                  </View>
                  <View style={styles.routeRow}>
                    <Flag size={15} color={COLORS.accent} />
                    <Text style={styles.routeLabel} numberOfLines={1}>{ride.dropoff_location}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Action */}
                {isAccepted ? (
                  <AnimatedPressable
                    onPress={() => handleComplete(ride.id)}
                    disabled={isLoading}
                    style={styles.btnComplete}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.btnCompleteText}>Mark Complete</Text>
                      </>
                    )}
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    onPress={() => handleAccept(ride.id)}
                    disabled={isLoading}
                    style={styles.btnAccept}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.btnAcceptText}>Accept Ride</Text>
                      </>
                    )}
                  </AnimatedPressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Rider Screen ─────────────────────────────────────────────────────────────

function RiderRidesScreen() {
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [vehicleType, setVehicleType] = useState('boda');
  const [submitting, setSubmitting] = useState(false);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [bookError, setBookError] = useState('');
  const [bookSuccess, setBookSuccess] = useState(false);

  const fetchMyRides = useCallback(async () => {
    console.log('[RiderRidesScreen] Fetching my rides');
    try {
      const data = await apiGet<Ride[]>('/api/rides/my');
      const list = Array.isArray(data) ? data : [];
      console.log('[RiderRidesScreen] My rides count:', list.length);
      setMyRides(list);
    } catch (e) {
      console.error('[RiderRidesScreen] Failed to fetch my rides:', e);
    } finally {
      setRidesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRides();
  }, [fetchMyRides]);

  const handleBook = async () => {
    if (!pickup.trim() || !dropoff.trim()) return;
    console.log('[RiderRidesScreen] Book Ride pressed:', { pickup, dropoff, vehicleType });
    setSubmitting(true);
    setBookError('');
    setBookSuccess(false);
    try {
      const res = await apiPost<Ride>('/api/rides', {
        pickup_location: pickup.trim(),
        dropoff_location: dropoff.trim(),
        vehicle_type: vehicleType,
      });
      console.log('[RiderRidesScreen] Ride booked:', res.id);
      setBookSuccess(true);
      setPickup('');
      setDropoff('');
      await fetchMyRides();
    } catch (e: any) {
      console.error('[RiderRidesScreen] Book ride failed:', e);
      setBookError(e?.message || 'Failed to book ride. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = pickup.trim().length > 0 && dropoff.trim().length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: insets.top + 12, marginBottom: 24 }}>
          <Text style={styles.headerTitle}>Request a Ride</Text>
          <Text style={styles.formSubtitle}>Where are you going today?</Text>
        </View>

        {/* Booking form */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Pickup Location</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color={COLORS.primary} />
            <TextInput
              value={pickup}
              onChangeText={setPickup}
              placeholder="Enter pickup location"
              placeholderTextColor={COLORS.textTertiary}
              style={styles.textInput}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Dropoff Location</Text>
          <View style={styles.inputRow}>
            <Flag size={18} color={COLORS.accent} />
            <TextInput
              value={dropoff}
              onChangeText={setDropoff}
              placeholder="Enter destination"
              placeholderTextColor={COLORS.textTertiary}
              style={styles.textInput}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Vehicle Type</Text>
          <View style={styles.vehicleGrid}>
            {VEHICLE_TYPES.map((v) => {
              const isSelected = vehicleType === v.value;
              return (
                <AnimatedPressable
                  key={v.value}
                  onPress={() => {
                    console.log('[RiderRidesScreen] Vehicle type selected:', v.value);
                    setVehicleType(v.value);
                  }}
                  style={[styles.vehicleChipBtn, isSelected && styles.vehicleChipBtnSelected]}
                >
                  <Text style={[styles.vehicleChipBtnText, isSelected && styles.vehicleChipBtnTextSelected]}>
                    {v.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          {bookError ? (
            <Text style={styles.errorText}>{bookError}</Text>
          ) : null}

          {bookSuccess ? (
            <View style={styles.successBanner}>
              <CheckCircle size={16} color={COLORS.success} />
              <Text style={styles.successText}>Ride booked! Searching for a driver...</Text>
            </View>
          ) : null}

          <AnimatedPressable
            onPress={() => {
              console.log('[RiderRidesScreen] Book Ride button pressed');
              handleBook();
            }}
            disabled={!canSubmit || submitting}
            style={[styles.confirmBtn, (!canSubmit || submitting) && styles.confirmBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <Text style={[styles.confirmBtnText, !canSubmit && styles.confirmBtnTextDisabled]}>
                Book Ride
              </Text>
            )}
          </AnimatedPressable>
        </View>

        {/* Recent rides */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Recent Rides</Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[RiderRidesScreen] Refresh rides pressed');
              setRidesLoading(true);
              fetchMyRides();
            }}
          >
            <RefreshCw size={16} color={COLORS.textTertiary} />
          </AnimatedPressable>
        </View>

        {ridesLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : myRides.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySubtitle}>Book your first ride above!</Text>
          </View>
        ) : (
          myRides.map((ride, i) => (
            <RideHistoryCard key={ride.id} ride={ride} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function RidesScreen() {
  const { profile, profileLoading, refreshProfile } = useProfile();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const role = profile?.role ?? profile?.user_type ?? null;
  console.log('[RidesScreen] render — profileLoading:', profileLoading, 'role:', role, 'user:', user?.id ?? null);

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.noProfileCard}>
          <View style={styles.emptyIcon}>
            <Car size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.noProfileTitle}>Profile Not Available</Text>
          <Text style={styles.noProfileSubtitle}>
            Could not load your profile. Please check your connection and try again.
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[RidesScreen] Retry profile load pressed');
              refreshProfile();
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  if (role === 'driver') {
    return <DriverRidesScreen />;
  }
  return <RiderRidesScreen />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FAF7F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    fontFamily: 'Nunito_800ExtraBold',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,197,24,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(245,197,24,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    maxWidth: 260,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#5A3C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.15)',
    shadowColor: '#5A3C00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245,197,24,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F5A623',
  },
  riderAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5A623',
    fontFamily: 'Nunito_700Bold',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  vehicleChip: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  routeContainer: {
    gap: 8,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
    fontWeight: '600',
  },
  routeText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
    fontWeight: '600',
  },
  vehicleText: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 11,
    color: '#9E8A3A',
    fontFamily: 'Nunito_400Regular',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(245,197,24,0.1)',
    marginBottom: 14,
  },
  btnAccept: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnAcceptText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  btnComplete: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnCompleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  // Rider form
  formSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Nunito_600SemiBold',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.25)',
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontFamily: 'Nunito_400Regular',
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChipBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.3)',
    backgroundColor: '#FAF7F0',
  },
  vehicleChipBtnSelected: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  vehicleChipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Nunito_600SemiBold',
  },
  vehicleChipBtnTextSelected: {
    color: '#1A1A1A',
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    fontFamily: 'Nunito_400Regular',
    marginTop: 10,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(45,158,95,0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(45,158,95,0.25)',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
  },
  confirmBtn: {
    backgroundColor: '#F5A623',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  confirmBtnTextDisabled: {
    color: '#9E8A3A',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
  },
  noProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#5A3C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  noProfileTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  noProfileSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#F5A623',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
});
