/**
 * The shareable fit-check card. Rendered on-screen and captured as a PNG by
 * react-native-view-shot, so it has to look good outside the app — story-ready
 * chrome, no app furniture.
 */

import { Image } from 'expo-image';
import type { RefObject } from 'react';
import {
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { resolveImageRef } from '@/lib/images';
import { radius, spacing, useTheme } from '@/theme';

export type FitCardLayout = 'side' | 'grid';

export interface FitCardProps {
  /** Ref for captureRef — attached to the card's outermost view. */
  cardRef: RefObject<View | null>;
  layout: FitCardLayout;
  /** Image ref of the render being shared. */
  renderRef: string;
  /** Product photo of the garment, when we know which product it was. */
  garmentSource?: ImageSourcePropType;
  /** Newest closet refs (this render first), up to four. */
  gridRefs: string[];
  createdAt: string;
}

function formatCardDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Soft placeholder for cells we can't fill yet. */
function EmptyCell() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <AppText color={colors.muted} style={{ fontSize: 18, opacity: 0.4 }}>
        ✦
      </AppText>
    </View>
  );
}

function CardImage({ source }: { source?: ImageSourcePropType }) {
  if (!source) return <EmptyCell />;
  return (
    <Image
      source={source}
      contentFit="cover"
      transition={200}
      style={{ flex: 1 }}
      accessibilityIgnoresInvertColors
    />
  );
}

export function FitCard({
  cardRef,
  layout,
  renderRef,
  garmentSource,
  gridRefs,
  createdAt,
}: FitCardProps) {
  const { colors } = useTheme();

  const cellStyle = {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radius.m,
    overflow: 'hidden' as const,
  };

  const gridCells: (string | undefined)[] = [0, 1, 2, 3].map((i) => gridRefs[i]);

  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessible
      accessibilityLabel="Your fit-check card"
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.l,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: spacing.m,
        gap: spacing.m,
      }}
    >
      {layout === 'side' ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <View style={cellStyle}>
            <CardImage source={garmentSource} />
          </View>
          <View style={cellStyle}>
            <CardImage source={resolveImageRef(renderRef)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {[0, 1].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: spacing.xs }}>
              {[0, 1].map((col) => {
                const ref = gridCells[row * 2 + col];
                return (
                  <View key={col} style={cellStyle}>
                    <CardImage source={ref ? resolveImageRef(ref) : undefined} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xs,
          paddingBottom: spacing.xs,
        }}
      >
        <View style={{ gap: 2 }}>
          <AppText variant="displayItalic" style={{ fontSize: 22, lineHeight: 26 }}>
            fitcheck
          </AppText>
          <AppText variant="micro" muted>
            {formatCardDate(createdAt)}
          </AppText>
        </View>
        <AppText variant="micro" style={{ opacity: 0.4 }}>
          made with FitCheck
        </AppText>
      </View>
    </View>
  );
}
