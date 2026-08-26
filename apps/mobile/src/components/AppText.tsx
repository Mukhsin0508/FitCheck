import { Text, type TextProps, type TextStyle } from 'react-native';

import { type, useTheme } from '@/theme';

type Variant = 'display' | 'displayItalic' | 'title' | 'heading' | 'body' | 'caption' | 'micro';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  muted = false,
  color,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        type[variant] as TextStyle,
        { color: color ?? (muted ? colors.muted : colors.ink), textAlign: align },
        style,
      ]}
    />
  );
}
