import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { apiGet } from '@/utils/api';
import { COLORS } from '@/constants/colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { StatCard } from '@/components/StatCard';
import { LogOut, Phone, Mail } from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiProfile {
  id: string;
  full_name: string;
  phone?: string;
  mobile_number?: string;
  email: string;
  role?: 'passenger' | 'driver';
  user_type?: 'passenger' | 'driver';
  vehicle_make: string | null;
  vehicle_model: string | null;
  license_plate: string | null;
  national_id: string | null;
  created_at: string;
}

interface RideItem {
  id: string;
  pickup_location: string;
  destination: string;
  distance_km: number | null;
  price_offer: number;
  bargain_price: number | null;
  final_price: number;
  currency: string;
  status: string;
  created_at: string;
}

interface RideStats {
  total_rides: number;
  total_earnings: number;
  total_distance_km: number;
  registration_date: string;
  rides: RideItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNumber(n: number): string {
  return Number(n).toLocaleString('en-US');
}

function getInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const CARD_STYLE = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
  marginBottom: 16,
} as const;

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.primary,
  bargaining: '#F97316',
  accepted: '#22C55E',
  completed: '#22C55E',
  cancelled: '#EF4444',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status.toLowerCase()] || COLORS.textTertiary;
  const bgColor = `${color}20`;
  const borderColor = `${color}40`;
  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color,
          fontFamily: 'Nunito_600SemiBold',
          textTransform: 'capitalize',
        }}
      >
        {status}
      </Text>
    </View>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const initials = getInitials(name);
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F5C518',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: '800',
          color: '#1a1a1a',
          fontFamily: 'Nunito_800ExtraBold',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

function RoleBadge({ role }: { role?: 'driver' | 'passenger' | null }) {
  if (!role) return null;
  const isDriver = role === 'driver';
  const bg = isDriver ? '#1a1a1a' : '#F5C518';
  const textColor = isDriver ? '#FFFFFF' : '#1a1a1a';
  const label = isDriver ? 'Driver/Rider' : 'Passenger';
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: textColor,
          fontFamily: 'Nunito_700Bold',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProfileHeaderCard({ profile, authEmail }: { profile: ApiProfile; authEmail?: string }) {
  const phoneDisplay = profile.phone || profile.mobile_number || null;
  const emailDisplay = profile.email || authEmail || null;
  const nameDisplay = profile.full_name || emailDisplay?.split('@')[0] || '—';
  return (
    <View style={CARD_STYLE}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <AvatarCircle name={nameDisplay} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#1A1A1A',
              fontFamily: 'Nunito_700Bold',
            }}
          >
            {nameDisplay}
          </Text>
          <RoleBadge role={profile.role} />
        </View>
      </View>
      <View
        style={{
          marginTop: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,0,0,0.06)',
          paddingTop: 14,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Phone size={16} color="#F5C518" />
          <Text
            style={{
              fontSize: 14,
              color: phoneDisplay ? '#1A1A1A' : '#AAAAAA',
              fontFamily: 'Nunito_400Regular',
            }}
          >
            {phoneDisplay ?? 'Not set'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Mail size={16} color="#F5C518" />
          <Text
            style={{
              fontSize: 14,
              color: emailDisplay ? '#1A1A1A' : '#AAAAAA',
              fontFamily: 'Nunito_400Regular',
            }}
          >
            {emailDisplay ?? 'Not set'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VehicleDetailsCard({ profile }: { profile: ApiProfile }) {
  const makeDisplay = profile.vehicle_make || '—';
  const modelDisplay = profile.vehicle_model || '—';
  const plateDisplay = profile.license_plate || '—';
  const idDisplay = profile.national_id || '—';
  return (
    <View style={CARD_STYLE}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Text style={{ fontSize: 16 }}>🚗</Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Nunito_700Bold',
          }}
        >
          Vehicle Details
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <VehicleRow label="Make" value={makeDisplay} />
        <VehicleRow label="Model" value={modelDisplay} />
        <VehicleRow label="License Plate" value={plateDisplay} bold />
        <VehicleRow label="National ID" value={idDisplay} />
      </View>
    </View>
  );
}

function VehicleRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: '#888',
          fontFamily: 'Nunito_400Regular',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: bold ? 16 : 14,
          fontWeight: bold ? '700' : '600',
          color: '#1A1A1A',
          fontFamily: bold ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: {
  fromDate: Date;
  toDate: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
}) {
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  const fromLabel = formatDate(fromDate.toISOString());
  const toLabel = formatDate(toDate.toISOString());

  const handleFromPress = () => {
    console.log('[DateRangePicker] From date picker opened');
    setShowFrom(true);
  };

  const handleToPress = () => {
    console.log('[DateRangePicker] To date picker opened');
    setShowTo(true);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: '#888',
            fontFamily: 'Nunito_600SemiBold',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          From
        </Text>
        <TouchableOpacity
          onPress={handleFromPress}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(245,166,35,0.4)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13 }}>📅</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#1A1A1A',
              fontFamily: 'Nunito_600SemiBold',
            }}
          >
            {fromLabel}
          </Text>
        </TouchableOpacity>
        {showFrom && (
          <DateTimePicker
            value={fromDate}
            mode="date"
            display="default"
            maximumDate={toDate}
            onChange={(_: any, date?: Date) => {
              setShowFrom(Platform.OS === 'ios');
              if (date) {
                console.log('[DateRangePicker] From date changed:', toYMD(date));
                onFromChange(date);
              }
            }}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: '#888',
            fontFamily: 'Nunito_600SemiBold',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          To
        </Text>
        <TouchableOpacity
          onPress={handleToPress}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(245,166,35,0.4)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13 }}>📅</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#1A1A1A',
              fontFamily: 'Nunito_600SemiBold',
            }}
          >
            {toLabel}
          </Text>
        </TouchableOpacity>
        {showTo && (
          <DateTimePicker
            value={toDate}
            mode="date"
            display="default"
            minimumDate={fromDate}
            maximumDate={new Date()}
            onChange={(_: any, date?: Date) => {
              setShowTo(Platform.OS === 'ios');
              if (date) {
                console.log('[DateRangePicker] To date changed:', toYMD(date));
                onToChange(date);
              }
            }}
          />
        )}
      </View>
    </View>
  );
}

