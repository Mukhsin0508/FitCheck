/**
 * Shared chrome for the app's sheet modals: drag affordance, an overline,
 * and a close button.
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { radius, spacing, useTheme } from '@/theme';

export interface ModalHeaderProps {
  overline: string;
}

export function ModalHeader({ overline }: ModalHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={{ gap: spacing.s, paddingTop: spacing.m }}>
      <View
        style={{
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: colors.borderStrong,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: 36 }} />
        <AppText variant="micro" muted>
          {overline}
        </AppText>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText style={{ fontSize: 18, fontWeight: '500' }}>✕</AppText>
        </PressableScale>
      </View>
    </View>
  );
}
