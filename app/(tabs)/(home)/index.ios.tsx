import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { RideRequestCard, RideRequest } from '@/components/RideRequestCard';
import { apiGet, apiPost, apiPut } from '@/utils/api';
import { MapPin, Flag, Car, X, Phone, CheckCircle, ArrowRight } from 'lucide-react-native';

interface ActiveRide {
  id: string;
  status: string;
  pickup_location: string;
  destination: string;
  price_offer: number;
  currency: string;
  driver_first_name?: string;
  driver_phone?: string;
  bargain_price?: number;
}

interface CompletedRideData {
  id: string;
  pickup_location: string;
  destination: string;
  price_offer: number;
  currency: string;
  rider_first_name?: string;
  distance_km?: number;
}

const COUNTRY_CURRENCY: Record<string, string> = {
  kenya: 'KES',
  tanzania: 'TZS',
  uganda: 'UGX',
};

function formatCurrency(amount: number, currency: string): string {
  const num = Number(amount);
  return `${String(currency).toUpperCase()} ${num.toLocaleString()}`;
}

function SkeletonCard() {
  return (
    <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, gap: 10 }}>
      {[80, 120, 60].map((w, i) => (
        <View key={i} style={{ height: 14, width: w, borderRadius: 7, backgroundColor: COLORS.primaryMuted }} />
      ))}
    </View>
  );
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
    <View style={{ backgroundColor: `${color}18`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: `${color}40` }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color, fontFamily: 'Nunito_600SemiBold', textTransform: 'capitalize' }}>
        {status}
      </Text>
    </View>
  );
}

// ─── Ride Summary Modal ───────────────────────────────────────────────────────

interface RideSummaryModalProps {
  ride: CompletedRideData | null;
  onDone: () => void;
  completing: boolean;
}