function RideHistoryItem({ ride }: { ride: RideItem }) {
  const currencyDisplay = String(ride.currency || 'KES').toUpperCase();
  const finalPriceDisplay = formatNumber(Number(ride.final_price || 0));
  const priceLabel = `${currencyDisplay} ${finalPriceDisplay}`;
  const dateDisplay = formatDate(ride.created_at);
  const destinationDisplay = ride.destination || '—';
  const routeDisplay = `${ride.pickup_location || '—'} → ${ride.destination || '—'}`;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: '#1A1A1A',
              fontFamily: 'Nunito_700Bold',
              marginBottom: 3,
            }}
            numberOfLines={1}
          >
            {destinationDisplay}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#888',
              fontFamily: 'Nunito_400Regular',
            }}
            numberOfLines={1}
          >
            {routeDisplay}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            color: '#888',
            fontFamily: 'Nunito_400Regular',
          }}
        >
          {dateDisplay}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: '#F5A623',
            fontFamily: 'Nunito_700Bold',
          }}
        >
          {priceLabel}
        </Text>
        <StatusBadge status={ride.status} />
      </View>
    </View>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    console.log('[ProfileScreen] Sign out pressed');
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AnimatedPressable
      onPress={handleSignOut}
      disabled={signingOut}
      style={{
        backgroundColor: 'rgba(245,197,24,0.12)',
        borderRadius: 14,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#F5C518',
        marginTop: 4,
        marginBottom: 8,
      }}
    >
      {signingOut ? (
        <ActivityIndicator color="#F5C518" />
      ) : (
        <>
          <LogOut size={18} color="#1A1A1A" />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: '#1A1A1A',
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Sign Out
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

// ─── Driver Profile ───────────────────────────────────────────────────────────

function DriverProfile({ profile, authEmail }: { profile: ApiProfile; authEmail?: string }) {
  const insets = useSafeAreaInsets();

  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [stats, setStats] = useState<RideStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = useCallback(async (from: Date, to: Date) => {
    console.log('[DriverProfile] Fetching ride-stats from:', toYMD(from), 'to:', toYMD(to));
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await apiGet<RideStats>(
        `/api/ride-stats?from=${toYMD(from)}&to=${toYMD(to)}&role=driver`
      );
      console.log('[DriverProfile] ride-stats response:', data);
      setStats(data);
    } catch (e: any) {
      console.error('[DriverProfile] ride-stats fetch failed:', e);
      setStatsError(e?.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(fromDate, toDate);
  }, []);

  const handleFromChange = (d: Date) => {
    setFromDate(d);
    fetchStats(d, toDate);
  };

  const handleToChange = (d: Date) => {
    setToDate(d);
    fetchStats(fromDate, d);
  };

  const totalRidesDisplay = stats ? formatNumber(stats.total_rides) : '—';
  const currency =
    stats && stats.rides && stats.rides.length > 0
      ? String(stats.rides[0].currency || 'KES').toUpperCase()
      : 'KES';
  const earningsDisplay = stats
    ? `${currency} ${formatNumber(Number(stats.total_earnings || 0))}`
    : '—';
  const distanceDisplay = stats
    ? `${Number(stats.total_distance_km || 0).toFixed(1)} km`
    : '—';
  const memberSince = formatDate(profile.created_at);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAF7F0' }}
      contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 8 }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: '#1A1A1A',
            fontFamily: 'Nunito_800ExtraBold',
          }}
        >
          Profile
        </Text>
      </View>

      <ProfileHeaderCard profile={profile} authEmail={authEmail} />
      <VehicleDetailsCard profile={profile} />

      {/* Ride History */}
      <View style={CARD_STYLE}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Nunito_700Bold',
            marginBottom: 14,
          }}
        >
          Ride History
        </Text>

        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
        />

        {statsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color="#F5A623" size="large" />
          </View>
        ) : statsError ? (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
            <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
              {statsError}
            </Text>
            <TouchableOpacity
              onPress={() => {
                console.log('[DriverProfile] Retry stats fetch pressed');
                fetchStats(fromDate, toDate);
              }}
              style={{
                backgroundColor: '#F5A623',
                borderRadius: 10,
                paddingHorizontal: 20,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard icon="🚗" label="Rides" value={totalRidesDisplay} />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard icon="💰" label="Earnings" value={earningsDisplay} />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard icon="📍" label="Distance" value={distanceDisplay} />
              </View>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: '#888',
                fontFamily: 'Nunito_400Regular',
                marginBottom: 16,
              }}
            >
              Member since {memberSince}
            </Text>

            {stats && stats.rides && stats.rides.length > 0 ? (
              stats.rides.map((ride) => <RideHistoryItem key={ride.id} ride={ride} />)
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 14, color: '#888', fontFamily: 'Nunito_400Regular' }}>
                  No rides in this period
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <SignOutButton />
    </ScrollView>
  );
}

