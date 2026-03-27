import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants/colors';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: '0 2px 8px rgba(90,60,0,0.06)',
        minHeight: 100,
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: COLORS.text,
            fontFamily: 'Nunito_700Bold',
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            fontFamily: 'Nunito_400Regular',
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
