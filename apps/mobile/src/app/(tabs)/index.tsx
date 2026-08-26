import type { Product } from '@fitcheck/affiliates';
import { categories, getProductsByCategory } from '@fitcheck/catalog';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/features/browse/ProductCard';
import { spacing, useTheme } from '@/theme';

type CategoryId = 'all' | (typeof categories)[number]['id'];

export default function BrowseScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<Product>>(null);
  const chipsRef = useRef<ScrollView>(null);
  const [category, setCategory] = useState<CategoryId>('all');

  // Web: the chip row hides its scrollbar, and browsers don't scroll an
  // overflow-x row on a plain vertical wheel — map the wheel to it so mice
  // can reach every category. Trackpads already pan it natively.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (
      chipsRef.current as unknown as { getScrollableNode?: () => HTMLElement } | null
    )?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        node.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Static catalog — counts never change while the screen is mounted.
  const counts = useMemo<Record<CategoryId, number>>(() => {
    const next = { all: getProductsByCategory('all').length } as Record<CategoryId, number>;
    for (const cat of categories) next[cat.id] = getProductsByCategory(cat.id).length;
    return next;
  }, []);

  const data = useMemo(() => getProductsByCategory(category), [category]);

  const selectCategory = useCallback((next: CategoryId) => {
    setCategory(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => <ProductCard product={item} />,
    [],
  );

  const header = (
    <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.l }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="title">FitCheck</AppText>
        <Button
          label="Paste a link"
          variant="ghost"
          size="s"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => router.push('/paste-url')}
        />
      </View>
      <ScrollView
        ref={chipsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.l, marginHorizontal: -spacing.l }}
        contentContainerStyle={{ paddingHorizontal: spacing.l, gap: spacing.s }}
      >
        <Chip
          label={`All · ${counts.all}`}
          selected={category === 'all'}
          onPress={() => selectCategory('all')}
        />
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            label={`${cat.label} · ${counts[cat.id]}`}
            selected={category === cat.id}
            onPress={() => selectCategory(cat.id)}
          />
        ))}
      </ScrollView>
      <AppText variant="micro" muted style={{ marginTop: spacing.m }}>
        {data.length} {data.length === 1 ? 'piece' : 'pieces'} · rendered on your avatar
      </AppText>
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.m }}>
      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.m, paddingHorizontal: spacing.l }}
        contentContainerStyle={{ rowGap: spacing.xl, paddingBottom: spacing.xxl }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Nothing on this rack"
            body="Try another category, or paste a link to anything you're eyeing."
          />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