// ─── Rider Profile ────────────────────────────────────────────────────────────

function RiderProfile({ profile, authEmail }: { profile: ApiProfile; authEmail?: string }) {
  const insets = useSafeAreaInsets();

  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [stats, setStats] = useState<RideStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = useCallback(async (from: Date, to: Date) => {
    console.log('[RiderProfile] Fetching ride-stats from:', toYMD(from), 'to:', toYMD(to));
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await apiGet<RideStats>(
        `/api/ride-stats?from=${toYMD(from)}&to=${toYMD(to)}&role=passenger`
      );
      console.log('[RiderProfile] ride-stats response:', data);
      setStats(data);
    } catch (e: any) {
      console.error('[RiderProfile] ride-stats fetch failed:', e);
      setStatsError(e?.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(fromDate, toDate);
  }, []);

  const handleFromChange = (d: Date) => {
    setFromDate(d);
    fetchStats(d, toDate);
  };

  const handleToChange = (d: Date) => {
    setToDate(d);
    fetchStats(fromDate, d);
  };

  const totalRidesDisplay = stats ? formatNumber(stats.total_rides) : '—';
  const distanceDisplay = stats
    ? `${Number(stats.total_distance_km || 0).toFixed(1)} km`
    : '—';
  const memberSince = formatDate(profile.created_at);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAF7F0' }}
      contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 8 }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: '#1A1A1A',
            fontFamily: 'Nunito_800ExtraBold',
          }}
        >
          Profile
        </Text>
      </View>

      <ProfileHeaderCard profile={profile} authEmail={authEmail} />

      {/* My Rides */}
      <View style={CARD_STYLE}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Nunito_700Bold',
            marginBottom: 14,
          }}
        >
          My Rides
        </Text>

        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
        />

        {statsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color="#F5A623" size="large" />
          </View>
        ) : statsError ? (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
            <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
              {statsError}
            </Text>
            <TouchableOpacity
              onPress={() => {
                console.log('[RiderProfile] Retry stats fetch pressed');
                fetchStats(fromDate, toDate);
              }}
              style={{
                backgroundColor: '#F5A623',
                borderRadius: 10,
                paddingHorizontal: 20,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard icon="🚗" label="Rides" value={totalRidesDisplay} />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard icon="📍" label="Distance" value={distanceDisplay} />
              </View>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: '#888',
                fontFamily: 'Nunito_400Regular',
                marginBottom: 16,
              }}
            >
              Member since {memberSince}
            </Text>

            {stats && stats.rides && stats.rides.length > 0 ? (
              stats.rides.map((ride) => <RideHistoryItem key={ride.id} ride={ride} />)
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 14, color: '#888', fontFamily: 'Nunito_400Regular' }}>
                  No rides in this period
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <SignOutButton />
    </ScrollView>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = useAuth();
  const { profile: ctxProfile } = useProfile();
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    console.log('[ProfileScreen] Fetching /api/profiles/me');
    setLoading(true);
    setError(null);
    try {
      const raw = await apiGet<any>('/api/profiles/me');
      console.log('[ProfileScreen] Profile raw response — phone:', raw.phone, 'mobile_number:', raw.mobile_number, 'phone_number:', raw.phone_number, 'name:', raw.name, 'full_name:', raw.full_name);
      const normalizedName: string = raw.full_name || raw.name ||
        ((raw.first_name || raw.last_name) ? `${raw.first_name || ''} ${raw.last_name || ''}`.trim() : '');
      const normalizedPhone: string = raw.phone || raw.mobile_number || raw.phone_number || '';
      const ctxRole = (ctxProfile?.user_type ?? ctxProfile?.role ?? '').toLowerCase();
      const rawRole = ((raw?.user_type ?? raw?.role ?? '') as string).toLowerCase();
      const normalizedRole: 'passenger' | 'driver' =
        ctxRole === 'driver' || ctxRole === 'passenger'
          ? (ctxRole as 'driver' | 'passenger')
          : rawRole === 'driver'
          ? 'driver'
          : 'passenger';
      console.log('[ProfileScreen] normalizedRole — ctx:', ctxRole, 'raw:', rawRole, 'resolved:', normalizedRole);
      const data: ApiProfile = {
        ...raw,
        full_name: normalizedName,
        role: normalizedRole,
        user_type: normalizedRole,
        phone: normalizedPhone,
        mobile_number: normalizedPhone,
      };
      console.log('[ProfileScreen] Profile normalized — role:', data.role, 'full_name:', data.full_name, 'phone:', data.phone);
      setProfile(data);
    } catch (e: any) {
      console.error('[ProfileScreen] Profile fetch failed:', e);
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [ctxProfile]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user, ctxProfile]);

  // Sync role from context whenever ctxProfile updates, without a full re-fetch
  useEffect(() => {
    if (ctxProfile && profile) {
      const ctxRole = (ctxProfile.role ?? ctxProfile.user_type ?? '').toLowerCase();
      if ((ctxRole === 'driver' || ctxRole === 'passenger') && profile.role !== ctxRole) {
        console.log('[ProfileScreen] Syncing role from ctxProfile:', ctxRole);
        setProfile(prev => prev ? { ...prev, role: ctxRole as 'driver' | 'passenger', user_type: ctxRole as 'driver' | 'passenger' } : prev);
      }
    }
  }, [ctxProfile]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FAF7F0',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FAF7F0',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <Text style={{ fontSize: 16, color: '#EF4444', fontFamily: 'Nunito_400Regular', textAlign: 'center' }}>
          {error || 'Could not load profile'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            console.log('[ProfileScreen] Retry profile fetch pressed');
            fetchProfile();
          }}
          style={{
            backgroundColor: '#F5A623',
            borderRadius: 12,
            paddingHorizontal: 28,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authEmail = user?.email ?? undefined;
  if (profile.role === 'driver') {
    return <DriverProfile profile={profile} authEmail={authEmail} />;
  }
  return <RiderProfile profile={profile} authEmail={authEmail} />;
}
