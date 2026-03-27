import React from 'react';
import { View, Text, Image } from 'react-native';
import { COLORS } from '@/constants/colors';
import { Profile } from '@/contexts/ProfileContext';

function resolveImageSource(source: string | undefined) {
  if (!source) return null;
  return { uri: source };
}

const countryFlags: Record<string, string> = {
  kenya: '🇰🇪',
  tanzania: '🇹🇿',
  uganda: '🇺🇬',
};

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
  const flag = countryFlags[profile.country] || '';
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const imgSource = resolveImageSource(profile.profile_picture_url);

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: '0 2px 12px rgba(90,60,0,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {imgSource ? (
        <Image
          source={imgSource}
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryMuted }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: COLORS.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: COLORS.primary,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary, fontFamily: 'Nunito_700Bold' }}>
            {initials}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, fontFamily: 'Nunito_700Bold' }}>
            {fullName}
          </Text>
          <Text style={{ fontSize: 20 }}>{flag}</Text>
        </View>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Nunito_400Regular', marginBottom: 4 }}>
          {profile.resident_district}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: COLORS.primaryMuted,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, fontFamily: 'Nunito_600SemiBold', textTransform: 'capitalize' }}>
            {profile.user_type}
          </Text>
        </View>
      </View>
    </View>
  );
}
