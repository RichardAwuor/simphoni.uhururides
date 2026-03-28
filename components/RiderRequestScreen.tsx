import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Modal,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Car, Zap, Bike, MapPin, Flag, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiPost, apiGet } from '@/utils/api';
import { useProfile } from '@/contexts/ProfileContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#F5C518';
const BG = '#FAF7F0';
const CARD_BG = '#FFFFFF';
const TEXT = '#1A1A1A';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';

const CURRENCIES = ['KES', 'UGX', 'TZS', 'RWF', 'ETB', 'BIF', 'SSP'] as const;
type Currency = typeof CURRENCIES[number];

const COUNTRY_CURRENCY: Record<string, Currency> = {
  kenya: 'KES',
  uganda: 'UGX',
  tanzania: 'TZS',
  rwanda: 'RWF',
  ethiopia: 'ETB',
  burundi: 'BIF',
  'south sudan': 'SSP',
};

type VehicleType = 'car' | 'tuktuk' | 'motorbike';

interface LatLng { lat: number; lng: number }
interface NominatimResult { display_name: string; lat: string; lon: string }

interface RideRequestResponse {
  id: string;
  status: string;
  vehicle_type?: string;
  pickup_location?: string;
  destination?: string;
  distance_km?: number;
  offered_price?: number;
  currency?: string;
  final_price?: number | null;
}

interface BargainAttempt {
  id: string;
  ride_request_id: string;
  bargain_percent: number;
  bargain_price: number;
  status: string;
}

