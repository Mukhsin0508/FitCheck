import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { spacing } from '@/theme';

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.m, paddingVertical: spacing.xxxl }}>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      {body ? (
        <AppText muted align="center" style={{ maxWidth: 280 }}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="primary" size="m" onPress={onAction} style={{ marginTop: spacing.s }} />
      ) : null}
    </View>
  );
}
