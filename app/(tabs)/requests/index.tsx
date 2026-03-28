import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { COLORS } from '@/constants/colors';
import { apiGet, apiPost, apiDelete } from '@/utils/api';
import {
  Car,
  Bike,
  Zap,
  MapPin,
  Flag,
  Navigation,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import * as Location from 'expo-location';

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleType = 'car' | 'tuktuk' | 'motorbike';
type Currency = 'UGX' | 'KES' | 'TZS' | 'RWF' | 'ETB';
type WizardStep = 1 | 2 | 3;
type ScreenState = 'wizard' | 'waiting' | 'bargaining' | 'success' | 'cancelled';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

interface RideRequest {
  id: string;
  status: string;
  bargain_price?: number;
  currency?: string;
  pickup_location?: string;
  dropoff_location?: string;
  vehicle_type?: string;
  fare?: number;
}

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

// ─── Constants ────────────────────────────────────────────────────────────────

const NOMINATIM_HEADERS = { 'User-Agent': 'UhuruRides/1.0' };
const CURRENCIES: Currency[] = ['UGX', 'KES', 'TZS', 'RWF', 'ETB'];

const VEHICLE_OPTIONS: { type: VehicleType; label: string; description: string }[] = [
  { type: 'car', label: 'Car', description: 'Comfortable saloon or SUV' },
  { type: 'tuktuk', label: 'Tuktuk / Bajaj', description: 'Quick 3-wheeler for short trips' },
  { type: 'motorbike', label: 'Motorbike', description: 'Fast boda boda' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F5A623',
  accepted: COLORS.success,
  completed: '#9E8A3A',
  cancelled: COLORS.danger,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function truncate(str: string, max = 36): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function VehicleIcon({ type, size, color }: { type: VehicleType; size: number; color: string }) {
  if (type === 'car') return <Car size={size} color={color} />;
  if (type === 'tuktuk') return <Zap size={size} color={color} />;
  return <Bike size={size} color={color} />;
}

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
      <Text style={{ fontSize: 11, fontWeight: '600', color, fontFamily: 'Nunito_600SemiBold', textTransform: 'capitalize' }}>
        {status}
      </Text>
    </View>
  );
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

// ─── Rider: Step Indicator ────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = [1, 2, 3];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
      {steps.map((s) => (
        <View
          key={s}
          style={{
            width: s === step ? 28 : 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: s === step ? COLORS.primary : s < step ? COLORS.primary + '60' : COLORS.border,
          }}
        />
      ))}
      <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold', marginLeft: 4 }}>
        Step {step} of 3
      </Text>
    </View>
  );
}

// ─── Rider: Suggestion Dropdown ───────────────────────────────────────────────

