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
import { apiGet } from '@/utils/api';
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
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  license_plate?: string | null;
  national_id?: string | null;
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
  pending: '#F5C518',
  bargaining: '#F97316',
  accepted: '#22C55E',
  completed: '#22C55E',
  cancelled: '#EF4444',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status.toLowerCase()] || '#9CA3AF';
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

function DriverBadge() {
  return (
    <View
      style={{
        backgroundColor: '#F5C518',
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
          color: '#1a1a1a',
          fontFamily: 'Nunito_700Bold',
        }}
      >
        Driver
      </Text>
    </View>
  );
}

function VehicleRow({ label, value }: { label: string; value?: string | null }) {
  const displayValue = value && String(value).trim() ? String(value) : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: '#6B7280',
          fontFamily: 'Nunito_400Regular',
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: displayValue ? '#1A1A1A' : '#AAAAAA',
          fontFamily: 'Nunito_600SemiBold',
          flex: 1,
          textAlign: 'right',
        }}
      >
        {displayValue ?? 'Not set'}
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
    console.log('[DriverProfile] From date picker opened');
    setShowFrom(true);
  };

  const handleToPress = () => {
    console.log('[DriverProfile] To date picker opened');
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
                console.log('[DriverProfile] From date changed:', toYMD(date));
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
                console.log('[DriverProfile] To date changed:', toYMD(date));
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
    console.log('[DriverProfile] Sign out pressed');
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface DriverProfileScreenProps {
  profile: ApiProfile;
  authEmail?: string;
}

export default function DriverProfileScreen({ profile, authEmail }: DriverProfileScreenProps) {
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
        `/api/ride-stats?role=driver&from=${toYMD(from)}&to=${toYMD(to)}`
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

  // Derived display values
  const phoneDisplay = profile.phone || profile.mobile_number || null;
  const emailDisplay = profile.email || authEmail || null;
  const nameDisplay = profile.full_name || emailDisplay?.split('@')[0] || '—';
  const rawFirstName = nameDisplay.trim().split(/\s+/)[0] || nameDisplay;
  const firstNameDisplay = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase();
  const restOfName = nameDisplay.trim().split(/\s+/).slice(1).join(' ');

  const totalRidesDisplay = stats ? formatNumber(stats.total_rides) : '—';
  const earningsDisplay = stats ? formatNumber(Number(stats.total_earnings || 0)) : '—';
  const distanceDisplay = stats
    ? `${Number(stats.total_distance_km || 0).toFixed(1)}`
    : '—';

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

      {/* Profile header card */}
      <View style={CARD_STYLE}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <AvatarCircle name={nameDisplay} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#1A1A1A',
                  fontFamily: 'Nunito_700Bold',
                }}
              >
                {firstNameDisplay}
              </Text>
              {restOfName ? (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: '#1A1A1A',
                    fontFamily: 'Nunito_700Bold',
                  }}
                >
                  {' '}{restOfName}
                </Text>
              ) : null}
            </View>
            <DriverBadge />
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

      {/* Vehicle Details card */}
      <View style={CARD_STYLE}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: '#1A1A1A',
            fontFamily: 'Nunito_700Bold',
            marginBottom: 4,
          }}
        >
          Vehicle Details
        </Text>
        <VehicleRow label="Make" value={profile.vehicle_make} />
        <VehicleRow label="Model" value={profile.vehicle_model} />
        <VehicleRow label="License Plate" value={profile.license_plate} />
        <VehicleRow label="National ID" value={profile.national_id} />
      </View>

      {/* My Earnings card */}
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
          My Earnings
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
            <Text
              style={{
                fontSize: 13,
                color: '#EF4444',
                fontFamily: 'Nunito_400Regular',
                textAlign: 'center',
              }}
            >
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
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  fontFamily: 'Nunito_700Bold',
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard icon="🚗" label="Rides" value={totalRidesDisplay} />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard icon="💰" label="Earnings (KES)" value={earningsDisplay} />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard icon="📍" label="Distance (km)" value={distanceDisplay} />
              </View>
            </View>

            {stats && stats.rides && stats.rides.length > 0 ? (
              stats.rides.map((ride) => <RideHistoryItem key={ride.id} ride={ride} />)
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#888',
                    fontFamily: 'Nunito_400Regular',
                  }}
                >
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
