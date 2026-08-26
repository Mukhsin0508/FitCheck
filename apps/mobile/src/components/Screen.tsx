import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

export interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default true). */
  scroll?: boolean;
  /** Horizontal padding (default true). */
  padded?: boolean;
  /** Respect top inset (default true — off for screens under a header). */
  safeTop?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  safeTop = true,
  style,
  contentStyle,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const base: ViewStyle = {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: safeTop ? insets.top : 0,
  };
  const content: ViewStyle = {
    paddingHorizontal: padded ? spacing.l : 0,
    paddingBottom: insets.bottom + spacing.xxl,
  };

  if (!scroll) {
    return <View style={[base, content, style, contentStyle]}>{children}</View>;
  }
  return (
    <View style={[base, style]}>
      <ScrollView
        contentContainerStyle={[content, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
