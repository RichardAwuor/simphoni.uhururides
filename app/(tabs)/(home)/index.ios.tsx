import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Modal,
  Linking,
  Image,
  TouchableOpacity,
  Switch,
  ImageSourcePropType,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost } from '@/utils/api';
import { MapPin, Flag, Navigation, Phone, BellOff, Car } from 'lucide-react-native';
import { useProfile } from '@/contexts/ProfileContext';
import RiderRequestScreen from '@/components/RiderRequestScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#F5C518';
const BG = '#FAF7F0';
const TEXT = '#1A1A1A';
const TEXT_SECONDARY = '#6B7280';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequest {
  id: string;
  rider_id: string;
  driver_id: string | null;
  vehicle_type: string;
  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  destination: string;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  offered_price: number;
  final_price: number | null;
  currency: string;
  status: string;
  driver_attempt_count: number;
  rider_first_name: string;
  rider_phone: string | null;
  created_at: string;
}

interface AcceptedRide {
  rider_name: string;
  rider_phone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function formatPrice(price: number | undefined, currency?: string): string {
  if (price == null) return `${currency ?? 'KES'} —`;
  return `${currency ?? 'KES'} ${Number(price).toLocaleString()}`;
}

function formatDistance(km: number | undefined): string {
  if (km == null) return '— km';
  return `${Number(km).toFixed(1)} km`;
}

function buildMapUrl(lat?: number, lng?: number): string {
  if (!lat || !lng) return '';
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=300x120&markers=${lat},${lng},red`;
}

// ─── Accept Modal ─────────────────────────────────────────────────────────────

function AcceptModal({ ride, onClose }: { ride: AcceptedRide | null; onClose: () => void }) {
  if (!ride) return null;

  const handleCall = () => {
    console.log('[AcceptModal] Call Rider pressed:', ride.rider_phone);
    Linking.openURL(`tel:${ride.rider_phone}`);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Ride Accepted!</Text>
          <Text style={styles.modalEmoji}>🎉</Text>
          <Text style={styles.modalRiderName}>{ride.rider_name}</Text>
          <Text style={styles.modalPhoneLabel}>Rider's Phone:</Text>
          <Text selectable style={styles.modalPhone}>{ride.rider_phone}</Text>
          <AnimatedPressable onPress={handleCall} style={styles.callBtn}>
            <Phone size={18} color="#fff" />
            <Text style={styles.callBtnText}>Call Rider</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Driver Ride Card ─────────────────────────────────────────────────────────

interface DriverCardProps {
  request: RideRequest;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  onBargainSent: (id: string) => void;
  actionLoading: string | null;
  bargainWaiting: boolean;
}

function DriverRideCard({ request, onAccept, onIgnore, onBargainSent, actionLoading, bargainWaiting }: DriverCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [bargainOpen, setBargainOpen] = useState(false);
  const [bargainLoading, setBargainLoading] = useState(false);
  const [bargainSuccess, setBargainSuccess] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const isLoading = actionLoading === request.id;
  const offeredPrice = Number(request.offered_price) || 0;
  const currency = request.currency || 'KES';

  const bargainOptions = [
    { label: '10% Up', percent: 10, multiplier: 1.10 },
    { label: '25% Up', percent: 25, multiplier: 1.25 },
    { label: '50% Up', percent: 50, multiplier: 1.50 },
  ];

  const handleBargain = async (percent: number, multiplier: number) => {
    console.log('[DriverRideCard] Bargain pressed — id:', request.id, 'percent:', percent);
    setBargainLoading(true);
    try {
      await apiPost(`/api/ride-requests/${request.id}/bargain`, { bargain_percent: percent });
      console.log('[DriverRideCard] Bargain sent successfully — percent:', percent);
      setBargainSuccess(true);
      onBargainSent(request.id);
      setTimeout(() => {
        setBargainSuccess(false);
        setBargainOpen(false);
      }, 2000);
    } catch (e) {
      console.error('[DriverRideCard] Bargain failed:', e);
    } finally {
      setBargainLoading(false);
    }
  };

  const mapUrl = buildMapUrl(request.pickup_lat, request.pickup_lng);
  const riderInitial = (request.rider_first_name || 'R')[0].toUpperCase();
  const distanceText = formatDistance(request.distance_km);
  const priceText = formatPrice(request.offered_price, currency);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={styles.card}>
        {/* Rider header */}
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderAvatarText}>{riderInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{request.rider_first_name || 'Rider'}</Text>
            <View style={styles.distanceRow}>
              <Navigation size={12} color={TEXT_SECONDARY} />
              <Text style={styles.distanceText}>{distanceText}</Text>
            </View>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{priceText}</Text>
          </View>
        </View>

        {/* Map thumbnail */}
        {mapUrl ? (
          <Image
            source={resolveImageSource(mapUrl)}
            style={styles.mapThumb}
            resizeMode="cover"
          />
        ) : null}

        {/* Route */}
        <View style={styles.routeContainer}>
          <View style={styles.routeRow}>
            <MapPin size={15} color={PRIMARY} />
            <Text style={styles.routeLabel} numberOfLines={2}>{request.pickup_location}</Text>
          </View>
          <View style={styles.routeDividerLine} />
          <View style={styles.routeRow}>
            <Flag size={15} color="#EF4444" />
            <Text style={styles.routeLabel} numberOfLines={2}>{request.destination}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bargain waiting state */}
        {bargainWaiting ? (
          <View style={styles.bargainWaitingBanner}>
            <ActivityIndicator size="small" color="#B8860B" />
            <Text style={styles.bargainWaitingText}>Bargain sent — waiting for rider response...</Text>
          </View>
        ) : (
          <>
            {/* Action buttons */}
            <View style={styles.actionRow}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[DriverRideCard] Accept pressed — id:', request.id);
                  onAccept(request.id);
                }}
                disabled={isLoading}
                style={[styles.btnAccept, isLoading && styles.btnDisabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnAcceptText}>Accept</Text>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  console.log('[DriverRideCard] Bargain toggle pressed — id:', request.id);
                  setBargainOpen((v) => !v);
                }}
                style={styles.btnBargain}
              >
                <Text style={styles.btnBargainText}>Bargain</Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  console.log('[DriverRideCard] Ignore pressed — id:', request.id);
                  onIgnore(request.id);
                }}
                disabled={isLoading}
                style={[styles.btnIgnore, isLoading && styles.btnDisabled]}
              >
                <Text style={styles.btnIgnoreText}>Ignore</Text>
              </AnimatedPressable>
            </View>

            {/* Bargain expansion */}
            {bargainOpen ? (
              <View style={styles.bargainPanel}>
                <Text style={styles.bargainLabel}>Counter offer:</Text>
                {bargainSuccess ? (
                  <View style={styles.bargainSuccessBanner}>
                    <Text style={styles.bargainSuccessText}>Bargain sent to rider!</Text>
                  </View>
                ) : (
                  <View style={styles.bargainPills}>
                    {bargainOptions.map((opt) => {
                      const newPrice = Math.round(offeredPrice * opt.multiplier);
                      const newPriceText = `${currency} ${newPrice.toLocaleString()}`;
                      return (
                        <AnimatedPressable
                          key={opt.label}
                          onPress={() => handleBargain(opt.percent, opt.multiplier)}
                          disabled={bargainLoading}
                          style={styles.bargainPill}
                        >
                          {bargainLoading ? (
                            <ActivityIndicator color={TEXT} size="small" />
                          ) : (
                            <Text style={styles.bargainPillText}>{opt.label}</Text>
                          )}
                          {!bargainLoading ? (
                            <Text style={styles.bargainPillPrice}>{newPriceText}</Text>
                          ) : null}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => {
                    console.log('[DriverRideCard] Bargain cancel pressed');
                    setBargainOpen(false);
                  }}
                  style={styles.bargainCancel}
                >
                  <Text style={styles.bargainCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Driver Screen ────────────────────────────────────────────────────────────

function DriverRidesScreen() {
  const insets = useSafeAreaInsets();
  const [currentRequest, setCurrentRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptedRide, setAcceptedRide] = useState<AcceptedRide | null>(null);
  const [bargainWaiting, setBargainWaiting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchMuteState = async () => {
      console.log('[DriverRidesScreen] Fetching mute state');
      try {
        const data = await apiGet<{ muted: boolean }>('/api/driver/mute');
        const isMuted = !!data?.muted;
        console.log('[DriverRidesScreen] Mute state:', isMuted);
        setMuted(isMuted);
      } catch (e) {
        console.error('[DriverRidesScreen] Failed to fetch mute state:', e);
      }
    };
    fetchMuteState();
  }, []);

  const fetchCurrentRequest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[DriverRidesScreen] Polling GET /api/ride-requests/driver/current');
    try {
      const data = await apiGet<{ ride_request: RideRequest | null }>('/api/ride-requests/driver/current');
      const req = data?.ride_request ?? null;
      console.log('[DriverRidesScreen] Current request:', req?.id ?? 'none', 'status:', req?.status ?? 'none');
      setCurrentRequest(req);

      if (bargainWaiting && req) {
        if (req.status === 'accepted') {
          console.log('[DriverRidesScreen] Bargain accepted by rider');
          setBargainWaiting(false);
        } else if (req.status === 'pending') {
          console.log('[DriverRidesScreen] Bargain rejected by rider, clearing card');
          setBargainWaiting(false);
          setCurrentRequest(null);
        }
      }
    } catch (e) {
      console.error('[DriverRidesScreen] Failed to fetch current request:', e);
    } finally {
      setLoading(false);
    }
  }, [bargainWaiting]);

  useEffect(() => {
    fetchCurrentRequest();
    intervalRef.current = setInterval(() => fetchCurrentRequest(true), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCurrentRequest]);

  const handleToggleMute = async () => {
    console.log('[DriverRidesScreen] Mute toggle pressed — current muted:', muted);
    setMuteLoading(true);
    try {
      const data = await apiPost<{ muted: boolean }>('/api/driver/mute', { muted: !muted });
      const newMuted = data?.muted ?? !muted;
      console.log('[DriverRidesScreen] Mute toggled to:', newMuted);
      setMuted(newMuted);
    } catch (e) {
      console.error('[DriverRidesScreen] Mute toggle failed:', e);
      setMuted((prev) => !prev);
    } finally {
      setMuteLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    console.log('[DriverRidesScreen] POST /api/ride-requests/' + id + '/accept');
    setActionLoading(id);
    try {
      const data = await apiPost<{ success: boolean; rider_phone?: string; rider_name?: string }>(`/api/ride-requests/${id}/accept`, {});
      console.log('[DriverRidesScreen] Ride accepted response:', data);
      const riderName = data?.rider_name ?? currentRequest?.rider_first_name ?? 'Rider';
      const riderPhone = data?.rider_phone ?? currentRequest?.rider_phone ?? '';
      setAcceptedRide({ rider_name: riderName, rider_phone: riderPhone });
      setCurrentRequest(null);
    } catch (e) {
      console.error('[DriverRidesScreen] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async (id: string) => {
    console.log('[DriverRidesScreen] POST /api/ride-requests/' + id + '/reject — action: ignored');
    setCurrentRequest(null);
    try {
      await apiPost(`/api/ride-requests/${id}/reject`, { action: 'ignored' });
      console.log('[DriverRidesScreen] Ride ignored:', id);
    } catch (e) {
      console.error('[DriverRidesScreen] Ignore failed:', e);
    }
  };

  const handleBargainSent = (id: string) => {
    console.log('[DriverRidesScreen] Bargain sent for ride:', id, '— entering wait state');
    setBargainWaiting(true);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Rides',
          headerShown: true,
          headerStyle: { backgroundColor: PRIMARY },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: TEXT,
            fontFamily: 'Nunito_700Bold',
          },
          headerRight: () => (
            <View style={styles.muteToggleRow}>
              <Text style={styles.muteToggleLabel}>{muted ? 'Muted' : 'Live'}</Text>
              {muteLoading ? (
                <ActivityIndicator size="small" color={TEXT} style={{ marginRight: 8 }} />
              ) : (
                <Switch
                  value={!muted}
                  onValueChange={() => {
                    console.log('[DriverRidesScreen] Mute switch toggled');
                    handleToggleMute();
                  }}
                  trackColor={{ false: '#9E9E9E', true: '#22C55E' }}
                  thumbColor="#fff"
                  style={{ marginRight: 8 }}
                />
              )}
            </View>
          ),
        }}
      />

      {muted ? (
        <View style={styles.mutedBanner}>
          <BellOff size={15} color="#92400E" />
          <Text style={styles.mutedBannerText}>
            You are muted — not receiving ride requests
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Looking for ride requests...</Text>
          </View>
        ) : currentRequest ? (
          <DriverRideCard
            request={currentRequest}
            onAccept={handleAccept}
            onIgnore={handleIgnore}
            onBargainSent={handleBargainSent}
            actionLoading={actionLoading}
            bargainWaiting={bargainWaiting}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={40} color={PRIMARY} />
            </View>
            <Text style={styles.emptyTitle}>No ride requests yet</Text>
            <Text style={styles.emptySubtitle}>Waiting for riders nearby...</Text>
          </View>
        )}
      </ScrollView>

      <AcceptModal ride={acceptedRide} onClose={() => setAcceptedRide(null)} />
    </View>
  );
}

// ─── Root Screen (role-branching) ─────────────────────────────────────────────

export default function RidesScreen() {
  const { profile, profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Rides', headerShown: true, headerStyle: { backgroundColor: BG } }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  const normalizeRole = (val: any) => typeof val === 'string' ? val.toLowerCase() : '';
  const isDriver =
    normalizeRole(profile?.role) === 'driver' ||
    normalizeRole((profile as any)?.user_type) === 'driver' ||
    normalizeRole((profile as any)?.user_role) === 'driver';

  console.log('[RidesScreen] role-branch — role:', profile?.role, 'isDriver:', isDriver);

  if (isDriver) {
    return <DriverRidesScreen />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Request a Ride',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: TEXT,
            fontFamily: 'Nunito_700Bold',
          },
        }}
      />
      <RiderRequestScreen />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  muteToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muteToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  mutedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mutedBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(245,197,24,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    maxWidth: 240,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.18)',
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  riderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(245,197,24,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  riderAvatarText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F5A623',
    fontFamily: 'Nunito_700Bold',
  },
  riderName: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  distanceText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  priceBadge: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.35)',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B8860B',
    fontFamily: 'Nunito_700Bold',
  },
  mapThumb: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#E8E8E8',
  },
  routeContainer: {
    gap: 6,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeDividerLine: {
    height: 1,
    backgroundColor: 'rgba(245,197,24,0.1)',
    marginLeft: 25,
  },
  routeLabel: {
    fontSize: 13,
    color: TEXT,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(245,197,24,0.1)',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAcceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  btnBargain: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBargainText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  btnIgnore: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  btnIgnoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  bargainWaitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.3)',
  },
  bargainWaitingText: {
    flex: 1,
    fontSize: 13,
    color: '#B8860B',
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
  },
  bargainPanel: {
    marginTop: 12,
    backgroundColor: 'rgba(245,197,24,0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  bargainLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
    marginBottom: 10,
  },
  bargainPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  bargainPill: {
    flex: 1,
    minWidth: 90,
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  bargainPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  bargainPillPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4A00',
    fontFamily: 'Nunito_600SemiBold',
  },
  bargainSuccessBanner: {
    backgroundColor: 'rgba(45,158,95,0.12)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,158,95,0.25)',
  },
  bargainSuccessText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D9E5F',
    fontFamily: 'Nunito_600SemiBold',
  },
  bargainCancel: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  bargainCancelText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  modalEmoji: {
    fontSize: 40,
  },
  modalRiderName: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  modalPhoneLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    marginTop: 4,
  },
  modalPhone: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 1,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  callBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
});
