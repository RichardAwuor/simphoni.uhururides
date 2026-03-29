import React from 'react';
import { Stack } from 'expo-router';
import { useProfile } from '@/contexts/ProfileContext';
import RiderRequestScreen from '@/components/RiderRequestScreen';
import DriverConnectScreen from '@/components/DriverConnectScreen';

const BG = '#FAF7F0';
const TEXT = '#1A1A1A';

export default function ConnectScreen() {
  const { profile } = useProfile();
  const userType = (profile as any)?.user_type || (profile as any)?.role || 'passenger';
  const isDriver = userType.toLowerCase() === 'driver';

  const titleText = isDriver ? 'Drive' : 'Request a Ride';

  return (
    <>
      <Stack.Screen
        options={{
          title: titleText,
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
      {isDriver ? <DriverConnectScreen /> : <RiderRequestScreen />}
    </>
  );
}