interface RiderCurrentResponse {
  ride_request: RideRequestResponse | null;
  pending_bargain: BargainAttempt | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildStaticMapUrl(lat: number, lng: number): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=300x120&markers=${lat},${lng},red`;
}

async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  console.log('[RiderRequest] Nominatim search:', query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UhuruRides/1.0' } });
  if (!res.ok) return [];
  return res.json();
}

async function nominatimReverse(lat: number, lng: number): Promise<string> {
  console.log('[RiderRequest] Nominatim reverse geocode:', lat, lng);
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UhuruRides/1.0' } });
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <View style={si.row}>
      {[1, 2, 3].map((n) => {
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={n}>
            <View style={[si.dot, active && si.dotActive, done && si.dotDone]}>
              <Text style={[si.dotText, (active || done) && si.dotTextActive]}>{n}</Text>
            </View>
            {n < 3 ? <View style={[si.line, done && si.lineDone]} /> : null}
          </React.Fragment>
        );
      })}
      <Text style={si.label}>Step {step} of 3</Text>
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 0 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  dotActive: { backgroundColor: PRIMARY },
  dotDone: { backgroundColor: '#22C55E' },
  dotText: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY, fontFamily: 'Nunito_700Bold' },
  dotTextActive: { color: '#fff' },
  line: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  lineDone: { backgroundColor: '#22C55E' },
  label: { fontSize: 12, color: TEXT_SECONDARY, fontFamily: 'Nunito_600SemiBold', marginLeft: 10 },
});

// ─── Address Input with Autocomplete ─────────────────────────────────────────

interface AddressInputProps {
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: NominatimResult) => void;
}

function AddressInput({ placeholder, value, onChange, onSelect }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (text: string) => {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await nominatimSearch(text);
      setSuggestions(results);
      setSearching(false);
    }, 400);
  };

  const handleSelect = (r: NominatimResult) => {
    console.log('[RiderRequest] Address selected:', r.display_name);
    onSelect(r);
    setSuggestions([]);
  };

  return (
    <View style={ai.wrapper}>
      <View style={ai.inputRow}>
        <TextInput
          style={ai.input}
          placeholder={placeholder}
          placeholderTextColor={TEXT_TERTIARY}
          value={value}
          onChangeText={handleChange}
        />
        {searching ? <ActivityIndicator size="small" color={PRIMARY} style={{ marginRight: 10 }} /> : null}
      </View>
      {suggestions.length > 0 ? (
        <View style={ai.dropdown}>
          {suggestions.map((r, i) => (
            <TouchableOpacity key={i} style={ai.suggestion} onPress={() => handleSelect(r)}>
              <MapPin size={13} color={TEXT_TERTIARY} />
              <Text style={ai.suggestionText} numberOfLines={2}>{r.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const ai = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: TEXT, fontFamily: 'Nunito_400Regular',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', zIndex: 100, marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  suggestionText: { flex: 1, fontSize: 13, color: TEXT, fontFamily: 'Nunito_400Regular', lineHeight: 18 },
});

// ─── Step 1: Vehicle Type ─────────────────────────────────────────────────────

type VehicleCardProps = {
  type: VehicleType;
  selected: boolean;
  onPress: () => void;
};

const VEHICLE_INFO: Record<VehicleType, { label: string; desc: string; Icon: any }> = {
  car: { label: 'Car', desc: 'Comfortable sedan or SUV for up to 4 passengers', Icon: Car },
  tuktuk: { label: 'Tuktuk / Bajaj', desc: 'Affordable 3-wheeler, great for short trips', Icon: Zap },
  motorbike: { label: 'Motorbike', desc: 'Fast boda-boda for solo riders', Icon: Bike },
};

function VehicleCard({ type, selected, onPress }: VehicleCardProps) {
  const { label, desc, Icon } = VEHICLE_INFO[type];
  return (
    <AnimatedPressable
      onPress={() => {
        console.log('[RiderRequest] Vehicle type selected:', type);
        onPress();
      }}
      style={[vc.card, selected && vc.cardSelected]}
    >
      <View style={[vc.iconBox, selected && vc.iconBoxSelected]}>
        <Icon size={26} color={selected ? '#B8860B' : TEXT_SECONDARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[vc.label, selected && vc.labelSelected]}>{label}</Text>
        <Text style={vc.desc}>{desc}</Text>
      </View>
      {selected ? <CheckCircle size={20} color={PRIMARY} /> : null}
    </AnimatedPressable>
  );
}

const vc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardSelected: { borderColor: PRIMARY, backgroundColor: '#FFFBEA' },
  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  iconBoxSelected: { backgroundColor: 'rgba(245,197,24,0.15)' },
  label: { fontSize: 16, fontWeight: '700', color: TEXT, fontFamily: 'Nunito_700Bold' },
  labelSelected: { color: '#B8860B' },
  desc: { fontSize: 12, color: TEXT_SECONDARY, fontFamily: 'Nunito_400Regular', marginTop: 2, lineHeight: 16 },
});

// ─── Bargain Modal (for rider) ────────────────────────────────────────────────

interface BargainModalProps {
  rideId: string;
  bargain: BargainAttempt;
  currency: string;
  originalPrice: number;
  onResponded: (accepted: boolean) => void;
}

function RiderBargainModal({ rideId, bargain, currency, originalPrice, onResponded }: BargainModalProps) {
  const [responding, setResponding] = useState(false);

  const handleResponse = async (response: 'accepted' | 'rejected') => {
    console.log('[RiderBargainModal] Bargain response pressed — response:', response, 'rideId:', rideId);
    setResponding(true);
    try {
      await apiPost(`/api/ride-requests/${rideId}/bargain-response`, { response });
      console.log('[RiderBargainModal] Bargain response sent:', response);
      onResponded(response === 'accepted');
    } catch (e) {
      console.error('[RiderBargainModal] Bargain response failed:', e);
    } finally {
      setResponding(false);
    }
  };

  const bargainPriceText = `${currency} ${Number(bargain.bargain_price).toLocaleString()}`;
  const originalPriceText = `${currency} ${Number(originalPrice).toLocaleString()}`;
  const percentText = `+${bargain.bargain_percent}%`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
      <View style={bm.overlay}>
        <View style={bm.card}>
          <Text style={bm.title}>Driver Counter-Offer</Text>
          <View style={bm.priceRow}>
            <View style={bm.priceBox}>
              <Text style={bm.priceLabel}>Your Offer</Text>
              <Text style={bm.originalPrice}>{originalPriceText}</Text>
            </View>
            <View style={bm.arrow}>
              <Text style={bm.arrowText}>→</Text>
            </View>
            <View style={bm.priceBox}>
              <Text style={bm.priceLabel}>Driver Asks</Text>
              <Text style={bm.bargainPrice}>{bargainPriceText}</Text>
            </View>
          </View>
          <View style={bm.percentBadge}>
            <Text style={bm.percentText}>{percentText} increase</Text>
          </View>
          <Text style={bm.subtitle}>Do you accept the driver's counter-offer?</Text>
          <View style={bm.btnRow}>
            <AnimatedPressable
              onPress={() => handleResponse('rejected')}
              disabled={responding}
              style={[bm.btnReject, responding && bm.btnDisabled]}
            >
              {responding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <XCircle size={16} color="#fff" />
                  <Text style={bm.btnRejectText}>Reject</Text>
                </>
              )}
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => handleResponse('accepted')}
              disabled={responding}
              style={[bm.btnAccept, responding && bm.btnDisabled]}
            >
              {responding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle size={16} color="#fff" />
                  <Text style={bm.btnAcceptText}>Accept</Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const bm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  priceBox: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  originalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_700Bold',
    textDecorationLine: 'line-through',
  },
  bargainPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#B8860B',
    fontFamily: 'Nunito_800ExtraBold',
  },
  arrow: {
    paddingHorizontal: 4,
  },
  arrowText: {
    fontSize: 20,
    color: TEXT_SECONDARY,
  },
  percentBadge: {
    backgroundColor: 'rgba(245,197,24,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.35)',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B8860B',
    fontFamily: 'Nunito_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnRejectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  btnAccept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnAcceptText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  btnDisabled: { opacity: 0.4 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RiderRequestScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  // Derive currency from profile country
  const profileCurrency = React.useMemo(() => {
    const country = (profile as any)?.country?.toLowerCase() ?? '';
    return COUNTRY_CURRENCY[country] ?? 'KES';
  }, [profile]);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);

  // Step 2
  const [pickupText, setPickupText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [destText, setDestText] = useState('');
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Step 3
  const [currency, setCurrency] = useState<Currency>(profileCurrency);

  // Sync currency when profile loads
  useEffect(() => {
    setCurrency(profileCurrency);
  }, [profileCurrency]);
  const [priceInput, setPriceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Waiting / polling
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [rideData, setRideData] = useState<RideRequestResponse | null>(null);
  const [pendingBargain, setPendingBargain] = useState<BargainAttempt | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Derived
  const distanceKm = pickupCoords && destCoords ? haversineKm(pickupCoords, destCoords) : null;
  const distanceText = distanceKm != null ? `~${distanceKm.toFixed(1)} km estimated` : null;
  const mapUrl = destCoords ? buildStaticMapUrl(destCoords.lat, destCoords.lng) : null;

  // Pulse animation for waiting state
  useEffect(() => {
    if (rideId && rideStatus === 'pending') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [rideId, rideStatus]);

  // Polling — GET /api/ride-requests/rider/current
  const pollRide = useCallback(async () => {
    if (!rideId) return;
    console.log('[RiderRequest] Polling GET /api/ride-requests/rider/current — rideId:', rideId);
    try {
      const data = await apiGet<RiderCurrentResponse>('/api/ride-requests/rider/current');
      const req = data?.ride_request;
      const bargain = data?.pending_bargain ?? null;
      console.log('[RiderRequest] Poll result — status:', req?.status ?? 'none', 'pending_bargain:', bargain?.id ?? 'none');
      if (req) {
        setRideData(req);
        setRideStatus(req.status);
      }
      setPendingBargain(bargain);
    } catch (e) {
      console.error('[RiderRequest] Poll failed:', e);
    }
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    pollRef.current = setInterval(pollRide, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [rideId, pollRide]);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const resetWizard = () => {
    stopPolling();
    setStep(1);
    setVehicleType(null);
    setPickupText('');
    setPickupCoords(null);
    setDestText('');
    setDestCoords(null);
    setPriceInput('');
    setRideId(null);
    setRideStatus(null);
    setRideData(null);
    setPendingBargain(null);
    setSubmitError('');
    console.log('[RiderRequest] Wizard reset');
  };

  // ── Location ──────────────────────────────────────────────────────────────

  const handleUseCurrentLocation = async () => {
    console.log('[RiderRequest] Use current location pressed');
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[RiderRequest] Location permission denied');
        setLocationLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      console.log('[RiderRequest] Got location:', latitude, longitude);
      const address = await nominatimReverse(latitude, longitude);
      setPickupCoords({ lat: latitude, lng: longitude });
      setPickupText(address);
    } catch (e) {
      console.error('[RiderRequest] Location error:', e);
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleConfirmRequest = async () => {
    if (!vehicleType || !pickupCoords || !destCoords || !priceInput) return;
    console.log('[RiderRequest] Confirm request pressed — vehicle:', vehicleType, 'price:', priceInput, currency);
    setSubmitting(true);
    setSubmitError('');
    try {
      const body = {
        vehicle_type: vehicleType,
        pickup_location: pickupText,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination: destText,
        destination_lat: destCoords.lat,
        destination_lng: destCoords.lng,
        distance_km: distanceKm,
        offered_price: Number(priceInput),
        currency,
      };
      console.log('[RiderRequest] POST /api/ride-requests', body);
      const result = await apiPost<{ id: string }>('/api/ride-requests', body);
      console.log('[RiderRequest] Ride request created:', result?.id);
      setRideId(result?.id ?? null);
      setRideStatus('pending');
    } catch (e: any) {
      console.error('[RiderRequest] Submit failed:', e);
      setSubmitError(e?.message ?? 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Bargain response ──────────────────────────────────────────────────────

  const handleBargainResponded = (accepted: boolean) => {
    console.log('[RiderRequest] Bargain responded — accepted:', accepted);
    setPendingBargain(null);
    if (accepted) {
      setRideStatus('accepted');
      stopPolling();
    } else {
      setRideStatus('pending');
    }
  };

  // ─── Render: Waiting / Result ─────────────────────────────────────────────

  if (rideId) {
    if (rideStatus === 'accepted') {
      return (
        <View style={s.container}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          >
            <View style={s.successState}>
              <Text style={s.successEmoji}>🎉</Text>
              <Text style={s.successTitle}>Ride Confirmed!</Text>
              <Text style={s.successSubtitle}>Your driver is on the way. Get ready!</Text>
              <AnimatedPressable onPress={resetWizard} style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>Request Another Ride</Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (rideStatus === 'cancelled') {
      return (
        <View style={s.container}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          >
            <View style={s.successState}>
              <Text style={s.successEmoji}>😔</Text>
              <Text style={s.successTitle}>No drivers available</Text>
              <Text style={s.successSubtitle}>No drivers accepted your request. Please try again.</Text>
              <AnimatedPressable onPress={resetWizard} style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>New Request</Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    const vehicleLabel = vehicleType ? VEHICLE_INFO[vehicleType].label : rideData?.vehicle_type ?? '';
    const offerText = `${rideData?.currency ?? currency} ${Number(rideData?.offered_price ?? priceInput).toLocaleString()}`;
    const pickupDisplay = rideData?.pickup_location ?? pickupText;
    const destDisplay = rideData?.destination ?? destText;

    return (
      <View style={s.container}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        >
          {/* Pulsing circle */}
          <View style={s.pulseWrapper}>
            <Animated.View style={[s.pulseOuter, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.pulseInner}>
                <Car size={32} color={PRIMARY} />
              </View>
            </Animated.View>
          </View>

          <Text style={s.waitingTitle}>Waiting for a driver...</Text>
          <Text style={s.waitingSubtitle}>Hang tight, we're matching you with a nearby driver</Text>

          {/* Ride summary */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Vehicle</Text>
              <Text style={s.summaryValue}>{vehicleLabel}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <MapPin size={13} color={PRIMARY} />
              <Text style={s.summaryValue} numberOfLines={2}>{pickupDisplay}</Text>
            </View>
            <View style={s.summaryRow}>
              <Flag size={13} color="#EF4444" />
              <Text style={s.summaryValue} numberOfLines={2}>{destDisplay}</Text>
            </View>
            {distanceText ? (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Distance</Text>
                <Text style={s.summaryValue}>{distanceText}</Text>
              </View>
            ) : null}
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Your Offer</Text>
              <Text style={[s.summaryValue, s.summaryPrice]}>{offerText}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Bargain modal — shown when driver sends counter-offer */}
        {pendingBargain ? (
          <RiderBargainModal
            rideId={rideId}
            bargain={pendingBargain}
            currency={rideData?.currency ?? currency}
            originalPrice={Number(rideData?.offered_price ?? priceInput)}
            onResponded={handleBargainResponded}
          />
        ) : null}
      </View>
    );
  }

  // ─── Render: Wizard ───────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepIndicator step={step} />

        {/* ── Step 1 ── */}
        {step === 1 ? (
          <View>
            <Text style={s.heading}>Choose your ride</Text>
            <Text style={s.subheading}>What type of vehicle do you need?</Text>
            <View style={{ marginTop: 16 }}>
              {(['car', 'tuktuk', 'motorbike'] as VehicleType[]).map((t) => (
                <VehicleCard
                  key={t}
                  type={t}
                  selected={vehicleType === t}
                  onPress={() => setVehicleType(t)}
                />
              ))}
            </View>
            <AnimatedPressable
              onPress={() => {
                console.log('[RiderRequest] Step 1 Next pressed');
                setStep(2);
              }}
              disabled={!vehicleType}
              style={[s.primaryBtn, !vehicleType && s.btnDisabled]}
            >
              <Text style={s.primaryBtnText}>Next</Text>
              <ChevronRight size={18} color="#1A1A1A" />
            </AnimatedPressable>
          </View>
        ) : null}

        {/* ── Step 2 ── */}
        {step === 2 ? (
          <View>
            <Text style={s.heading}>Where to?</Text>

            {/* Pickup */}
            <Text style={s.fieldLabel}>Pickup Location</Text>
            <AnimatedPressable
              onPress={handleUseCurrentLocation}
              disabled={locationLoading}
              style={s.locationBtn}
            >
              {locationLoading ? (
                <ActivityIndicator color={PRIMARY} size="small" />
              ) : (
                <MapPin size={16} color={PRIMARY} />
              )}
              <Text style={s.locationBtnText}>
                {locationLoading ? 'Getting location...' : '📍 Use My Current Location'}
              </Text>
            </AnimatedPressable>

            <View style={{ marginTop: 8, zIndex: 20 }}>
              <AddressInput
                placeholder="Or type a different pickup address"
                value={pickupText}
                onChange={(t) => {
                  setPickupText(t);
                  setPickupCoords(null);
                }}
                onSelect={(r) => {
                  setPickupText(r.display_name);
                  setPickupCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
                }}
              />
            </View>

            {/* Destination */}
            <Text style={[s.fieldLabel, { marginTop: 20 }]}>Destination</Text>
            <View style={{ zIndex: 10 }}>
              <AddressInput
                placeholder="Search destination..."
                value={destText}
                onChange={(t) => {
                  setDestText(t);
                  setDestCoords(null);
                }}
                onSelect={(r) => {
                  setDestText(r.display_name);
                  setDestCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
                }}
              />
            </View>

            {/* Map thumbnail */}
            {mapUrl ? (
              <Image
                source={resolveImageSource(mapUrl)}
                style={s.mapThumb}
                resizeMode="cover"
              />
            ) : null}

            {/* Distance */}
            {distanceText ? (
              <View style={s.distancePill}>
                <Text style={s.distancePillText}>{distanceText}</Text>
              </View>
            ) : null}

            {/* Nav buttons */}
            <View style={s.navRow}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[RiderRequest] Step 2 Back pressed');
                  setStep(1);
                }}
                style={s.backBtn}
              >
                <ChevronLeft size={18} color={TEXT_SECONDARY} />
                <Text style={s.backBtnText}>Back</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  console.log('[RiderRequest] Step 2 Next pressed');
                  setStep(3);
                }}
                disabled={!pickupCoords || !destCoords}
                style={[s.primaryBtnSmall, (!pickupCoords || !destCoords) && s.btnDisabled]}
              >
                <Text style={s.primaryBtnText}>Next</Text>
                <ChevronRight size={18} color="#1A1A1A" />
              </AnimatedPressable>
            </View>
          </View>
        ) : null}

        {/* ── Step 3 ── */}
        {step === 3 ? (
          <View>
            <Text style={s.heading}>Set your price</Text>

            {/* Currency display (auto-set from profile country) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={[s.currencyPill, s.currencyPillSelected]}>
                <Text style={[s.currencyPillText, s.currencyPillTextSelected]}>{currency}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#888', fontFamily: 'Nunito_400Regular', marginLeft: 10 }}>
                Currency based on your country
              </Text>
            </View>

            {/* Price input */}
            <View style={s.priceInputRow}>
              <View style={s.currencyPrefix}>
                <Text style={s.currencyPrefixText}>{currency}</Text>
              </View>
              <TextInput
                style={s.priceInput}
                placeholder="0"
                placeholderTextColor={TEXT_TERTIARY}
                value={priceInput}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9]/g, '');
                  setPriceInput(cleaned);
                }}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>

            {/* Summary card */}
            <View style={s.summaryCard}>
              <Text style={s.summaryCardTitle}>Ride Summary</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Vehicle</Text>
                <Text style={s.summaryValue}>{vehicleType ? VEHICLE_INFO[vehicleType].label : ''}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryRow}>
                <MapPin size={13} color={PRIMARY} />
                <Text style={s.summaryValue} numberOfLines={2}>{pickupText}</Text>
              </View>
              <View style={s.summaryRow}>
                <Flag size={13} color="#EF4444" />
                <Text style={s.summaryValue} numberOfLines={2}>{destText}</Text>
              </View>
              {distanceText ? (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Distance</Text>
                  <Text style={s.summaryValue}>{distanceText}</Text>
                </View>
              ) : null}
              <View style={s.summaryDivider} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Your Offer</Text>
                <Text style={[s.summaryValue, s.summaryPrice]}>
                  {priceInput ? `${currency} ${Number(priceInput).toLocaleString()}` : '—'}
                </Text>
              </View>
            </View>

            {submitError ? (
              <View style={s.errorBanner}>
                <Text style={s.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* Nav buttons */}
            <View style={s.navRow}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[RiderRequest] Step 3 Back pressed');
                  setStep(2);
                }}
                style={s.backBtn}
              >
                <ChevronLeft size={18} color={TEXT_SECONDARY} />
                <Text style={s.backBtnText}>Back</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleConfirmRequest}
                disabled={!priceInput || submitting}
                style={[s.confirmBtn, (!priceInput || submitting) && s.btnDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#1A1A1A" size="small" />
                ) : (
                  <Text style={s.confirmBtnText}>Confirm Request</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  heading: {
    fontSize: 22, fontWeight: '800', color: TEXT,
    fontFamily: 'Nunito_800ExtraBold', marginBottom: 4,
  },
  subheading: {
    fontSize: 14, color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular', marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold', marginBottom: 8,
  },

  // Location button
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(245,197,24,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(245,197,24,0.35)',
  },
  locationBtnText: {
    fontSize: 14, fontWeight: '600', color: '#B8860B',
    fontFamily: 'Nunito_600SemiBold',
  },

  // Map
  mapThumb: {
    width: '100%', height: 110, borderRadius: 12,
    marginTop: 16, backgroundColor: '#E8E8E8',
  },

  // Distance pill
  distancePill: {
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(245,197,24,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)',
  },
  distancePillText: {
    fontSize: 13, fontWeight: '600', color: '#B8860B',
    fontFamily: 'Nunito_600SemiBold',
  },

  // Currency
  currencyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  currencyPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  currencyPillSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  currencyPillText: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, fontFamily: 'Nunito_700Bold' },
  currencyPillTextSelected: { color: '#1A1A1A' },

  // Price input
  priceInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 16,
    borderWidth: 2, borderColor: PRIMARY,
    marginBottom: 20, overflow: 'hidden',
  },
  currencyPrefix: {
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderRightWidth: 1, borderRightColor: 'rgba(245,197,24,0.3)',
  },
  currencyPrefixText: {
    fontSize: 16, fontWeight: '700', color: '#B8860B', fontFamily: 'Nunito_700Bold',
  },
  priceInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 28, fontWeight: '800', color: TEXT, fontFamily: 'Nunito_800ExtraBold',
  },

  // Summary card
  summaryCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryCardTitle: {
    fontSize: 14, fontWeight: '700', color: TEXT,
    fontFamily: 'Nunito_700Bold', marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: TEXT_SECONDARY, fontFamily: 'Nunito_400Regular', minWidth: 70 },
  summaryValue: { flex: 1, fontSize: 13, color: TEXT, fontFamily: 'Nunito_600SemiBold', fontWeight: '600' },
  summaryPrice: { color: '#B8860B', fontFamily: 'Nunito_700Bold', fontWeight: '700' },
  summaryDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 6 },

  // Nav
  navRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY, fontFamily: 'Nunito_600SemiBold' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 15, marginTop: 8,
  },
  primaryBtnSmall: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' },
  confirmBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' },
  btnDisabled: { opacity: 0.4 },

  // Error
  errorBanner: {
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#DC2626', fontFamily: 'Nunito_600SemiBold' },

  // Waiting state
  pulseWrapper: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  pulseOuter: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(245,197,24,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  pulseInner: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(245,197,24,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  waitingTitle: {
    fontSize: 22, fontWeight: '800', color: TEXT,
    fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', marginBottom: 6,
  },
  waitingSubtitle: {
    fontSize: 14, color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular', textAlign: 'center', marginBottom: 24,
  },

  // Success / cancelled
  successState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  successEmoji: { fontSize: 56 },
  successTitle: {
    fontSize: 26, fontWeight: '800', color: TEXT,
    fontFamily: 'Nunito_800ExtraBold', textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15, color: TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular', textAlign: 'center', maxWidth: 260,
  },
});
