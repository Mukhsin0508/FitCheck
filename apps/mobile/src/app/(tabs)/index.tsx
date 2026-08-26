import type { Product } from '@fitcheck/affiliates';
import { categories, getProductsByCategory } from '@fitcheck/catalog';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
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
  const [category, setCategory] = useState<CategoryId>('all');

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
          onPress={() => router.push('/paste-url')}
        />
      </View>
      <AppText variant="caption" muted style={{ marginTop: spacing.xs }}>
        Every piece renders on your avatar.
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.s }}
        style={{ marginTop: spacing.l }}
      >
        <Chip label="All" selected={category === 'all'} onPress={() => selectCategory('all')} />
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            label={cat.label}
            selected={category === cat.id}
            onPress={() => selectCategory(cat.id)}
          />
        ))}
      </ScrollView>
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