function SuggestionDropdown({
  results,
  onSelect,
}: {
  results: NominatimResult[];
  onSelect: (r: NominatimResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginTop: 4,
        overflow: 'hidden',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      {results.map((r, i) => (
        <TouchableOpacity
          key={r.place_id}
          onPress={() => {
            console.log('[RequestRide] Suggestion selected:', r.display_name);
            onSelect(r);
          }}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderBottomWidth: i < results.length - 1 ? 1 : 0,
            borderBottomColor: COLORS.divider,
          }}
        >
          <Text style={{ fontSize: 13, color: COLORS.text, fontFamily: 'Nunito_400Regular' }} numberOfLines={2}>
            {r.display_name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Rider: Step 1 — Vehicle Type ─────────────────────────────────────────────

function Step1({
  selected,
  onSelect,
  onNext,
}: {
  selected: VehicleType | null;
  onSelect: (v: VehicleType) => void;
  onNext: () => void;
}) {
  const nextDisabled = !selected;
  const nextBg = selected ? COLORS.primary : COLORS.primaryMuted;
  const nextTextColor = selected ? '#1A1A1A' : COLORS.textTertiary;

  return (
    <View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 }}>
        Choose your ride
      </Text>
      <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>
        What type of vehicle do you need?
      </Text>

      <View style={{ gap: 12 }}>
        {VEHICLE_OPTIONS.map((v) => {
          const isSelected = selected === v.type;
          const cardBg = isSelected ? 'rgba(245,197,24,0.10)' : COLORS.surface;
          const cardBorder = isSelected ? COLORS.primary : COLORS.border;
          const iconBg = isSelected ? COLORS.primary : COLORS.primaryMuted;
          const iconColor = isSelected ? '#1A1A1A' : COLORS.primary;
          return (
            <AnimatedPressable
              key={v.type}
              onPress={() => {
                console.log('[RequestRide] Vehicle selected:', v.type);
                onSelect(v.type);
              }}
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: 18,
                borderWidth: 2,
                borderColor: cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <VehicleIcon type={v.type} size={26} color={iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
                  {v.label}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginTop: 2 }}>
                  {v.description}
                </Text>
              </View>
              {isSelected && <CheckCircle size={22} color={COLORS.primary} />}
            </AnimatedPressable>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => {
          console.log('[RequestRide] Step 1 Next pressed, vehicle:', selected);
          onNext();
        }}
        disabled={nextDisabled}
        style={{
          backgroundColor: nextBg,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: nextTextColor, fontFamily: 'Nunito_700Bold' }}>
          Next →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Rider: Step 2 — Pickup & Destination ─────────────────────────────────────

function Step2({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  onNext,
  onBack,
}: {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  onPickupChange: (p: LocationPoint) => void;
  onDestinationChange: (p: LocationPoint) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [locLoading, setLocLoading] = useState(false);
  const [pickupText, setPickupText] = useState(pickup?.address ?? '');
  const [destText, setDestText] = useState(destination?.address ?? '');
  const [pickupSuggestions, setPickupSuggestions] = useState<NominatimResult[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<NominatimResult[]>([]);
  const pickupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const distanceKm =
    pickup && destination
      ? haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng)
      : null;
  const distanceDisplay = distanceKm !== null ? `~${distanceKm.toFixed(1)} km estimated` : null;
  const mapUrl = destination
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${destination.lat},${destination.lng}&zoom=14&size=300x120&markers=${destination.lat},${destination.lng},red`
    : null;

  const canProceed = !!pickup && !!destination;
  const nextBg = canProceed ? COLORS.primary : COLORS.primaryMuted;
  const nextTextColor = canProceed ? '#1A1A1A' : COLORS.textTertiary;

  async function searchNominatim(query: string): Promise<NominatimResult[]> {
    console.log('[RequestRide] Nominatim search:', query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    try {
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }

  function handlePickupTextChange(text: string) {
    setPickupText(text);
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    if (text.length >= 3) {
      pickupTimer.current = setTimeout(async () => {
        const results = await searchNominatim(text);
        setPickupSuggestions(results);
      }, 400);
    } else {
      setPickupSuggestions([]);
    }
  }

  function handleDestTextChange(text: string) {
    setDestText(text);
    if (destTimer.current) clearTimeout(destTimer.current);
    if (text.length >= 3) {
      destTimer.current = setTimeout(async () => {
        const results = await searchNominatim(text);
        setDestSuggestions(results);
      }, 400);
    } else {
      setDestSuggestions([]);
    }
  }

  async function useCurrentLocation() {
    console.log('[RequestRide] Use current location pressed');
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[RequestRide] Location permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      console.log('[RequestRide] Got location:', latitude, longitude);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (res.ok) {
        const data = await res.json();
        const address = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        console.log('[RequestRide] Reverse geocoded:', address);
        setPickupText(address);
        setPickupSuggestions([]);
        onPickupChange({ address, lat: latitude, lng: longitude });
      }
    } catch (e) {
      console.error('[RequestRide] Location error:', e);
    } finally {
      setLocLoading(false);
    }
  }

  return (
    <View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', marginBottom: 20 }}>
        Where to?
      </Text>

      {/* Pickup section */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 8 }}>
        Pickup Location
      </Text>

      <TouchableOpacity
        onPress={useCurrentLocation}
        disabled={locLoading}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: COLORS.primaryMuted,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: COLORS.primaryBorder,
        }}
      >
        {locLoading
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : <Navigation size={16} color={COLORS.primary} />
        }
        <Text style={{ fontSize: 14, color: COLORS.primary, fontFamily: 'Nunito_600SemiBold' }}>
          📍 Use My Current Location
        </Text>
      </TouchableOpacity>

      {pickup ? (
        <View
          style={{
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: COLORS.primaryBorder,
          }}
        >
          <Text style={{ fontSize: 13, color: COLORS.text, fontFamily: 'Nunito_400Regular' }} numberOfLines={2}>
            {pickup.address}
          </Text>
        </View>
      ) : null}

      <View style={{ zIndex: 20, marginBottom: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
          }}
        >
          <MapPin size={16} color={COLORS.textTertiary} />
          <TextInput
            value={pickupText}
            onChangeText={handlePickupTextChange}
            placeholder="Or type a different pickup address"
            placeholderTextColor={COLORS.textTertiary}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingLeft: 8,
              fontSize: 14,
              color: COLORS.text,
              fontFamily: 'Nunito_400Regular',
            }}
          />
        </View>
        <SuggestionDropdown
          results={pickupSuggestions}
          onSelect={(r) => {
            setPickupText(r.display_name);
            setPickupSuggestions([]);
            onPickupChange({ address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
          }}
        />
      </View>

      {/* Destination section */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginTop: 16, marginBottom: 8 }}>
        Destination
      </Text>

      <View style={{ zIndex: 10, marginBottom: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
          }}
        >
          <Flag size={16} color={COLORS.accent} />
          <TextInput
            value={destText}
            onChangeText={handleDestTextChange}
            placeholder="Search destination..."
            placeholderTextColor={COLORS.textTertiary}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingLeft: 8,
              fontSize: 14,
              color: COLORS.text,
              fontFamily: 'Nunito_400Regular',
            }}
          />
        </View>
        <SuggestionDropdown
          results={destSuggestions}
          onSelect={(r) => {
            setDestText(r.display_name);
            setDestSuggestions([]);
            onDestinationChange({ address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
          }}
        />
      </View>

      {mapUrl ? (
        <View style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
          <Image source={{ uri: mapUrl }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
        </View>
      ) : null}

      {distanceDisplay ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Clock size={14} color={COLORS.textTertiary} />
          <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold' }}>
            {distanceDisplay}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Step 2 Back pressed');
            onBack();
          }}
          style={{
            flex: 1,
            backgroundColor: COLORS.surface,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>
            ← Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Step 2 Next pressed, pickup:', pickup?.address, 'dest:', destination?.address);
            onNext();
          }}
          disabled={!canProceed}
          style={{
            flex: 2,
            backgroundColor: nextBg,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: nextTextColor, fontFamily: 'Nunito_700Bold' }}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Rider: Step 3 — Price Offer ──────────────────────────────────────────────

function Step3({
  vehicle,
  pickup,
  destination,
  currency,
  price,
  onCurrencyChange,
  onPriceChange,
  onConfirm,
  onBack,
  submitting,
}: {
  vehicle: VehicleType;
  pickup: LocationPoint;
  destination: LocationPoint;
  currency: Currency;
  price: string;
  onCurrencyChange: (c: Currency) => void;
  onPriceChange: (p: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const distanceKm = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);
  const distanceDisplay = `~${distanceKm.toFixed(1)} km`;
  const vehicleLabel = VEHICLE_OPTIONS.find((v) => v.type === vehicle)?.label ?? vehicle;
  const pickupDisplay = truncate(pickup.address);
  const destDisplay = truncate(destination.address);
  const priceDisplay = price || '0';
  const confirmDisabled = !price || price === '0' || submitting;
  const confirmBg = confirmDisabled ? COLORS.primaryMuted : COLORS.primary;
  const confirmTextColor = confirmDisabled ? COLORS.textTertiary : '#1A1A1A';

  return (
    <View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 }}>
        Set your price
      </Text>
      <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>
        How much are you offering for this ride?
      </Text>

      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 10 }}>
        Currency
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CURRENCIES.map((c) => {
            const isActive = c === currency;
            const pillBg = isActive ? COLORS.primary : COLORS.surface;
            const pillBorder = isActive ? COLORS.primary : COLORS.border;
            const pillTextColor = isActive ? '#1A1A1A' : COLORS.textSecondary;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  console.log('[RequestRide] Currency selected:', c);
                  onCurrencyChange(c);
                }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: pillBg,
                  borderWidth: 1,
                  borderColor: pillBorder,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: pillTextColor, fontFamily: 'Nunito_700Bold' }}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', marginBottom: 10 }}>
        Your Offer
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: COLORS.primary,
          paddingHorizontal: 16,
          paddingVertical: 4,
          marginBottom: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold', marginRight: 8 }}>
          {currency}
        </Text>
        <TextInput
          value={price}
          onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9]/g, '');
            onPriceChange(cleaned);
          }}
          placeholder="0"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="numeric"
          style={{
            flex: 1,
            fontSize: 28,
            fontWeight: '800',
            color: COLORS.text,
            fontFamily: 'Nunito_800ExtraBold',
            paddingVertical: 12,
          }}
        />
      </View>

      {/* Summary card */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          gap: 10,
          marginBottom: 24,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <VehicleIcon type={vehicle} size={16} color={COLORS.primary} />
          <Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
            {vehicleLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <MapPin size={14} color={COLORS.primary} />
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', flex: 1 }}>
            {pickupDisplay}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Flag size={14} color={COLORS.accent} />
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', flex: 1 }}>
            {destDisplay}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Clock size={14} color={COLORS.textTertiary} />
          <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
            {distanceDisplay}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: COLORS.divider }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <DollarSign size={14} color={COLORS.primary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
            {currency}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
            {priceDisplay}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Step 3 Back pressed');
            onBack();
          }}
          style={{
            flex: 1,
            backgroundColor: COLORS.surface,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>
            ← Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Confirm Request pressed, currency:', currency, 'price:', price);
            onConfirm();
          }}
          disabled={confirmDisabled}
          style={{
            flex: 2,
            backgroundColor: confirmBg,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#1A1A1A" />
            : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: confirmTextColor, fontFamily: 'Nunito_700Bold' }}>
                Confirm Request
              </Text>
            )
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Rider: Waiting / Bargaining / Success / Cancelled ────────────────────────

function WaitingScreen({
  rideRequest,
  vehicle,
  pickup,
  destination,
  currency,
  price,
  screenState,
  onAcceptBargain,
  onRejectBargain,
  onCancel,
  onReset,
  bargainCountdown,
  acceptLoading,
  rejectLoading,
}: {
  rideRequest: RideRequest | null;
  vehicle: VehicleType;
  pickup: LocationPoint;
  destination: LocationPoint;
  currency: Currency;
  price: string;
  screenState: ScreenState;
  onAcceptBargain: () => void;
  onRejectBargain: () => void;
  onCancel: () => void;
  onReset: () => void;
  bargainCountdown: number;
  acceptLoading: boolean;
  rejectLoading: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const vehicleLabel = VEHICLE_OPTIONS.find((v) => v.type === vehicle)?.label ?? vehicle;
  const pickupDisplay = truncate(pickup.address);
  const destDisplay = truncate(destination.address);
  const distanceKm = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);
  const distanceDisplay = `~${distanceKm.toFixed(1)} km`;
  const bargainPrice = rideRequest?.bargain_price;
  const bargainCurrency = rideRequest?.currency ?? currency;
  const bargainPriceStr = bargainPrice !== undefined ? String(bargainPrice) : '';
  const headingText = screenState === 'bargaining' ? 'Driver Counter Offer' : 'Looking for your driver...';
  const isAnimating = screenState === 'waiting' || screenState === 'bargaining';

  useEffect(() => {
    if (!isAnimating) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isAnimating]);

  if (screenState === 'success') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 60, paddingHorizontal: 24 }}>
        <CheckCircle size={72} color={COLORS.success} />
        <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' }}>
          Ride Booked!
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
          Your driver is on the way. Have a safe trip!
        </Text>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Request Another Ride pressed');
            onReset();
          }}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 32,
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' }}>
            Request Another Ride
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screenState === 'cancelled') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 60, paddingHorizontal: 24 }}>
        <XCircle size={72} color={COLORS.danger} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' }}>
          No drivers available
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
          We couldn't find a driver for your request right now.
        </Text>
        <TouchableOpacity
          onPress={() => {
            console.log('[RequestRide] Try Again pressed');
            onReset();
          }}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 32,
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' }}>
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Pulse circle + heading */}
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 24 }}>
        <Animated.View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: COLORS.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pulseAnim }],
            marginBottom: 16,
          }}
        >
          <VehicleIcon type={vehicle} size={36} color={COLORS.primary} />
        </Animated.View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' }}>
          {headingText}
        </Text>
        {screenState === 'waiting' ? (
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginTop: 4, textAlign: 'center' }}>
            Waiting for a driver to accept your request
          </Text>
        ) : null}
      </View>

      {/* Bargain card */}
      {screenState === 'bargaining' && bargainPrice !== undefined ? (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 2,
            borderColor: COLORS.primary,
            marginBottom: 16,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 1,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginBottom: 6 }}>
            A driver has offered:
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.primary, fontFamily: 'Nunito_800ExtraBold' }}>
              {bargainCurrency}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.primary, fontFamily: 'Nunito_800ExtraBold' }}>
              {bargainPriceStr}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: 'Nunito_600SemiBold', marginBottom: 12, textAlign: 'center' }}>
            Auto-rejecting in {bargainCountdown}...
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                console.log('[RequestRide] Reject bargain pressed');
                onRejectBargain();
              }}
              disabled={rejectLoading || acceptLoading}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: COLORS.danger,
                backgroundColor: 'transparent',
              }}
            >
              {rejectLoading
                ? <ActivityIndicator size="small" color={COLORS.danger} />
                : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.danger, fontFamily: 'Nunito_700Bold' }}>
                    Reject
                  </Text>
                )
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                console.log('[RequestRide] Accept bargain pressed, price:', bargainPrice);
                onAcceptBargain();
              }}
              disabled={acceptLoading || rejectLoading}
              style={{
                flex: 2,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: COLORS.success,
              }}
            >
              {acceptLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                      Accept
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                      {bargainCurrency}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                      {bargainPriceStr}
                    </Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Ride summary */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          gap: 10,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <VehicleIcon type={vehicle} size={15} color={COLORS.primary} />
          <Text style={{ fontSize: 14, color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
            {vehicleLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <MapPin size={14} color={COLORS.primary} />
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', flex: 1 }}>
            {pickupDisplay}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Flag size={14} color={COLORS.accent} />
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', flex: 1 }}>
            {destDisplay}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Clock size={14} color={COLORS.textTertiary} />
          <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
            {distanceDisplay}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: COLORS.divider }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <DollarSign size={14} color={COLORS.primary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
            {currency}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
            {price}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => {
          console.log('[RequestRide] Cancel Request pressed, id:', rideRequest?.id);
          onCancel();
        }}
        style={{
          alignSelf: 'center',
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: COLORS.surfaceSecondary,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold' }}>
          Cancel Request
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Driver: Ride Card ────────────────────────────────────────────────────────

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
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <CheckCircle size={15} color="#fff" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' }}>
                    Accept Ride
                  </Text>
                </>
              )
            }
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
            {isLoading
              ? <ActivityIndicator color="#1A1A1A" size="small" />
              : (
                <>
                  <CheckCircle size={15} color="#1A1A1A" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', fontFamily: 'Nunito_700Bold' }}>
                    Mark Complete
                  </Text>
                </>
              )
            }
          </AnimatedPressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RequestsScreen() {
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const isDriver = (profile?.role ?? profile?.user_type) === 'driver';

  // ── Driver state ──
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Rider wizard state ──
  const [step, setStep] = useState<WizardStep>(1);
  const [vehicle, setVehicle] = useState<VehicleType | null>(null);
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [currency, setCurrency] = useState<Currency>('KES');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>('wizard');
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [bargainCountdown, setBargainCountdown] = useState(5);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRejectFiredRef = useRef(false);

  // ── Driver data fetch ──
  const fetchRides = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[RequestsScreen] Fetching driver rides');
    try {
      const data = await apiGet<Ride[]>('/api/rides/available');
      setRides(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[RequestsScreen] Failed to fetch rides:', e);
      setRides([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isDriver) fetchRides();
  }, [isDriver, fetchRides]);

  const handleAccept = async (rideId: string) => {
    console.log('[RequestsScreen] Accept ride pressed:', rideId);
    setActionLoading(rideId);
    try {
      await apiPost(`/api/rides/${rideId}/accept`, {});
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
      await fetchRides(true);
    } catch (e) {
      console.error('[RequestsScreen] Complete failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Rider polling helpers ──
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  function startBargainCountdown(id: string) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setBargainCountdown(5);
    autoRejectFiredRef.current = false;
    let count = 5;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setBargainCountdown(count);
      if (count <= 0 && !autoRejectFiredRef.current) {
        autoRejectFiredRef.current = true;
        if (countdownRef.current) clearInterval(countdownRef.current);
        console.log('[RequestRide] Auto-rejecting bargain for:', id);
        doRejectBargain(id, true);
      }
    }, 1000);
  }

  function startPolling(id: string) {
    stopPolling();
    autoRejectFiredRef.current = false;
    pollRef.current = setInterval(async () => {
      console.log('[RequestRide] Polling ride request:', id);
      try {
        const data = await apiGet<RideRequest>(`/api/ride-requests/${id}`);
        setRideRequest(data);
        if (data.status === 'bargaining') {
          setScreenState('bargaining');
          stopPolling();
          startBargainCountdown(id);
        } else if (data.status === 'accepted') {
          setScreenState('success');
          stopPolling();
        } else if (data.status === 'cancelled') {
          setScreenState('cancelled');
          stopPolling();
        }
      } catch (e) {
        console.error('[RequestRide] Poll error:', e);
      }
    }, 4000);
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // ── Rider actions ──
  async function handleConfirmRequest() {
    if (!vehicle || !pickup || !destination || !price) return;
    console.log('[RequestRide] POST /api/ride-requests', { vehicle, pickup: pickup.address, destination: destination.address, currency, price });
    setSubmitting(true);
    try {
      const body = {
        vehicle_type: vehicle,
        pickup_location: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_location: destination.address,
        dropoff_lat: destination.lat,
        dropoff_lng: destination.lng,
        currency,
        fare: Number(price),
      };
      const data = await apiPost<RideRequest>('/api/ride-requests', body);
      console.log('[RequestRide] Ride request created:', data);
      setRideRequest(data);
      setScreenState('waiting');
      startPolling(data.id);
    } catch (e) {
      console.error('[RequestRide] Failed to create ride request:', e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptBargain() {
    if (!rideRequest) return;
    console.log('[RequestRide] POST /api/ride-requests/:id/rider-response accepted=true, id:', rideRequest.id);
    setAcceptLoading(true);
    stopPolling();
    try {
      await apiPost(`/api/ride-requests/${rideRequest.id}/rider-response`, { accepted: true });
      setScreenState('success');
    } catch (e) {
      console.error('[RequestRide] Accept bargain failed:', e);
    } finally {
      setAcceptLoading(false);
    }
  }

  async function doRejectBargain(id: string, auto: boolean) {
    console.log('[RequestRide] POST /api/ride-requests/:id/rider-response accepted=false, id:', id, 'auto:', auto);
    if (!auto) setRejectLoading(true);
    stopPolling();
    try {
      await apiPost(`/api/ride-requests/${id}/rider-response`, { accepted: false });
      setScreenState('waiting');
      startPolling(id);
    } catch (e) {
      console.error('[RequestRide] Reject bargain failed:', e);
    } finally {
      if (!auto) setRejectLoading(false);
    }
  }

  function handleRejectBargain() {
    if (!rideRequest) return;
    doRejectBargain(rideRequest.id, false);
  }

  async function handleCancelRequest() {
    if (!rideRequest) { resetWizard(); return; }
    console.log('[RequestRide] DELETE /api/ride-requests/:id, id:', rideRequest.id);
    stopPolling();
    try {
      await apiDelete(`/api/ride-requests/${rideRequest.id}`);
    } catch (e) {
      console.error('[RequestRide] Cancel request failed:', e);
    } finally {
      resetWizard();
    }
  }

  function resetWizard() {
    console.log('[RequestRide] Resetting wizard to Step 1');
    stopPolling();
    setStep(1);
    setVehicle(null);
    setPickup(null);
    setDestination(null);
    setCurrency('KES');
    setPrice('');
    setRideRequest(null);
    setScreenState('wizard');
    setBargainCountdown(5);
    autoRejectFiredRef.current = false;
  }

  // ── Driver view ──
  if (isDriver) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>
            Available Rides
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginTop: 2 }}>
            Pending ride requests near you
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
            <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
          ) : rides.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Car size={36} color={COLORS.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' }}>
                No pending rides right now
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center', maxWidth: 260 }}>
                New requests from riders will appear here
              </Text>
            </View>
          ) : (
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
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Rider view ──
  const isWaiting = screenState !== 'wizard';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold', marginBottom: 2 }}>
          Request a Ride
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginBottom: 20 }}>
          Where are you going today?
        </Text>

        {!isWaiting ? <StepIndicator step={step} /> : null}

        {screenState === 'wizard' && step === 1 ? (
          <Step1
            selected={vehicle}
            onSelect={setVehicle}
            onNext={() => setStep(2)}
          />
        ) : null}

        {screenState === 'wizard' && step === 2 ? (
          <Step2
            pickup={pickup}
            destination={destination}
            onPickupChange={setPickup}
            onDestinationChange={setDestination}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        ) : null}

        {screenState === 'wizard' && step === 3 && vehicle && pickup && destination ? (
          <Step3
            vehicle={vehicle}
            pickup={pickup}
            destination={destination}
            currency={currency}
            price={price}
            onCurrencyChange={setCurrency}
            onPriceChange={setPrice}
            onConfirm={handleConfirmRequest}
            onBack={() => setStep(2)}
            submitting={submitting}
          />
        ) : null}

        {isWaiting && vehicle && pickup && destination ? (
          <WaitingScreen
            rideRequest={rideRequest}
            vehicle={vehicle}
            pickup={pickup}
            destination={destination}
            currency={currency}
            price={price}
            screenState={screenState}
            onAcceptBargain={handleAcceptBargain}
            onRejectBargain={handleRejectBargain}
            onCancel={handleCancelRequest}
            onReset={resetWizard}
            bargainCountdown={bargainCountdown}
            acceptLoading={acceptLoading}
            rejectLoading={rejectLoading}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
