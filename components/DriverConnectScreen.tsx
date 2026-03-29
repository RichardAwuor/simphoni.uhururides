import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Switch,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Car, ArrowRight } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost } from '@/utils/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = '#FAF7F0';
const CARD_BG = '#FFFFFF';
const TEXT = '#1A1A1A';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const PRIMARY = '#F5C518';
const PRIMARY_DARK = '#F5A623';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';
const RED = '#EF4444';

const CARD_STYLE = {
  backgroundColor: CARD_BG,
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
  marginBottom: 16,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequest {
  id: string;
  passenger_name?: string;
  passenger?: { full_name?: string; name?: string };
  pickup_location: string;
  destination: string;
  price_offer: number;
  offered_price?: number;
  currency?: string;
  created_at: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hr ago';
  return `${diffHr} hrs ago`;
}

function getPassengerName(req: RideRequest): string {
  const name =
    req.passenger_name ||
    req.passenger?.full_name ||
    req.passenger?.name ||
    'Passenger';
  return String(name);
}

function getPrice(req: RideRequest): string {
  const price = req.price_offer ?? req.offered_price ?? 0;
  const currency = String(req.currency || 'KES').toUpperCase();
  return `${currency} ${Number(price).toLocaleString()}`;
}

// ─── Ride Request Card ────────────────────────────────────────────────────────

interface CardProps {
  request: RideRequest;
  onRemove: (id: string) => void;
  entranceDelay: number;
}

function RideRequestCard({ request, onRemove, entranceDelay }: CardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bargainOpen, setBargainOpen] = useState(false);
  const [bargainInput, setBargainInput] = useState('');
  const [bargainSent, setBargainSent] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.spring(entranceAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }).start();
    }, entranceDelay);
    return () => clearTimeout(timer);
  }, []);

  const passengerName = getPassengerName(request);
  const priceDisplay = getPrice(request);
  const timeDisplay = timeAgo(request.created_at);
  const pickupDisplay = request.pickup_location || '—';
  const destDisplay = request.destination || '—';

  const handleAccept = async () => {
    console.log('[DriverConnect] Accept pressed — rideId:', request.id);
    setActionLoading('accept');
    try {
      await apiPost(`/api/ride-requests/${request.id}/accept`, {});
      console.log('[DriverConnect] Ride accepted — rideId:', request.id);
      setSuccessMsg('Ride accepted! Contact the passenger.');
      setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onRemove(request.id);
      }, 1800);
    } catch (e: any) {
      console.error('[DriverConnect] Accept failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBargainToggle = () => {
    console.log('[DriverConnect] Bargain button pressed — rideId:', request.id);
    setBargainOpen((v) => !v);
  };

  const handleSendBargain = async () => {
    const price = Number(bargainInput);
    if (!price || isNaN(price)) return;
    console.log('[DriverConnect] Send bargain pressed — rideId:', request.id, 'price:', price);
    setActionLoading('bargain');
    try {
      await apiPost(`/api/ride-requests/${request.id}/bargain`, { bargain_price: price });
      console.log('[DriverConnect] Bargain sent — rideId:', request.id, 'price:', price);
      setBargainSent(true);
      setBargainOpen(false);
    } catch (e: any) {
      console.error('[DriverConnect] Bargain failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async () => {
    console.log('[DriverConnect] Ignore pressed — rideId:', request.id);
    setActionLoading('ignore');
    try {
      await apiPost(`/api/ride-requests/${request.id}/ignore`, {});
      console.log('[DriverConnect] Ride ignored — rideId:', request.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onRemove(request.id);
    } catch (e: any) {
      console.error('[DriverConnect] Ignore failed:', e);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onRemove(request.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    console.log('[DriverConnect] Reject pressed — rideId:', request.id);
    setActionLoading('reject');
    try {
      await apiPost(`/api/ride-requests/${request.id}/reject`, {});
      console.log('[DriverConnect] Ride rejected — rideId:', request.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onRemove(request.id);
    } catch (e: any) {
      console.error('[DriverConnect] Reject failed:', e);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onRemove(request.id);
    } finally {
      setActionLoading(null);
    }
  };

  const cardOpacity = entranceAnim;
  const cardTranslateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Animated.View
      style={[
        s.requestCard,
        { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
      ]}
    >
      {/* Success banner */}
      {successMsg ? (
        <View style={s.successBanner}>
          <Text style={s.successBannerText}>{successMsg}</Text>
        </View>
      ) : null}

      {/* Header row: name + time */}
      <View style={s.cardHeader}>
        <Text style={s.passengerName}>{passengerName}</Text>
        <Text style={s.timeAgo}>{timeDisplay}</Text>
      </View>

      {/* Route row */}
      <View style={s.routeRow}>
        <Text style={s.routeText} numberOfLines={1}>{pickupDisplay}</Text>
        <ArrowRight size={14} color={TEXT_TERTIARY} style={{ marginHorizontal: 6 }} />
        <Text style={s.routeText} numberOfLines={1}>{destDisplay}</Text>
      </View>

      {/* Price */}
      <Text style={s.priceText}>{priceDisplay}</Text>

      {/* Bargain sent confirmation */}
      {bargainSent ? (
        <View style={s.bargainSentBadge}>
          <Text style={s.bargainSentText}>Counter-offer sent</Text>
        </View>
      ) : null}

      {/* Inline bargain input */}
      {bargainOpen ? (
        <View style={s.bargainInputRow}>
          <TextInput
            style={s.bargainInput}
            placeholder="Enter counter-price"
            placeholderTextColor={TEXT_TERTIARY}
            value={bargainInput}
            onChangeText={setBargainInput}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <AnimatedPressable
            onPress={handleSendBargain}
            disabled={actionLoading === 'bargain' || !bargainInput}
            style={[s.sendOfferBtn, (!bargainInput || actionLoading === 'bargain') && s.btnDisabled]}
          >
            {actionLoading === 'bargain' ? (
              <ActivityIndicator color="#1A1A1A" size="small" />
            ) : (
              <Text style={s.sendOfferBtnText}>Send offer</Text>
            )}
          </AnimatedPressable>
        </View>
      ) : null}

      {/* Action buttons 2x2 grid */}
      <View style={s.actionsGrid}>
        {/* Accept */}
        <AnimatedPressable
          onPress={handleAccept}
          disabled={!!actionLoading || !!successMsg}
          style={[s.actionBtn, s.acceptBtn, (!!actionLoading || !!successMsg) && s.btnDisabled]}
        >
          {actionLoading === 'accept' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.acceptBtnText}>Accept</Text>
          )}
        </AnimatedPressable>

        {/* Bargain */}
        <AnimatedPressable
          onPress={handleBargainToggle}
          disabled={!!actionLoading || !!successMsg || bargainSent}
          style={[s.actionBtn, s.bargainBtn, (!!actionLoading || !!successMsg || bargainSent) && s.btnDisabled]}
        >
          <Text style={s.bargainBtnText}>{bargainOpen ? 'Cancel' : 'Bargain'}</Text>
        </AnimatedPressable>

        {/* Ignore */}
        <AnimatedPressable
          onPress={handleIgnore}
          disabled={!!actionLoading || !!successMsg}
          style={[s.actionBtn, s.ignoreBtn, (!!actionLoading || !!successMsg) && s.btnDisabled]}
        >
          {actionLoading === 'ignore' ? (
            <ActivityIndicator color={TEXT_SECONDARY} size="small" />
          ) : (
            <Text style={s.ignoreBtnText}>Ignore</Text>
          )}
        </AnimatedPressable>

        {/* Reject */}
        <AnimatedPressable
          onPress={handleReject}
          disabled={!!actionLoading || !!successMsg}
          style={[s.actionBtn, s.rejectBtn, (!!actionLoading || !!successMsg) && s.btnDisabled]}
        >
          {actionLoading === 'reject' ? (
            <ActivityIndicator color={RED} size="small" />
          ) : (
            <Text style={s.rejectBtnText}>Reject</Text>
          )}
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriverConnectScreen() {
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(true);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial mute state
  useEffect(() => {
    const loadMuteStatus = async () => {
      console.log('[DriverConnect] Loading mute status from GET /api/driver/mute-status');
      try {
        const data = await apiGet<{ muted: boolean }>('/api/driver/mute-status');
        console.log('[DriverConnect] Mute status loaded:', data.muted);
        setMuted(!!data.muted);
      } catch (e) {
        console.error('[DriverConnect] Failed to load mute status:', e);
      } finally {
        setMuteLoading(false);
      }
    };
    loadMuteStatus();
  }, []);

  // Fetch ride requests
  const fetchRequests = useCallback(async () => {
    console.log('[DriverConnect] Polling GET /api/ride-requests?status=pending&role=driver');
    try {
      const data = await apiGet<RideRequest[] | { data?: RideRequest[]; ride_requests?: RideRequest[] }>(
        '/api/ride-requests?status=pending&role=driver'
      );
      const list: RideRequest[] = Array.isArray(data)
        ? data
        : (data as any).data ?? (data as any).ride_requests ?? [];
      console.log('[DriverConnect] Ride requests fetched — count:', list.length);
      setRequests(list);
    } catch (e) {
      console.error('[DriverConnect] Failed to fetch ride requests:', e);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Start/stop polling based on mute state
  useEffect(() => {
    if (muteLoading) return;
    if (muted) {
      if (pollRef.current) clearInterval(pollRef.current);
      setRequests([]);
      return;
    }
    setListLoading(true);
    fetchRequests();
    pollRef.current = setInterval(fetchRequests, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [muted, muteLoading, fetchRequests]);

  const handleMuteToggle = async (value: boolean) => {
    console.log('[DriverConnect] Mute toggle pressed — new value:', value);
    setMuted(value);
    try {
      await apiPost('/api/driver/mute', { muted: value });
      console.log('[DriverConnect] Mute state saved:', value);
    } catch (e) {
      console.error('[DriverConnect] Failed to save mute state:', e);
    }
  };

  const handleRemoveRequest = useCallback((id: string) => {
    console.log('[DriverConnect] Removing request from list — id:', id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Status indicator values
  const statusDotColor = muted ? '#9CA3AF' : GREEN;
  const statusText = muted ? 'Muted — not receiving requests' : 'Online — receiving requests';

  const renderItem = ({ item, index }: { item: RideRequest; index: number }) => (
    <RideRequestCard
      request={item}
      onRemove={handleRemoveRequest}
      entranceDelay={index * 80}
    />
  );

  const keyExtractor = (item: RideRequest) => item.id;

  const ListEmpty = () => (
    <View style={s.emptyState}>
      <View style={s.emptyIconCircle}>
        <Car size={36} color={TEXT_TERTIARY} />
      </View>
      <Text style={s.emptyTitle}>No requests yet</Text>
      <Text style={s.emptySubtitle}>New ride requests will appear here</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={muted ? [] : requests}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={muted ? null : listLoading ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={PRIMARY_DARK} size="large" />
          </View>
        ) : <ListEmpty />}
        contentContainerStyle={[
          s.listContent,
          { paddingTop: 16, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Status card */}
            <View style={[CARD_STYLE, s.statusCard]}>
              <View style={s.statusRow}>
                <View style={[s.statusDot, { backgroundColor: statusDotColor }]} />
                <Text style={s.statusText}>{statusText}</Text>
              </View>
            </View>

            {/* Mute toggle card */}
            <View style={[CARD_STYLE, s.muteCard]}>
              <Text style={s.muteLabel}>Mute ride requests</Text>
              {muteLoading ? (
                <ActivityIndicator color={PRIMARY_DARK} size="small" />
              ) : (
                <Switch
                  value={muted}
                  onValueChange={handleMuteToggle}
                  trackColor={{ false: '#E5E7EB', true: PRIMARY }}
                  thumbColor={muted ? PRIMARY_DARK : '#FFFFFF'}
                  ios_backgroundColor="#E5E7EB"
                />
              )}
            </View>

            {/* Section header */}
            {!muted ? (
              <Text style={s.sectionHeader}>Incoming Requests</Text>
            ) : null}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
  },

  // Status card
  statusCard: {
    borderLeftWidth: 4,
    borderLeftColor: GREEN,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },

  // Mute card
  muteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muteLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
    fontFamily: 'Nunito_600SemiBold',
  },

  // Section header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  // Request card
  requestCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerName: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    flex: 1,
    marginRight: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: TEXT_TERTIARY,
    fontFamily: 'Nunito_400Regular',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: PRIMARY_DARK,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 14,
  },

  // Bargain
  bargainInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  bargainInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT,
    fontFamily: 'Nunito_400Regular',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendOfferBtn: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  sendOfferBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  bargainSentBadge: {
    backgroundColor: 'rgba(245,159,11,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,159,11,0.3)',
  },
  bargainSentText: {
    fontSize: 12,
    fontWeight: '600',
    color: AMBER,
    fontFamily: 'Nunito_600SemiBold',
  },

  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    width: '47.5%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: GREEN,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Nunito_700Bold',
  },
  bargainBtn: {
    backgroundColor: AMBER,
  },
  bargainBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  ignoreBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  ignoreBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: RED,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: RED,
    fontFamily: 'Nunito_600SemiBold',
  },
  btnDisabled: {
    opacity: 0.4,
  },

  // Success banner
  successBanner: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_TERTIARY,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    maxWidth: 220,
  },

  // Loading state
  loadingState: {
    alignItems: 'center',
    paddingTop: 48,
  },
});
