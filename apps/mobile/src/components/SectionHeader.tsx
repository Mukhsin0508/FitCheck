import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { spacing } from '@/theme';

export interface SectionHeaderProps {
  overline?: string;
  title: string;
  trailing?: React.ReactNode;
}

export function SectionHeader({ overline, title, trailing }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: spacing.l,
      }}
    >
      <View style={{ gap: spacing.xs, flexShrink: 1 }}>
        {overline ? (
          <AppText variant="micro" muted>
            {overline}
          </AppText>
        ) : null}
        <AppText variant="title">{title}</AppText>
      </View>
      {trailing}
    </View>
  );
}
