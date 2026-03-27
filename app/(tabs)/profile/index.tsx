import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTranslation } from '@/hooks/useTranslation';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ProfileCard } from '@/components/ProfileCard';
import { StatCard } from '@/components/StatCard';
import { apiGet } from '@/utils/api';
import { LogOut, Car, Calendar } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverDashboard {
  rides_count: number;
  total_earnings: number;
  total_km: number;
  currency?: string;
}

interface RideRequest {
  id: string;
  pickup_location: string;
  destination: string;
  price_offer: number;
  currency: string;
  status: string;
  created_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  const num = Number(amount);
  return `${String(currency).toUpperCase()} ${num.toLocaleString()}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const COUNTRY_CURRENCY: Record<string, string> = {
  kenya: 'KES',
  tanzania: 'TZS',
  uganda: 'UGX',
};

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
    <View
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
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

// ─── Driver Profile ───────────────────────────────────────────────────────────

function DriverProfile() {
  const { profile, driverDetails } = useProfile();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const currency = COUNTRY_CURRENCY[profile?.country || 'kenya'];

  const fetchDashboard = useCallback(async (date: Date) => {
    setDashLoading(true);
    const dateStr = toYMD(date);
    console.log('[DriverProfile] Fetching dashboard for date:', dateStr);
    try {
      const data = await apiGet<DriverDashboard>(`/api/driver/dashboard?date=${dateStr}`);
      setDashboard(data);
    } catch (e) {
      console.error('[DriverProfile] Dashboard fetch failed:', e);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, []);

  const handleDateChange = (_: any, date?: Date) => {
    setShowPicker(false);
    if (date) {
      console.log('[DriverProfile] Date changed to:', toYMD(date));
      setSelectedDate(date);
      fetchDashboard(date);
    }
  };

  const handleSignOut = async () => {
    console.log('[DriverProfile] Sign out pressed');
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const ridesCountDisplay = dashboard ? String(dashboard.rides_count ?? 0) : '—';
  const earningsDisplay = dashboard ? formatCurrency(dashboard.total_earnings ?? 0, dashboard.currency || currency) : '—';
  const kmDisplay = dashboard ? `${Number(dashboard.total_km ?? 0).toFixed(1)} km` : '—';
  const memberSinceDisplay = formatDate(profile?.created_at);
  const dateLabel = selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>
          {t('profile')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {/* Profile card */}
        {profile && <ProfileCard profile={profile} />}

        {/* Vehicle card */}
        {driverDetails && (
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: '0 1px 6px rgba(90,60,0,0.05)',
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Car size={18} color={COLORS.primary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
                Vehicle Details
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Make
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
                  {driverDetails.car_make}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Registration
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
                  {driverDetails.car_registration}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Color
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
                  {driverDetails.car_color}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Dashboard section */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
              {t('dashboard')}
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[DriverProfile] Date picker opened');
                setShowPicker(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: COLORS.primary,
              }}
            >
              <Calendar size={14} color={COLORS.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>
                {dateLabel}
              </Text>
            </AnimatedPressable>
          </View>

          {showPicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          {dashLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ width: '48%' }}>
                <StatCard icon="🚗" label={t('ridesCount')} value={ridesCountDisplay} />
              </View>
              <View style={{ width: '48%' }}>
                <StatCard icon="💰" label={t('earnings')} value={earningsDisplay} />
              </View>
              <View style={{ width: '48%' }}>
                <StatCard icon="📍" label={t('kmDriven')} value={kmDisplay} />
              </View>
              <View style={{ width: '48%' }}>
                <StatCard icon="📅" label={t('memberSince')} value={memberSinceDisplay} />
              </View>
            </View>
          )}
        </View>

        {/* Sign out */}
        <AnimatedPressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={{
            backgroundColor: COLORS.dangerMuted,
            borderRadius: 14,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: COLORS.danger,
            marginTop: 8,
          }}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <LogOut size={18} color={COLORS.danger} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.danger, fontFamily: 'Nunito_700Bold' }}>
                {t('signOut')}
              </Text>
            </>
          )}
        </AnimatedPressable>
      </View>
    </ScrollView>
  );
}

// ─── Rider Profile ────────────────────────────────────────────────────────────

function RiderProfile() {
  const { profile } = useProfile();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [recentRides, setRecentRides] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    console.log('[RiderProfile] Fetching recent rides');
    apiGet<{ requests: RideRequest[] }>('/api/rides/my-requests')
      .then((data) => setRecentRides((data.requests || []).slice(0, 5)))
      .catch((e) => console.error('[RiderProfile] Failed to fetch rides:', e))
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    console.log('[RiderProfile] Sign out pressed');
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, fontFamily: 'Nunito_800ExtraBold' }}>
          {t('profile')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {/* Profile card */}
        {profile && <ProfileCard profile={profile} />}

        {/* Recent rides */}
        <View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold', marginBottom: 12 }}>
            Recent Requests
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : recentRides.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 20,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 22 }}>🚗</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }}>
                No rides yet
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
                Your recent ride requests will appear here
              </Text>
            </View>
          ) : (
            recentRides.map((ride, i) => {
              const priceDisplay = formatCurrency(ride.price_offer, ride.currency);
              const dateDisplay = formatDate(ride.created_at);
              return (
                <View
                  key={ride.id}
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    boxShadow: '0 1px 4px rgba(90,60,0,0.04)',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: 'Nunito_600SemiBold' }} numberOfLines={1}>
                        {ride.pickup_location}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular' }} numberOfLines={1}>
                        → {ride.destination}
                      </Text>
                    </View>
                    <StatusBadge status={ride.status} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, fontFamily: 'Nunito_700Bold' }}>
                      {priceDisplay}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' }}>
                      {dateDisplay}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Sign out */}
        <AnimatedPressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={{
            backgroundColor: COLORS.dangerMuted,
            borderRadius: 14,
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: COLORS.danger,
            marginTop: 8,
          }}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <LogOut size={18} color={COLORS.danger} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.danger, fontFamily: 'Nunito_700Bold' }}>
                {t('signOut')}
              </Text>
            </>
          )}
        </AnimatedPressable>
      </View>
    </ScrollView>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { profile, profileLoading } = useProfile();

  if (profileLoading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (profile.user_type === 'driver') {
    return <DriverProfile />;
  }
  return <RiderProfile />;
}
