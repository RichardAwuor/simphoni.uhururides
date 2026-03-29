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
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ImageSourcePropType,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPatch } from '@/utils/api';
import { MapPin, Flag, Navigation, Phone, BellOff, Car } from 'lucide-react-native';
import { useProfile } from '@/contexts/ProfileContext';
import RiderRequestScreen from '@/components/RiderRequestScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#F5C518';
const BG = '#FAF7F0';
const TEXT = '#1A1A1A';
const TEXT_SECONDARY = '#6B7280';
const POLL_INTERVAL = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequest {
  id: string;
  rider_id: string;
  driver_id: string | null;
  vehicle_type: string;
  pickup_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  distance_km?: number;
  offered_price: number;
  final_price?: number | null;
  currency?: string;
  status: string;
  rider_first_name?: string;
  rider_name?: string;
  rider_phone?: string | null;
  registration_number?: string | null;
  created_at?: string;
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
  if (km == null) return '';
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

// ─── Bargain Modal ────────────────────────────────────────────────────────────

interface BargainModalProps {
  visible: boolean;
  offeredPrice: number;
  currency: string;
  loading: boolean;
  onConfirm: (counterPrice: number) => void;
  onCancel: () => void;
}

function BargainModal({ visible, offeredPrice, currency, loading, onConfirm, onCancel }: BargainModalProps) {
  const [input, setInput] = useState('');

  const handleConfirm = () => {
    const parsed = Number(input);
    console.log('[BargainModal] Confirm pressed — counter price input:', input, 'parsed:', parsed);
    if (!parsed || parsed <= 0) return;
    onConfirm(parsed);
  };

  const handleCancel = () => {
    console.log('[BargainModal] Cancel pressed');
    setInput('');
    onCancel();
  };

  const counterPrice = Number(input) || 0;
  const counterPriceText = counterPrice > 0 ? formatPrice(counterPrice, currency) : '';
  const offeredPriceText = formatPrice(offeredPrice, currency);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.bargainModalCard}>
          <Text style={styles.bargainModalTitle}>Make a Counter Offer</Text>
          <Text style={styles.bargainModalSubtitle}>
            Rider offered:
          </Text>
          <Text style={styles.bargainModalSubtitle}>{offeredPriceText}</Text>
          <View style={styles.bargainInputWrapper}>
            <Text style={styles.bargainCurrencyLabel}>{currency}</Text>
            <TextInput
              style={styles.bargainInput}
              value={input}
              onChangeText={setInput}
              placeholder="Enter your price"
              placeholderTextColor={TEXT_SECONDARY}
              keyboardType="numeric"
              autoFocus
            />
          </View>
          {counterPriceText ? (
            <Text style={styles.bargainPreview}>{counterPriceText}</Text>
          ) : null}
          <View style={styles.bargainModalActions}>
            <AnimatedPressable onPress={handleCancel} style={styles.bargainCancelBtn} disabled={loading}>
              <Text style={styles.bargainCancelBtnText}>Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleConfirm}
              style={[styles.bargainConfirmBtn, (!input || loading) && styles.btnDisabled]}
              disabled={!input || loading}
            >
              {loading ? (
                <ActivityIndicator color={TEXT} size="small" />
              ) : (
                <Text style={styles.bargainConfirmBtnText}>Send Offer</Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Drive Request Card ───────────────────────────────────────────────────────

interface DriveRequestCardProps {
  request: RideRequest;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  onReject: (id: string) => void;
  onBargain: (id: string, counterPrice: number) => void;
  actionLoading: string | null;
}

function DriveRequestCard({ request, onAccept, onIgnore, onReject, onBargain, actionLoading }: DriveRequestCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [bargainVisible, setBargainVisible] = useState(false);
  const [bargainLoading, setBargainLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const isLoading = actionLoading === request.id;
  const currency = request.currency || 'KES';
  const riderName = request.rider_first_name || request.rider_name || 'Rider';
  const riderInitial = riderName[0].toUpperCase();
  const distanceText = formatDistance(request.distance_km);
  const priceText = formatPrice(request.offered_price, currency);
  const mapUrl = buildMapUrl(request.pickup_lat, request.pickup_lng);
  const vehicleType = String(request.vehicle_type || '').replace(/_/g, ' ');
  const regNumber = request.registration_number;

  const handleBargainConfirm = async (counterPrice: number) => {
    console.log('[DriveRequestCard] Bargain confirm — id:', request.id, 'counter_price:', counterPrice);
    setBargainLoading(true);
    try {
      await onBargain(request.id, counterPrice);
      setBargainVisible(false);
    } finally {
      setBargainLoading(false);
    }
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={styles.card}>
        {/* Rider header */}
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderAvatarText}>{riderInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{riderName}</Text>
            {distanceText ? (
              <View style={styles.distanceRow}>
                <Navigation size={12} color={TEXT_SECONDARY} />
                <Text style={styles.distanceText}>{distanceText}</Text>
              </View>
            ) : null}
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

        {/* Meta row */}
        <View style={styles.metaRow}>
          {vehicleType ? (
            <View style={styles.metaChip}>
              <Car size={12} color={TEXT_SECONDARY} />
              <Text style={styles.metaChipText}>{vehicleType}</Text>
            </View>
          ) : null}
          {regNumber ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{regNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <AnimatedPressable
            onPress={() => {
              console.log('[DriveRequestCard] Accept pressed — id:', request.id);
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
              console.log('[DriveRequestCard] Bargain pressed — id:', request.id);
              setBargainVisible(true);
            }}
            disabled={isLoading}
            style={[styles.btnBargain, isLoading && styles.btnDisabled]}
          >
            <Text style={styles.btnBargainText}>Bargain</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[DriveRequestCard] Ignore pressed — id:', request.id);
              onIgnore(request.id);
            }}
            disabled={isLoading}
            style={[styles.btnIgnore, isLoading && styles.btnDisabled]}
          >
            <Text style={styles.btnIgnoreText}>Ignore</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[DriveRequestCard] Reject pressed — id:', request.id);
              onReject(request.id);
            }}
            disabled={isLoading}
            style={[styles.btnReject, isLoading && styles.btnDisabled]}
          >
            <Text style={styles.btnRejectText}>Reject</Text>
          </AnimatedPressable>
        </View>
      </View>

      <BargainModal
        visible={bargainVisible}
        offeredPrice={Number(request.offered_price) || 0}
        currency={currency}
        loading={bargainLoading}
        onConfirm={handleBargainConfirm}
        onCancel={() => setBargainVisible(false)}
      />
    </Animated.View>
  );
}

// ─── Drive Screen (for drivers) ───────────────────────────────────────────────

function DriveScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptedRide, setAcceptedRide] = useState<AcceptedRide | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRequests = useCallback(async (silent = false) => {
    if (muted) return;
    if (!silent) setLoading(true);
    console.log('[DriveScreen] GET /api/ride-requests?status=pending&role=driver');
    try {
      const data = await apiGet<{ ride_requests?: RideRequest[]; data?: RideRequest[] } | RideRequest[]>(
        '/api/ride-requests?status=pending&role=driver'
      );
      let list: RideRequest[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray((data as any)?.ride_requests)) {
        list = (data as any).ride_requests;
      } else if (Array.isArray((data as any)?.data)) {
        list = (data as any).data;
      }
      console.log('[DriveScreen] Fetched', list.length, 'pending requests');
      setRequests(list);
    } catch (e) {
      console.error('[DriveScreen] Failed to fetch requests:', e);
    } finally {
      setLoading(false);
    }
  }, [muted]);

  useEffect(() => {
    if (muted) {
      console.log('[DriveScreen] Muted — stopping poll');
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoading(false);
      return;
    }
    console.log('[DriveScreen] Unmuted — starting poll every', POLL_INTERVAL, 'ms');
    fetchRequests();
    intervalRef.current = setInterval(() => fetchRequests(true), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [muted, fetchRequests]);

  const handleToggleMute = () => {
    const next = !muted;
    console.log('[DriveScreen] Mute toggle pressed — switching to:', next ? 'muted' : 'unmuted');
    setMuted(next);
    if (next) setRequests([]);
  };

  const handleAccept = async (id: string) => {
    console.log('[DriveScreen] PATCH /api/ride-requests/' + id + ' status=accepted');
    setActionLoading(id);
    try {
      const data = await apiPatch<{ ride_request?: RideRequest; rider_phone?: string; rider_name?: string }>(
        `/api/ride-requests/${id}`,
        { status: 'accepted' }
      );
      console.log('[DriveScreen] Accept response:', data);
      const req = requests.find((r) => r.id === id);
      const riderName = (data as any)?.rider_name ?? req?.rider_first_name ?? req?.rider_name ?? 'Rider';
      const riderPhone = (data as any)?.rider_phone ?? req?.rider_phone ?? '';
      setAcceptedRide({ rider_name: riderName, rider_phone: String(riderPhone) });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('[DriveScreen] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = (id: string) => {
    console.log('[DriveScreen] Ignore — dismissing locally, id:', id);
    setIgnoredIds((prev) => new Set([...prev, id]));
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReject = async (id: string) => {
    console.log('[DriveScreen] PATCH /api/ride-requests/' + id + ' status=rejected');
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await apiPatch(`/api/ride-requests/${id}`, { status: 'rejected' });
      console.log('[DriveScreen] Reject success — id:', id);
    } catch (e) {
      console.error('[DriveScreen] Reject failed:', e);
    }
  };

  const handleBargain = async (id: string, counterPrice: number) => {
    console.log('[DriveScreen] PATCH /api/ride-requests/' + id + ' status=bargaining counter_price:', counterPrice);
    try {
      await apiPatch(`/api/ride-requests/${id}`, { status: 'bargaining', counter_price: counterPrice });
      console.log('[DriveScreen] Bargain sent — id:', id, 'counter_price:', counterPrice);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('[DriveScreen] Bargain failed:', e);
      throw e;
    }
  };

  const muteLabel = muted ? 'Unmute requests' : 'Mute requests';
  const visibleRequests = requests.filter((r) => !ignoredIds.has(r.id));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Accept requests',
          headerShown: true,
          headerStyle: { backgroundColor: PRIMARY },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: TEXT,
            fontFamily: 'Nunito_700Bold',
          },
        }}
      />

      {/* Mute toggle bar */}
      <View style={styles.muteBar}>
        <View style={styles.muteBarLeft}>
          <BellOff size={16} color={muted ? '#92400E' : TEXT_SECONDARY} />
          <Text style={[styles.muteBarLabel, muted && styles.muteBarLabelActive]}>{muteLabel}</Text>
        </View>
        <Switch
          value={muted}
          onValueChange={() => {
            console.log('[DriveScreen] Mute switch toggled');
            handleToggleMute();
          }}
          trackColor={{ false: '#22C55E', true: '#9E9E9E' }}
          thumbColor="#fff"
        />
      </View>

      {muted ? (
        <View style={styles.mutedBanner}>
          <BellOff size={15} color="#92400E" />
          <Text style={styles.mutedBannerText}>You are not receiving ride requests</Text>
        </View>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {!muted && loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Looking for ride requests...</Text>
          </View>
        ) : !muted && visibleRequests.length > 0 ? (
          visibleRequests.map((req) => (
            <DriveRequestCard
              key={req.id}
              request={req}
              onAccept={handleAccept}
              onIgnore={handleIgnore}
              onReject={handleReject}
              onBargain={handleBargain}
              actionLoading={actionLoading}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {muted ? (
                <BellOff size={40} color={TEXT_SECONDARY} />
              ) : (
                <Car size={40} color={PRIMARY} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {muted ? 'Requests muted' : 'Waiting for passenger requests...'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {muted
                ? 'Toggle the switch above to start receiving requests'
                : 'New passenger requests will appear here automatically'}
            </Text>
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
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Loading...', headerShown: true }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const profileAny = profile as any;
  const norm = (v: any) => (typeof v === 'string' ? v.toLowerCase().trim() : '');
  const isDriver =
    norm(profileAny?.user_type).includes('driver') ||
    norm(profileAny?.role).includes('driver') ||
    norm(profileAny?.user_role).includes('driver') ||
    Object.values(profileAny ?? {}).some((v) => typeof v === 'string' && v.toLowerCase().includes('driver'));

  console.log('[RidesScreen] profile:', JSON.stringify(profileAny), 'isDriver:', isDriver);

  if (isDriver) return <DriveScreen />;

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
  muteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,197,24,0.2)',
  },
  muteBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muteBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  muteBarLabelActive: {
    color: '#92400E',
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
    maxWidth: 260,
    lineHeight: 20,
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
    marginBottom: 10,
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
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107,114,128,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
    textTransform: 'capitalize',
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
  btnReject: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  btnRejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    fontFamily: 'Nunito_600SemiBold',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  bargainModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  bargainModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  bargainModalSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
  },
  bargainInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.5)',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(245,197,24,0.05)',
  },
  bargainCurrencyLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B8860B',
    fontFamily: 'Nunito_700Bold',
    marginRight: 8,
  },
  bargainInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
    paddingVertical: 14,
  },
  bargainPreview: {
    fontSize: 13,
    color: '#22C55E',
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  bargainModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  bargainCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  bargainCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  bargainConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bargainConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
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
