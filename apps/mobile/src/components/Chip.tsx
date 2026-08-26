import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { radius, spacing, useTheme } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.l,
        height: 36,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.ink : 'transparent',
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: selected ? colors.ink : colors.borderStrong,
      }}
    >
      <AppText variant="caption" color={selected ? colors.bg : colors.ink} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </PressableScale>
  );
}
