import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale, type PressableScaleProps } from '@/components/PressableScale';
import { radius, spacing, useTheme } from '@/theme';

type Variant = 'primary' | 'accent' | 'ghost' | 'text';
type Size = 'l' | 'm' | 's';

export interface ButtonProps extends Omit<PressableScaleProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const HEIGHTS: Record<Size, number> = { l: 56, m: 48, s: 38 };

export function Button({
  label,
  variant = 'primary',
  size = 'l',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();

  const container: ViewStyle = {
    height: HEIGHTS[size],
    borderRadius: radius.pill,
    paddingHorizontal: size === 's' ? spacing.l : spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: fullWidth ? 'stretch' : 'auto',
    opacity: disabled ? 0.4 : 1,
  };

  let bg = colors.ink;
  let fg = colors.bg;
  if (variant === 'accent') {
    bg = colors.accent;
    fg = colors.accentInk;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = colors.ink;
  } else if (variant === 'text') {
    bg = 'transparent';
    fg = colors.ink;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={[
        container,
        { backgroundColor: bg },
        variant === 'ghost' && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.borderStrong },
        style as ViewStyle,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        // flexShrink + minWidth keep a long label inside a tight button; the
        // label then ellipsizes instead of bleeding over its neighbors.
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <AppText
            variant={size === 's' ? 'caption' : 'body'}
            color={fg}
            numberOfLines={1}
            style={{ fontWeight: '600' }}
          >
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}
