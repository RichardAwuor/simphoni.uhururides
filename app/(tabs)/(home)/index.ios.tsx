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
  StyleSheet,
  Animated,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { apiGet, apiPost, apiPut } from '@/utils/api';
import { MapPin, Flag, Car, X, Phone, CheckCircle } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequest {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  destination: string;
  distance_km: number | null;
  price_offer: number;
  currency: string;
  bargain_price: number | null;
  bargain_percent: number | null;
  status: 'pending' | 'bargaining' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  routing_count: number;
  rider_phone: string | null;
  rider_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DriverStatus {
  is_muted: boolean;
  is_available: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { label: 'KES — Kenya', value: 'KES' },
  { label: 'UGX — Uganda', value: 'UGX' },
  { label: 'TZS — Tanzania', value: 'TZS' },
  { label: 'RWF — Rwanda', value: 'RWF' },
  { label: 'ETB — Ethiopia', value: 'ETB' },
];

function formatPrice(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '';
  return `${String(currency).toUpperCase()} ${Number(amount).toLocaleString()}`;
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

// ─── Driver Screen ────────────────────────────────────────────────────────────

function DriverRidesScreen() {
  const insets = useSafeAreaInsets();
  const [isMuted, setIsMuted] = useState(false);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [bargainModal, setBargainModal] = useState<RideRequest | null>(null);
  const [acceptedRide, setAcceptedRide] = useState<RideRequest | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    console.log('[DriverRidesScreen] Fetching initial driver status');
    apiGet<DriverStatus>('/api/driver-status')
      .then((data) => {
        console.log('[DriverRidesScreen] Driver status loaded:', data);
        setIsMuted(data.is_muted);
      })
      .catch((e) => console.error('[DriverRidesScreen] Failed to load driver status:', e));
  }, []);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    console.log('[DriverRidesScreen] Polling ride requests');
    try {
      const data = await apiGet<RideRequest[]>('/api/ride-requests?role=driver');
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      if (acceptedRide) {
        const updated = list.find((r) => r.id === acceptedRide.id);
        if (updated) setAcceptedRide(updated);
      }
    } catch (e) {
      console.error('[DriverRidesScreen] Failed to fetch requests:', e);
    } finally {
      setLoading(false);
    }
  }, [acceptedRide]);

  useEffect(() => {
    fetchRequests();
    intervalRef.current = setInterval(() => fetchRequests(true), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRequests]);

  const toggleMute = async (val: boolean) => {
    console.log('[DriverRidesScreen] Toggle mute:', val);
    setIsMuted(val);
    try {
      await apiPut('/api/driver-status', { is_muted: val });
      console.log('[DriverRidesScreen] Mute status updated to:', val);
    } catch (e) {
      console.error('[DriverRidesScreen] Failed to update mute status:', e);
      setIsMuted(!val);
    }
  };

  const handleAccept = async (req: RideRequest) => {
    console.log('[DriverRidesScreen] Accept pressed for ride:', req.id);
    setActionLoading(true);
    try {
      await apiPost(`/api/ride-requests/${req.id}/accept`, {});
      console.log('[DriverRidesScreen] Ride accepted:', req.id);
      await fetchRequests(true);
      const updated = requests.find((r) => r.id === req.id);
      setAcceptedRide(updated || { ...req, status: 'accepted' });
    } catch (e) {
      console.error('[DriverRidesScreen] Accept failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnore = async (id: string) => {
    console.log('[DriverRidesScreen] Ignore pressed for ride:', id);
    setActionLoading(true);
    try {
      await apiPost(`/api/ride-requests/${id}/ignore`, {});
      console.log('[DriverRidesScreen] Ride ignored:', id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('[DriverRidesScreen] Ignore failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBargainSubmit = async (req: RideRequest, pct: 10 | 25 | 50) => {
    console.log('[DriverRidesScreen] Bargain submit:', pct, '% for ride:', req.id);
    setActionLoading(true);
    try {
      await apiPost(`/api/ride-requests/${req.id}/bargain`, { bargain_percent: pct });
      console.log('[DriverRidesScreen] Bargain sent:', pct, '% for ride:', req.id);
      setBargainModal(null);
      await fetchRequests(true);
    } catch (e) {
      console.error('[DriverRidesScreen] Bargain failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const activeRequest = requests.find(
    (r) => r.status === 'pending' || r.status === 'bargaining'
  ) || null;

  const displayAccepted = acceptedRide && acceptedRide.status === 'accepted';
  const muteLabelColor = isMuted ? COLORS.danger : COLORS.success;
  const muteLabel = isMuted ? 'Unmute' : 'Mute';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Rides</Text>
        <View style={styles.muteRow}>
          <Text style={[styles.muteLabel, { color: muteLabelColor }]}>{muteLabel}</Text>
          <Switch
            value={!isMuted}
            onValueChange={(val) => {
              console.log('[DriverRidesScreen] Switch toggled, new isMuted:', !val);
              toggleMute(!val);
            }}
            trackColor={{ false: COLORS.danger, true: COLORS.success }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {isMuted && (
        <AnimatedPressable onPress={() => toggleMute(false)}>
          <View style={styles.mutedBanner}>
            <Text style={styles.mutedBannerText}>
              Ride requests are muted. Tap to unmute.
            </Text>
          </View>
        </AnimatedPressable>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : isMuted ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Requests Muted</Text>
            <Text style={styles.emptySubtitle}>Toggle the switch above to start receiving ride requests.</Text>
          </View>
        ) : displayAccepted && acceptedRide ? (
          <AcceptedRideCard ride={acceptedRide} />
        ) : activeRequest ? (
          <ActiveRequestCard
            req={activeRequest}
            actionLoading={actionLoading}
            onAccept={handleAccept}
            onBargain={(req) => {
              console.log('[DriverRidesScreen] Bargain modal opened for ride:', req.id);
              setBargainModal(req);
            }}
            onIgnore={handleIgnore}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Car size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No ride requests right now</Text>
            <Text style={styles.emptySubtitle}>
              You'll be notified when a nearby rider requests a ride.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!bargainModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Counter Offer</Text>
              <AnimatedPressable onPress={() => setBargainModal(null)}>
                <X size={22} color={COLORS.textSecondary} />
              </AnimatedPressable>
            </View>
            {bargainModal && (
              <>
                <Text style={styles.bargainCurrentOffer}>
                  Current offer: {formatPrice(bargainModal.price_offer, bargainModal.currency)}
                </Text>
                {([10, 25, 50] as const).map((pct) => {
                  const newPrice = Math.round(Number(bargainModal.price_offer) * (1 + pct / 100));
                  const newPriceDisplay = formatPrice(newPrice, bargainModal.currency);
                  return (
                    <AnimatedPressable
                      key={pct}
                      onPress={() => handleBargainSubmit(bargainModal, pct)}
                      disabled={actionLoading}
                      style={styles.bargainOption}
                    >
                      <Text style={styles.bargainOptionPct}>Bargain {pct}% Up</Text>
                      <Text style={styles.bargainOptionPrice}>{newPriceDisplay}</Text>
                    </AnimatedPressable>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Active Request Card ──────────────────────────────────────────────────────

interface ActiveRequestCardProps {
  req: RideRequest;
  actionLoading: boolean;
  onAccept: (req: RideRequest) => void;
  onBargain: (req: RideRequest) => void;
  onIgnore: (id: string) => void;
}

function ActiveRequestCard({ req, actionLoading, onAccept, onBargain, onIgnore }: ActiveRequestCardProps) {
  const riderInitial = (req.rider_name || 'R')[0].toUpperCase();
  const priceDisplay = formatPrice(req.price_offer, req.currency);
  const bargainPriceDisplay = formatPrice(req.bargain_price, req.currency);
  const hasDistance = req.distance_km != null;
  const distanceText = hasDistance ? `${Number(req.distance_km).toFixed(1)} km away` : '';
  const isBargaining = req.status === 'bargaining';

  return (
    <View style={styles.card}>
      <View style={styles.riderRow}>
        <View style={styles.riderAvatar}>
          <Text style={styles.riderAvatarText}>{riderInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName}>{req.rider_name || 'Rider'}</Text>
          {hasDistance ? <Text style={styles.distanceText}>{distanceText}</Text> : null}
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>{priceDisplay}</Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <MapPin size={15} color={COLORS.primary} />
          <Text style={styles.routeText} numberOfLines={1}>{req.pickup_location}</Text>
        </View>
        <View style={styles.routeRow}>
          <Flag size={15} color={COLORS.accent} />
          <Text style={styles.routeText} numberOfLines={1}>{req.destination}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {isBargaining ? (
        <View style={styles.bargainingBanner}>
          <Text style={styles.bargainingText}>Waiting for rider response...</Text>
          <Text style={styles.bargainingPrice}>{bargainPriceDisplay}</Text>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <AnimatedPressable
            onPress={() => {
              console.log('[ActiveRequestCard] Accept button pressed for ride:', req.id);
              onAccept(req);
            }}
            disabled={actionLoading}
            style={styles.btnAccept}
          >
            <CheckCircle size={15} color="#fff" />
            <Text style={styles.btnAcceptText}>Accept</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[ActiveRequestCard] Bargain button pressed for ride:', req.id);
              onBargain(req);
            }}
            disabled={actionLoading}
            style={styles.btnBargain}
          >
            <Text style={styles.btnBargainText}>Bargain</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              console.log('[ActiveRequestCard] Ignore button pressed for ride:', req.id);
              onIgnore(req.id);
            }}
            disabled={actionLoading}
            style={styles.btnIgnore}
          >
            <X size={14} color={COLORS.danger} />
            <Text style={styles.btnIgnoreText}>Ignore</Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

// ─── Accepted Ride Card ───────────────────────────────────────────────────────

function AcceptedRideCard({ ride }: { ride: RideRequest }) {
  const riderInitial = (ride.rider_name || 'R')[0].toUpperCase();
  const phone = ride.rider_phone || '';
  const priceDisplay = formatPrice(ride.price_offer, ride.currency);

  const handleCall = () => {
    console.log('[AcceptedRideCard] Call Rider pressed, phone:', phone);
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.acceptedBanner}>
        <CheckCircle size={20} color={COLORS.success} />
        <Text style={styles.acceptedBannerText}>Ride Confirmed!</Text>
      </View>

      <View style={styles.riderRow}>
        <View style={styles.riderAvatar}>
          <Text style={styles.riderAvatarText}>{riderInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName}>{ride.rider_name || 'Rider'}</Text>
          <Text style={styles.distanceText}>Driver is on the way</Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>{priceDisplay}</Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <MapPin size={15} color={COLORS.primary} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.pickup_location}</Text>
        </View>
        <View style={styles.routeRow}>
          <Flag size={15} color={COLORS.accent} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.destination}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {phone ? (
        <>
          <Text style={styles.phoneLabel}>Rider's Phone</Text>
          <Text style={styles.phoneNumber}>{phone}</Text>
          <AnimatedPressable onPress={handleCall} style={styles.callBtn}>
            <Phone size={18} color="#fff" />
            <Text style={styles.callBtnText}>Call Rider</Text>
          </AnimatedPressable>
        </>
      ) : (
        <Text style={styles.noPhoneText}>Rider phone not available</Text>
      )}
    </View>
  );
}

// ─── Rider Screen ─────────────────────────────────────────────────────────────

function RiderRidesScreen() {
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState('My current location');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [priceOffer, setPriceOffer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActiveRide = useCallback(async (silent = false) => {
    console.log('[RiderRidesScreen] Polling ride requests');
    try {
      const data = await apiGet<RideRequest[]>('/api/ride-requests?role=rider');
      const list = Array.isArray(data) ? data : [];
      const active = list.find(
        (r) => r.status === 'pending' || r.status === 'bargaining' || r.status === 'accepted'
      ) || list[0] || null;
      setActiveRide(active);
      if (active && (active.status === 'cancelled' || active.status === 'completed')) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (e) {
      console.error('[RiderRidesScreen] Poll failed:', e);
    }
  }, []);

  useEffect(() => {
    fetchActiveRide();
    intervalRef.current = setInterval(() => fetchActiveRide(true), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchActiveRide]);

  const handleSubmit = async () => {
    if (!destination.trim() || !priceOffer.trim()) return;
    console.log('[RiderRidesScreen] Confirm Request pressed:', { pickup, destination, currency, priceOffer });
    setSubmitting(true);
    try {
      const res = await apiPost<RideRequest>('/api/ride-requests', {
        pickup_location: pickup.trim() || 'My current location',
        pickup_lat: 0.3476,
        pickup_lng: 32.5825,
        destination: destination.trim(),
        price_offer: Number(priceOffer),
        currency,
      });
      console.log('[RiderRidesScreen] Ride request created:', res.id);
      setActiveRide(res);
    } catch (e) {
      console.error('[RiderRidesScreen] Create ride request failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRide) return;
    console.log('[RiderRidesScreen] Cancel Request pressed for ride:', activeRide.id);
    setCancelling(true);
    try {
      await apiPost(`/api/ride-requests/${activeRide.id}/cancel`, {});
      console.log('[RiderRidesScreen] Ride cancelled:', activeRide.id);
      await fetchActiveRide(true);
    } catch (e) {
      console.error('[RiderRidesScreen] Cancel failed:', e);
    } finally {
      setCancelling(false);
    }
  };

  const handleRespondBargain = async (accept: boolean) => {
    if (!activeRide) return;
    console.log('[RiderRidesScreen] Respond bargain pressed, accept:', accept, 'ride:', activeRide.id);
    try {
      await apiPost(`/api/ride-requests/${activeRide.id}/respond-bargain`, { accept });
      console.log('[RiderRidesScreen] Bargain response sent, accept:', accept);
      await fetchActiveRide(true);
    } catch (e) {
      console.error('[RiderRidesScreen] Respond bargain failed:', e);
    }
  };

  const handleNewRequest = () => {
    console.log('[RiderRidesScreen] New Request pressed');
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveRide(null);
    setDestination('');
    setPriceOffer('');
    setPickup('My current location');
    intervalRef.current = setInterval(() => fetchActiveRide(true), 4000);
  };

  const canSubmit = destination.trim().length > 0 && priceOffer.trim().length > 0;

  // State D: Accepted
  if (activeRide && activeRide.status === 'accepted') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Your Ride</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.card}>
            <View style={styles.acceptedBanner}>
              <CheckCircle size={22} color={COLORS.success} />
              <Text style={styles.acceptedBannerText}>Ride Confirmed!</Text>
            </View>
            <Text style={styles.acceptedSubtitle}>Driver is on the way</Text>
            <View style={styles.routeContainer}>
              <View style={styles.routeRow}>
                <MapPin size={15} color={COLORS.primary} />
                <Text style={styles.routeText} numberOfLines={1}>{activeRide.pickup_location}</Text>
              </View>
              <View style={styles.routeRow}>
                <Flag size={15} color={COLORS.accent} />
                <Text style={styles.routeText} numberOfLines={1}>{activeRide.destination}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.acceptedFare}>{formatPrice(activeRide.price_offer, activeRide.currency)}</Text>
            <AnimatedPressable onPress={handleNewRequest} style={styles.newRequestBtn}>
              <Text style={styles.newRequestBtnText}>New Request</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // State E: Cancelled
  if (activeRide && activeRide.status === 'cancelled') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Rides</Text>
        </View>
        <View style={styles.centered}>
          <View style={styles.cancelledCard}>
            <Text style={styles.cancelledTitle}>Request Cancelled</Text>
            <Text style={styles.cancelledSubtitle}>
              Maximum routing attempts reached. No driver was found.
            </Text>
            <AnimatedPressable onPress={handleNewRequest} style={styles.newRequestBtn}>
              <Text style={styles.newRequestBtnText}>Try Again</Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    );
  }

  // State C: Bargaining
  if (activeRide && activeRide.status === 'bargaining') {
    const bargainPriceDisplay = formatPrice(activeRide.bargain_price, activeRide.currency);
    const originalPriceDisplay = formatPrice(activeRide.price_offer, activeRide.currency);
    const bargainPct = activeRide.bargain_percent != null ? Number(activeRide.bargain_percent) : 0;
    const acceptLabel = `Accept ${bargainPriceDisplay}`;

    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Counter Offer</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.card}>
            <Text style={styles.bargainCardTitle}>Driver Counter-Offer</Text>
            <Text style={styles.bargainCardSubtitle}>
              The driver has proposed a {bargainPct}% increase
            </Text>
            <Text style={styles.bargainNewPrice}>{bargainPriceDisplay}</Text>
            <Text style={styles.bargainOriginalPrice}>{originalPriceDisplay}</Text>
            <View style={styles.divider} />
            <View style={styles.actionRow}>
              <AnimatedPressable
                onPress={() => handleRespondBargain(true)}
                style={styles.btnAccept}
              >
                <CheckCircle size={15} color="#fff" />
                <Text style={styles.btnAcceptText}>{acceptLabel}</Text>
              </AnimatedPressable>
            </View>
            <AnimatedPressable
              onPress={() => handleRespondBargain(false)}
              style={styles.btnRejectBargain}
            >
              <X size={14} color={COLORS.danger} />
              <Text style={styles.btnRejectBargainText}>Reject &amp; Find Next Driver</Text>
            </AnimatedPressable>
            <Text style={styles.bargainNote}>
              If rejected, your request will be routed to the next nearest driver.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // State B: Pending
  if (activeRide && activeRide.status === 'pending') {
    const priceDisplay = formatPrice(activeRide.price_offer, activeRide.currency);
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Finding Driver</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.card}>
            <View style={styles.searchingRow}>
              <PulsingDot />
              <Text style={styles.searchingText}>Searching for driver...</Text>
            </View>
            <View style={styles.routeContainer}>
              <View style={styles.routeRow}>
                <MapPin size={15} color={COLORS.primary} />
                <Text style={styles.routeText} numberOfLines={1}>{activeRide.pickup_location}</Text>
              </View>
              <View style={styles.routeRow}>
                <Flag size={15} color={COLORS.accent} />
                <Text style={styles.routeText} numberOfLines={1}>{activeRide.destination}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.pendingPrice}>{priceDisplay}</Text>
            <AnimatedPressable
              onPress={handleCancel}
              disabled={cancelling}
              style={styles.cancelBtn}
            >
              {cancelling ? (
                <ActivityIndicator color={COLORS.danger} size="small" />
              ) : (
                <Text style={styles.cancelBtnText}>Cancel Request</Text>
              )}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // State A: Request Form
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

        <Text style={styles.fieldLabel}>Pickup Location</Text>
        <View style={styles.inputRow}>
          <MapPin size={18} color={COLORS.primary} />
          <TextInput
            value={pickup}
            onChangeText={setPickup}
            placeholder="My current location"
            placeholderTextColor={COLORS.textTertiary}
            style={styles.textInput}
          />
        </View>
        <Text style={styles.locationNote}>📍 Location will be captured automatically</Text>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Destination</Text>
        <View style={styles.inputRow}>
          <Flag size={18} color={COLORS.accent} />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Enter destination or landmark"
            placeholderTextColor={COLORS.textTertiary}
            style={styles.textInput}
          />
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Currency</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={currency}
            onValueChange={(val) => {
              console.log('[RiderRidesScreen] Currency changed to:', val);
              setCurrency(val);
            }}
            style={styles.picker}
            itemStyle={{ color: '#1A1A1A', fontSize: 15 }}
          >
            {CURRENCIES.map((c) => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Price Offer</Text>
        <View style={styles.inputRow}>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>{currency}</Text>
          </View>
          <TextInput
            value={priceOffer}
            onChangeText={setPriceOffer}
            placeholder="e.g. 5000"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="numeric"
            style={styles.textInput}
          />
        </View>

        <AnimatedPressable
          onPress={() => {
            console.log('[RiderRidesScreen] Confirm Request button pressed');
            handleSubmit();
          }}
          disabled={!canSubmit || submitting}
          style={[styles.confirmBtn, (!canSubmit || submitting) && styles.confirmBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#1A1A1A" />
          ) : (
            <Text style={[styles.confirmBtnText, !canSubmit && styles.confirmBtnTextDisabled]}>
              Confirm Request
            </Text>
          )}
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function RidesScreen() {
  const { profile, profileLoading, refreshProfile } = useProfile();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  console.log('[RidesScreen] render — profileLoading:', profileLoading, 'profile:', profile?.user_type ?? null, 'user:', user?.id ?? null);

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
          <Text style={styles.noProfileTitle}>Profile Not Set Up</Text>
          <Text style={styles.noProfileSubtitle}>
            Please complete your profile to start using rides. Go to the Profile tab to set your role as a rider or driver.
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

  if (profile.user_type === 'driver') {
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
  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muteLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
  },
  mutedBanner: {
    backgroundColor: 'rgba(230,57,70,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  mutedBannerText: {
    fontSize: 13,
    color: '#EF4444',
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
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
  distanceText: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5C4A00',
    fontFamily: 'Nunito_700Bold',
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
  routeText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(245,197,24,0.1)',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnAcceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  btnBargain: {
    flex: 1,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBargainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  btnIgnore: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  btnIgnoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'Nunito_700Bold',
  },
  bargainingBanner: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  bargainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F97316',
    fontFamily: 'Nunito_600SemiBold',
  },
  bargainingPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F97316',
    fontFamily: 'Nunito_800ExtraBold',
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  acceptedBannerText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#22C55E',
    fontFamily: 'Nunito_700Bold',
  },
  acceptedSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginBottom: 14,
  },
  acceptedFare: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 16,
  },
  phoneLabel: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F5A623',
    fontFamily: 'Nunito_700Bold',
    marginBottom: 14,
  },
  callBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  noPhoneText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  bargainCurrentOffer: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
  },
  bargainOption: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderRadius: 14,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  bargainOptionPct: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
  bargainOptionPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C4A00',
    fontFamily: 'Nunito_600SemiBold',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 4,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.2)',
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
  locationNote: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginTop: 6,
    marginLeft: 4,
  },
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,24,0.2)',
    overflow: 'hidden',
  },
  picker: {
    height: 52,
    color: '#1A1A1A',
  },
  currencyBadge: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currencyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C4A00',
    fontFamily: 'Nunito_700Bold',
  },
  confirmBtn: {
    backgroundColor: '#F5A623',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
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
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  searchingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C4A00',
    fontFamily: 'Nunito_600SemiBold',
  },
  pendingPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 16,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'Nunito_700Bold',
  },
  bargainCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
    marginBottom: 6,
  },
  bargainCardSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    marginBottom: 16,
  },
  bargainNewPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F5A623',
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 6,
  },
  bargainOriginalPrice: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textDecorationLine: 'line-through',
    marginBottom: 16,
  },
  btnRejectBargain: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  btnRejectBargainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'Nunito_700Bold',
  },
  bargainNote: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
  cancelledCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    shadowColor: '#5A3C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cancelledTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'Nunito_700Bold',
  },
  cancelledSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
  },
  newRequestBtn: {
    backgroundColor: '#F5A623',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  newRequestBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
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
    alignItems: 'center' as const,
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
    fontWeight: '700' as const,
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center' as const,
  },
  noProfileSubtitle: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center' as const,
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
    fontWeight: '700' as const,
    color: '#1A1A1A',
    fontFamily: 'Nunito_700Bold',
  },
});
