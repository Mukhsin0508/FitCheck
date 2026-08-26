import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from '@expo-google-fonts/instrument-serif';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useHydrated } from '@/state/useHydrated';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors } = useTheme();
  const hydrated = useHydrated();
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  const ready = hydrated && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="tryon/[productId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="share/[renderId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paste-url" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
