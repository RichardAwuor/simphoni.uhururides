import React from 'react';
import { Stack } from 'expo-router';
import RiderRequestScreen from '@/components/RiderRequestScreen';

const BG = '#FAF7F0';
const TEXT = '#1A1A1A';

export default function RidesScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Request a Ride',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: TEXT,
            fontFamily: 'Nunito_700Bold',
          },
        }}
      />
      <RiderRequestScreen />
    </>
  );
}
