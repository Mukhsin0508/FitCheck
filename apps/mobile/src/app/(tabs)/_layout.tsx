import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';

const LABELS: Record<string, string> = {
  index: 'Browse',
  closet: 'Closet',
  profile: 'You',
};

/** Structural subset of the tab-bar props expo-router passes (its navigation
 * types are vendored in SDK 57 and not importable directly). */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/** Editorial text-only tab bar: no icons, small caps, a lime tick for the active tab. */
function EditorialTabBar({ state, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = LABELS[route.name] ?? route.name;
        return (
          <PressableScale
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 6,
              // Vertical padding lives on the pressable (not the bar) so the
              // whole bar height is tappable — keeps the hit target >= 44pt.
              paddingTop: spacing.m,
              paddingBottom: Math.max(insets.bottom, spacing.m),
            }}
          >
            <AppText
              variant="micro"
              color={focused ? colors.ink : colors.muted}
              style={{ fontWeight: focused ? '700' : '500' }}
            >
              {label}
            </AppText>
            <View
              style={{
                width: 16,
                height: 3,
                borderRadius: 2,
                backgroundColor: focused ? colors.accent : 'transparent',
              }}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const avatarStatus = useStore((state) => state.avatar.status);

  if (avatarStatus !== 'ready') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      tabBar={(props) => <EditorialTabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="closet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
