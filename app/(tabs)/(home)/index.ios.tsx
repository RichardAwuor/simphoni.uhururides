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
  ImageSourcePropType,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost } from '@/utils/api';
import { MapPin, Flag, Navigation, Phone, BellOff, Bell, Car } from 'lucide-react-native';
import { useProfile } from '@/contexts/ProfileContext';
import RiderRequestScreen from '@/components/RiderRequestScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequest {
  id: string;
  rider_name: string;
  rider_phone: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  distance_km?: number;
  price_offer?: number;
  status?: string;
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

function formatPrice(price: number | undefined): string {
  if (price == null) return 'KES —';
  return `KES ${Number(price).toLocaleString()}`;
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

// ─── Ride Request Card ────────────────────────────────────────────────────────

interface CardProps {
  request: RideRequest;
  index: number;
  muted: boolean;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  onBargainSent: (id: string) => void;
  actionLoading: string | null;
}

function RideRequestCard({ request, index, muted, onAccept, onIgnore, onBargainSent, actionLoading }: CardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const [bargainOpen, setBargainOpen] = useState(false);
  const [bargainLoading, setBargainLoading] = useState(false);
  const [bargainSuccess, setBargainSuccess] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const isLoading = actionLoading === request.id;
  const price = Number(request.price_offer) || 0;

  const bargainOptions = [
    { label: '10% Up', multiplier: 1.10 },
    { label: '25% Up', multiplier: 1.25 },
    { label: '50% Up', multiplier: 1.50 },
  ];

  const handleBargain = async (multiplier: number) => {
    console.log('[RideRequestCard] Bargain pressed — id:', request.id, 'multiplier:', multiplier);
    setBargainLoading(true);
    try {
      await apiPost(`/api/ride-requests/${request.id}/bargain`, { multiplier });
      console.log('[RideRequestCard] Bargain sent successfully');
      setBargainSuccess(true);
      onBargainSent(request.id);
      setTimeout(() => {
        setBargainSuccess(false);
        setBargainOpen(false);
      }, 2000);
    } catch (e) {
      console.error('[RideRequestCard] Bargain failed:', e);
    } finally {
      setBargainLoading(false);
    }
  };

  const mapUrl = buildMapUrl(request.pickup_lat, request.pickup_lng);
  const riderInitial = (request.rider_name || 'R')[0].toUpperCase();
  const distanceText = formatDistance(request.distance_km);
  const priceText = formatPrice(request.price_offer);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={styles.card}>
        {/* Rider header */}
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderAvatarText}>{riderInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{request.rider_name || 'Rider'}</Text>
            <View style={styles.distanceRow}>
              <Navigation size={12} color={COLORS.textTertiary} />
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
            <MapPin size={15} color={COLORS.primary} />
            <Text style={styles.routeLabel} numberOfLines={2}>{request.pickup_address}</Text>
          </View>
          <View style={styles.routeDividerLine} />
          <View style={styles.routeRow}>
            <Flag size={15} color={COLORS.accent} />
            <Text style={styles.routeLabel} numberOfLines={2}>{request.destination_address}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Accept */}
          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Accept pressed — id:', request.id);
              onAccept(request.id);
            }}
            disabled={muted || isLoading}
            style={[styles.btnAccept, (muted || isLoading) && styles.btnDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.btnAcceptText, muted && styles.btnDisabledText]}>Accept</Text>
            )}
          </AnimatedPressable>

          {/* Bargain */}
          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Bargain pressed — id:', request.id);
              setBargainOpen((v) => !v);
            }}
            disabled={muted}
            style={[styles.btnBargain, muted && styles.btnDisabled]}
          >
            <Text style={[styles.btnBargainText, muted && styles.btnDisabledText]}>Bargain</Text>
          </AnimatedPressable>

          {/* Ignore */}
          <AnimatedPressable
            onPress={() => {
              console.log('[RideRequestCard] Ignore pressed — id:', request.id);
              onIgnore(request.id);
            }}
            disabled={muted || isLoading}
            style={[styles.btnIgnore, (muted || isLoading) && styles.btnDisabled]}
          >
            <Text style={[styles.btnIgnoreText, muted && styles.btnDisabledText]}>Ignore</Text>
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
                  const newPrice = Math.round(price * opt.multiplier);
                  const newPriceText = `KES ${newPrice.toLocaleString()}`;
                  return (
                    <AnimatedPressable
                      key={opt.label}
                      onPress={() => handleBargain(opt.multiplier)}
                      disabled={bargainLoading}
                      style={styles.bargainPill}
                    >
                      {bargainLoading ? (
                        <ActivityIndicator color={COLORS.text} size="small" />
                      ) : (
                        <Text style={styles.bargainPillText}>
                          {opt.label}
                        </Text>
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
                console.log('[RideRequestCard] Bargain cancel pressed');
                setBargainOpen(false);
              }}
              style={styles.bargainCancel}
            >
              <Text style={styles.bargainCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Driver Screen ────────────────────────────────────────────────────────────

function DriverRidesScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptedRide, setAcceptedRide] = useState<AcceptedRide | null>(null);
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

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[DriverRidesScreen] Fetching ride requests');
    try {
      const data = await apiGet<RideRequest[]>('/api/ride-requests');
      const list = Array.isArray(data) ? data : [];
      console.log('[DriverRidesScreen] Ride requests count:', list.length);
      setRequests(list);
    } catch (e) {
      console.error('[DriverRidesScreen] Failed to fetch ride requests:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    intervalRef.current = setInterval(() => fetchRequests(true), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRequests]);

  const handleToggleMute = async () => {
    console.log('[DriverRidesScreen] Mute/Unmute toggle pressed — current muted:', muted);
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
    console.log('[DriverRidesScreen] Accepting ride request:', id);
    setActionLoading(id);
    try {
      const data = await apiPost<{ rider_name?: string; rider_phone?: string; ride?: { rider_name?: string; rider_phone?: string } }>(`/api/ride-requests/${id}/accept`, {});
      console.log('[DriverRidesScreen] Ride accepted:', id, data);
      const riderName = data?.rider_name ?? data?.ride?.rider_name ?? requests.find((r) => r.id === id)?.rider_name ?? 'Rider';
      const riderPhone = data?.rider_phone ?? data?.ride?.rider_phone ?? requests.find((r) => r.id === id)?.rider_phone ?? '';
      setAcceptedRide({ rider_name: riderName, rider_phone: riderPhone });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('[DriverRidesScreen] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async (id: string) => {
    console.log('[DriverRidesScreen] Ignoring ride request:', id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await apiPost(`/api/ride-requests/${id}/reject`, { action: 'ignored' });
      console.log('[DriverRidesScreen] Ride ignored:', id);
    } catch (e) {
      console.error('[DriverRidesScreen] Ignore failed:', e);
    }
  };

  const handleBargainSent = (id: string) => {
    console.log('[DriverRidesScreen] Bargain sent for ride:', id);
  };

  const muteLabel = muted ? 'Muted' : 'Live';
  const muteBgColor = muted ? '#9E9E9E' : '#22C55E';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Accept Ride Requests',
          headerShown: true,
          headerStyle: { backgroundColor: '#FAF7F0' },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Nunito_700Bold',
          },
          headerRight: () => (
            <AnimatedPressable
              onPress={handleToggleMute}
              disabled={muteLoading}
              style={[styles.mutePill, { backgroundColor: muteBgColor }]}
            >
              {muteLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : muted ? (
                <>
                  <BellOff size={13} color="#fff" />
                  <Text style={styles.mutePillText}>{muteLabel}</Text>
                </>
              ) : (
                <>
                  <Bell size={13} color="#fff" />
                  <Text style={styles.mutePillText}>{muteLabel}</Text>
                </>
              )}
            </AnimatedPressable>
          ),
        }}
      />

      {muted ? (
        <View style={styles.mutedBanner}>
          <BellOff size={15} color="#92400E" />
          <Text style={styles.mutedBannerText}>
            You are muted — you cannot accept rides. Tap 'Live' to unmute.
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Incoming ride requests from riders nearby</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading ride requests...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No ride requests</Text>
            <Text style={styles.emptySubtitle}>Waiting for riders nearby...</Text>
          </View>
        ) : (
          requests.map((req, i) => (
            <RideRequestCard
              key={req.id}
              request={req}
              index={i}
              muted={muted}
              onAccept={handleAccept}
              onIgnore={handleIgnore}
              onBargainSent={handleBargainSent}
              actionLoading={actionLoading}
            />
          ))
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
        <Stack.Screen options={{ title: 'Rides', headerShown: true, headerStyle: { backgroundColor: '#FAF7F0' } }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const userRole = profile?.role || (profile as any)?.user_type || (profile as any)?.user_role;
  const isDriver = userRole === 'driver';

  console.log('[RidesScreen] role-branch — userRole:', userRole, 'isDriver:', isDriver);

  if (isDriver) {
    return <DriverRidesScreen />;
  }

  // rider (or unknown role — default to rider UI)
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Request a Ride',
          headerShown: true,
          headerStyle: { backgroundColor: '#FAF7F0' },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#1A1A1A',
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
    backgroundColor: '#FAF7F0',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
  },
  mutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 4,
    minWidth: 72,
    justifyContent: 'center',
  },
  mutePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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
    paddingTop: 60,
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
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
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
    borderColor: '#F5C518',
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
    color: '#1A1A1A',
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
    color: '#888',
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
    color: '#1A1A1A',
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
    paddingVertical: 11,
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
    backgroundColor: '#F5C518',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBargainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  btnIgnore: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  btnIgnoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Nunito_600SemiBold',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnDisabledText: {
    opacity: 0.6,
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
    color: '#888',
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
    backgroundColor: '#F5C518',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  bargainPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
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
    color: '#888',
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
    color: '#1A1A1A',
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  modalEmoji: {
    fontSize: 40,
  },
  modalRiderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  modalPhoneLabel: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 4,
  },
  modalPhone: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
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
    color: '#6B7280',
    fontFamily: 'Nunito_600SemiBold',
  },
});