function RideSummaryModal({ ride, onDone, completing }: RideSummaryModalProps) {
  if (!ride) return null;

  const currencyLabel = String(ride.currency).toUpperCase();
  const fareAmount = Number(ride.price_offer).toLocaleString();
  const riderName = ride.rider_first_name || 'Rider';
  const hasDistance = ride.distance_km != null;
  const distanceText = hasDistance ? `${Number(ride.distance_km).toFixed(1)} km` : '';

  return (
    <Modal visible={!!ride} transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 24,
            padding: 28,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {/* Checkmark */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(45,158,95,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle size={64} color={COLORS.success} strokeWidth={1.5} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#1A1A1A',
              fontFamily: 'Nunito_800ExtraBold',
              marginBottom: 20,
            }}
          >
            Ride Complete!
          </Text>

          {/* Fare box */}
          <View
            style={{
              backgroundColor: COLORS.primaryMuted,
              borderRadius: 16,
              paddingVertical: 20,
              paddingHorizontal: 32,
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: COLORS.primaryBorder,
              width: '100%',
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: '#E63946',
                  fontFamily: 'Nunito_800ExtraBold',
                }}
              >
                {currencyLabel}
              </Text>
              <Text
                style={{
                  fontSize: 48,
                  fontWeight: '800',
                  color: '#E63946',
                  fontFamily: 'Nunito_800ExtraBold',
                  letterSpacing: -1,
                }}
              >
                {fareAmount}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                color: '#5C4A00',
                fontFamily: 'Nunito_600SemiBold',
                marginTop: 4,
              }}
            >
              Final Fare
            </Text>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: COLORS.divider, width: '100%', marginBottom: 16 }} />

          {/* Route row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12 }}>
            <MapPin size={16} color={COLORS.primary} />
            <Text style={{ fontSize: 13, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {ride.pickup_location}
            </Text>
            <ArrowRight size={14} color={COLORS.textTertiary} />
            <Flag size={16} color={COLORS.accent} />
            <Text style={{ fontSize: 13, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>
              {ride.destination}
            </Text>
          </View>

          {/* Rider + distance row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
                  {riderName[0].toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>
                {riderName}
              </Text>
            </View>
            {hasDistance ? (
              <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold' }}>
                {distanceText}
              </Text>
            ) : null}
          </View>

          {/* Done button */}
          <AnimatedPressable
            onPress={onDone}
            disabled={completing}
            style={{
              backgroundColor: '#F5C518',
              borderRadius: 16,
              height: 56,
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {completing ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#1A1A1A', fontFamily: 'Nunito_800ExtraBold' }}>
                Done — Collect Fare
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Driver View ──────────────────────────────────────────────────────────────

function DriverView() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isAvailable, setIsAvailable] = useState(true);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptModal, setAcceptModal] = useState<{ riderPhone: string } | null>(null);
  const [bargainModal, setBargainModal] = useState<{ id: string; price: number; currency: string } | null>(null);
  const [completedRide, setCompletedRide] = useState<CompletedRideData | null>(null);
  const [completing, setCompleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[DriverView] Fetching nearby requests');
    try {
      const data = await apiGet<{ requests: RideRequest[] }>('/api/driver/nearby-requests');
      setRequests(data.requests || []);
    } catch (e) {
      console.error('[DriverView] Failed to fetch requests:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    intervalRef.current = setInterval(() => fetchRequests(true), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchRequests]);

  const toggleAvailability = async (val: boolean) => {
    console.log('[DriverView] Toggle availability:', val);
    setIsAvailable(val);
    try {
      await apiPut('/api/driver/availability', { is_available: val });
    } catch (e) {
      console.error('[DriverView] Failed to update availability:', e);
      setIsAvailable(!val);
    }
  };

  const handleAccept = async (id: string) => {
    console.log('[DriverView] Accepting ride:', id);
    try {
      const res = await apiPost<{ success: boolean; rider_phone: string }>(`/api/rides/${id}/accept`, {});
      setAcceptModal({ riderPhone: res.rider_phone || '' });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.error('[DriverView] Accept failed:', e); }
  };

  const handleBargain = (id: string, price: number, currency: string) => {
    console.log('[DriverView] Opening bargain for ride:', id);
    setBargainModal({ id, price, currency });
  };

  const submitBargain = async (pct: 10 | 25 | 50) => {
    if (!bargainModal) return;
    console.log('[DriverView] Submitting bargain:', pct, '% for ride:', bargainModal.id);
    try {
      await apiPost(`/api/rides/${bargainModal.id}/bargain`, { bargain_percentage: pct });
      setBargainModal(null);
      setRequests((prev) => prev.filter((r) => r.id !== bargainModal.id));
    } catch (e) { console.error('[DriverView] Bargain failed:', e); }
  };

  const handleIgnore = async (id: string) => {
    console.log('[DriverView] Ignoring ride:', id);
    try {
      await apiPost(`/api/rides/${id}/reject`, {});
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.error('[DriverView] Reject failed:', e); }
  };

  const handleCompleteRide = (req: RideRequest) => {
    console.log('[DriverView] Complete ride tapped — showing fare summary for ride:', req.id, 'fare:', req.price_offer, req.currency);
    setCompletedRide({
      id: req.id,
      pickup_location: req.pickup_location,
      destination: req.destination,
      price_offer: req.price_offer,
      currency: req.currency,
      rider_first_name: req.rider_first_name,
    });
  };

  const handleDoneComplete = async () => {
    if (!completedRide) return;
    console.log('[DriverView] Driver confirmed fare — calling POST /api/rides/:id/complete for ride:', completedRide.id);
    setCompleting(true);
    try {
      await apiPost(`/api/rides/${completedRide.id}/complete`, {});
      console.log('[DriverView] Ride completed successfully:', completedRide.id);
      setRequests((prev) => prev.filter((r) => r.id !== completedRide.id));
    } catch (e) {
      console.error('[DriverView] Complete ride failed:', e);
    } finally {
      setCompleting(false);
      setCompletedRide(null);
    }
  };

  const mutedLabel = isAvailable ? t('available') : t('muted');

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>{t('rides')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 13, color: isAvailable ? COLORS.success : COLORS.danger, fontFamily: 'Nunito_600SemiBold' }}>{mutedLabel}</Text>
          <Switch value={isAvailable} onValueChange={toggleAvailability} trackColor={{ false: COLORS.danger, true: COLORS.success }} thumbColor="#fff" />
        </View>
      </View>
      {!isAvailable && (
        <View style={{ backgroundColor: COLORS.dangerMuted, borderBottomWidth: 1, borderBottomColor: COLORS.danger, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' }}>Ride requests muted — toggle to receive requests</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor={COLORS.primary} />}
      >
        {loading ? (<><SkeletonCard /><SkeletonCard /><SkeletonCard /></>) : requests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Car size={36} color={COLORS.primary} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>{t('noRideRequests')}</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center', maxWidth: 260 }}>New ride requests will appear here automatically</Text>
          </View>
        ) : requests.map((req, i) => (
          <View key={req.id}>
            <RideRequestCard request={req} index={i} onAccept={handleAccept} onBargain={handleBargain} onIgnore={handleIgnore} />
            {req.status === 'accepted' && (
              <View style={{ marginTop: -4, marginBottom: 12, paddingHorizontal: 2 }}>
                <AnimatedPressable
                  onPress={() => {
                    console.log('[DriverView] Complete Ride button pressed for ride:', req.id);
                    handleCompleteRide(req);
                  }}
                  style={{
                    backgroundColor: COLORS.success,
                    borderRadius: 12,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <CheckCircle size={18} color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                    Complete Ride
                  </Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Accept modal */}
      <Modal visible={!!acceptModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: '100%', gap: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>Ride Accepted!</Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular' }}>Rider's phone number:</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }} selectable>{acceptModal?.riderPhone || 'N/A'}</Text>
            <AnimatedPressable
              onPress={() => { const p = acceptModal?.riderPhone; if (p) { console.log('[DriverView] Calling rider:', p); Linking.openURL(`tel:${p}`); } }}
              style={{ backgroundColor: COLORS.success, borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Phone size={20} color="#fff" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>Call Rider</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setAcceptModal(null)} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold' }}>Dismiss</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      {/* Bargain modal */}
      <Modal visible={!!bargainModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>Counter Offer</Text>
              <AnimatedPressable onPress={() => setBargainModal(null)}><X size={22} color={COLORS.textSecondary} /></AnimatedPressable>
            </View>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular' }}>Current offer: {bargainModal ? formatCurrency(bargainModal.price, bargainModal.currency) : ''}</Text>
            {([10, 25, 50] as const).map((pct) => {
              const newPrice = bargainModal ? Math.round(bargainModal.price * (1 + pct / 100)) : 0;
              const newPriceDisplay = bargainModal ? formatCurrency(newPrice, bargainModal.currency) : '';
              return (
                <AnimatedPressable key={pct} onPress={() => submitBargain(pct)} style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 14, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.primary }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>{pct}% Up</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>{newPriceDisplay}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Ride Summary Modal */}
      <RideSummaryModal ride={completedRide} onDone={handleDoneComplete} completing={completing} />
    </View>
  );
}

// ─── Rider View ───────────────────────────────────────────────────────────────

function RiderView() {
  const { profile } = useProfile();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const currency = COUNTRY_CURRENCY[profile?.country || 'kenya'] || 'KES';
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [priceOffer, setPriceOffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [bargainModal, setBargainModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollRide = useCallback(async (rideId: string) => {
    console.log('[RiderView] Polling ride status:', rideId);
    try {
      const data = await apiGet<ActiveRide>(`/api/rides/${rideId}`);
      setActiveRide(data);
      if (data.status === 'bargaining') setBargainModal(true);
      if (data.status === 'completed' || data.status === 'cancelled') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (e) { console.error('[RiderView] Poll failed:', e); }
  }, []);

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  const handleConfirmRequest = async () => {
    if (!pickup.trim() || !destination.trim() || !priceOffer.trim()) return;
    setLoading(true);
    console.log('[RiderView] Confirming ride request:', { pickup, destination, priceOffer, currency });
    try {
      const res = await apiPost<ActiveRide>('/api/rides', { pickup_location: pickup.trim(), destination: destination.trim(), price_offer: Number(priceOffer), currency });
      setActiveRide(res);
      intervalRef.current = setInterval(() => pollRide(res.id), 3000);
    } catch (e) { console.error('[RiderView] Create ride failed:', e); }
    finally { setLoading(false); }
  };

  const handleBargainRespond = async (accept: boolean) => {
    if (!activeRide) return;
    console.log('[RiderView] Bargain respond:', accept ? 'accept' : 'reject');
    try {
      await apiPost(`/api/rides/${activeRide.id}/bargain/respond`, { accept });
      setBargainModal(false);
      await pollRide(activeRide.id);
    } catch (e) { console.error('[RiderView] Bargain respond failed:', e); }
  };

  const handleNewRequest = () => {
    console.log('[RiderView] Starting new request');
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveRide(null); setPickup(''); setDestination(''); setPriceOffer(''); setBargainModal(false);
  };

  const priceDisplay = activeRide ? formatCurrency(activeRide.price_offer, activeRide.currency) : '';
  const bargainPriceDisplay = activeRide?.bargain_price ? formatCurrency(activeRide.bargain_price, activeRide.currency) : '';

  if (activeRide) {
    const isCancelled = activeRide.status === 'cancelled';
    const isAccepted = activeRide.status === 'accepted';
    const isCompleted = activeRide.status === 'completed';
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>{t('rides')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>Your Ride</Text>
              <StatusBadge status={activeRide.status} />
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MapPin size={16} color={COLORS.primary} /><Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>{activeRide.pickup_location}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Flag size={16} color={COLORS.accent} /><Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold', flex: 1 }} numberOfLines={1}>{activeRide.destination}</Text></View>
            </View>
            <View style={{ height: 1, backgroundColor: COLORS.divider }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>{priceDisplay}</Text>
            {activeRide.status === 'pending' && (
              <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>{t('waitingForDriver')}</Text>
              </View>
            )}
            {isAccepted && (
              <View style={{ backgroundColor: COLORS.successMuted, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 22 }}>🚗</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.success, fontFamily: 'Nunito_700Bold' }}>{t('driverOnTheWay')}</Text>
                {activeRide.driver_first_name ? <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular' }}>Driver: {activeRide.driver_first_name}</Text> : null}
              </View>
            )}
            {isCancelled && (
              <View style={{ backgroundColor: COLORS.dangerMuted, borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.danger, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' }}>{t('requestCancelled')}</Text>
                <AnimatedPressable onPress={handleNewRequest} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>New Request</Text>
                </AnimatedPressable>
              </View>
            )}
            {isCompleted && (
              <View style={{ backgroundColor: COLORS.successMuted, borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22 }}>✅</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.success, fontFamily: 'Nunito_600SemiBold' }}>Ride completed!</Text>
                <AnimatedPressable onPress={handleNewRequest} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>New Request</Text>
                </AnimatedPressable>
              </View>
            )}
          </View>
        </ScrollView>
        <Modal visible={bargainModal} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>Driver Counter Offer</Text>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular' }}>The driver has proposed a new price:</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.primary, fontFamily: 'Nunito_800ExtraBold' }}>{bargainPriceDisplay || priceDisplay}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <AnimatedPressable onPress={() => handleBargainRespond(true)} style={{ flex: 1, backgroundColor: COLORS.success, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>{t('accept')} Bargain</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => handleBargainRespond(false)} style={{ flex: 1, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.danger, fontFamily: 'Nunito_700Bold' }}>{t('reject')} Bargain</Text>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const canSubmit = pickup.trim() && destination.trim() && priceOffer.trim();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top + 12, marginBottom: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>{t('requestARide')}</Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginTop: 4 }}>Where are you going today?</Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>{t('pickup')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, gap: 10 }}>
            <MapPin size={18} color={COLORS.primary} />
            <TextInput value={pickup} onChangeText={setPickup} placeholder="e.g. Westlands, Nairobi" placeholderTextColor={COLORS.textTertiary} style={{ flex: 1, fontSize: 15, color: COLORS.text, fontFamily: 'Nunito_400Regular' }} />
          </View>
        </View>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>{t('destination')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, gap: 10 }}>
            <Flag size={18} color={COLORS.accent} />
            <TextInput value={destination} onChangeText={setDestination} placeholder="e.g. CBD, Nairobi" placeholderTextColor={COLORS.textTertiary} style={{ flex: 1, fontSize: 15, color: COLORS.text, fontFamily: 'Nunito_400Regular' }} />
          </View>
        </View>
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 }}>{t('priceOffer')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 52, gap: 10 }}>
            <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>{currency}</Text>
            </View>
            <TextInput value={priceOffer} onChangeText={setPriceOffer} placeholder="e.g. 500" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" style={{ flex: 1, fontSize: 15, color: COLORS.text, fontFamily: 'Nunito_400Regular' }} />
          </View>
        </View>
        <AnimatedPressable onPress={handleConfirmRequest} disabled={!canSubmit || loading} style={{ backgroundColor: canSubmit ? COLORS.primary : COLORS.primaryMuted, borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={{ fontSize: 17, fontWeight: '700', color: canSubmit ? COLORS.text : COLORS.textTertiary, fontFamily: 'Nunito_700Bold' }}>{t('confirmRequest')}</Text>}
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

export default function RidesScreen() {
  const { profile, profileLoading } = useProfile();
  if (profileLoading || !profile) {
    return <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  if (profile.user_type === 'driver') return <DriverView />;
  return <RiderView />;
}
