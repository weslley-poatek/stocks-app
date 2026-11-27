import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { nextPillMode, type PillMode } from '@/features/stocks/components/ChangePill';
import { EmptySearch, ErrorBanner } from '@/features/stocks/components/ListStates';
import { SearchField } from '@/features/stocks/components/SearchField';
import { SkeletonRow, StockRow } from '@/features/stocks/components/StockRow';
import { useCompanyIndex } from '@/features/stocks/hooks/use-company-index';
import { useListRefresh } from '@/features/stocks/hooks/use-list-refresh';
import { useSeeded } from '@/features/stocks/hooks/use-seeded';
import { useStarterList, type StarterRow } from '@/features/stocks/hooks/use-starter-list';
import { useStockSearch } from '@/features/stocks/hooks/use-stock-search';
import { useKey } from '@/features/stocks/key-context';
import { pricesQueryOptions } from '@/features/stocks/prices';
import { toRowData } from '@/features/stocks/row-data';
import type { SearchResult } from '@/features/stocks/search';
import type { Company } from '@/features/stocks/types';
import { formatShortDate } from '@/shared/format';
import { typeScale, usePalette } from '@/shared/theme';

const SKELETON_ROWS = 8;
const REFRESH_LIMIT = 15;

type Item =
  | { kind: 'skeleton'; id: string }
  | { kind: 'starter'; row: StarterRow }
  | { kind: 'result'; result: SearchResult };

const itemKey = (i: Item) => (i.kind === 'skeleton' ? i.id : i.kind === 'starter' ? i.row.symbol : i.result.symbol);

type RowProps = { mode: PillMode; onCycleMode: () => void; onOpen: (symbol: string) => void };

/** A search result: it fetches its own history, so only rows that are on screen make requests. */
const ResultRow = memo(function ResultRow({
  result,
  company,
  ...rest
}: RowProps & { result: SearchResult; company?: Company }) {
  const { apiKey } = useKey();
  const seeded = useSeeded([result.symbol]);
  const q = useQuery({ ...pricesQueryOptions(apiKey ?? '', result.symbol), enabled: !!apiKey && seeded });
  const row = useMemo(
    () => ({ ...toRowData(result.symbol, q.data, company), name: result.name }),
    [result, q.data, company],
  );
  return <StockRow row={row} loading={!q.data && !q.isError} {...rest} />;
});

export default function Index() {
  const router = useRouter();
  const c = usePalette();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<PillMode>('pct');

  const index = useCompanyIndex();
  const starter = useStarterList();
  const search = useStockSearch(text);

  const items = useMemo<Item[]>(() => {
    if (search.active) {
      if (search.loading && search.results.length === 0) return skeletons();
      return search.results.map((result) => ({ kind: 'result', result }));
    }
    if (starter.initializing) return skeletons();
    return starter.rows.map((row) => ({ kind: 'starter', row }));
  }, [search.active, search.loading, search.results, starter.initializing, starter.rows]);

  const sessionDate = starter.rows
    .map((r) => r.summary?.asOf)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  const refreshSymbols = search.active
    ? search.results.slice(0, REFRESH_LIMIT).map((r) => r.symbol)
    : starter.rows.filter((r) => !r.loading).map((r) => r.symbol);
  const refresh = useListRefresh(refreshSymbols);
  const showBanner = starter.error || refresh.failed;

  // Stable callbacks, so memoized rows re-render only when their own data changes.
  const onCycleMode = useCallback(() => setMode(nextPillMode), []);
  const onOpen = useCallback((symbol: string) => router.push(`/stock/${symbol}` as Href), [router]);
  const rowProps: RowProps = { mode, onCycleMode, onOpen };

  const searchBar = useMemo(
    () => ({
      placeholder: 'Search',
      autoCapitalize: 'none' as const,
      hideWhenScrolling: true,
      onChangeText: (e: { nativeEvent: { text: string } }) => setText(e.nativeEvent.text),
      onCancelButtonPress: () => setText(''),
    }),
    [],
  );

  const header = (
    <View>
      {Platform.OS === 'android' ? (
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
          Stocks
        </Text>
      ) : null}
      {sessionDate ? (
        <Text style={[typeScale.body, styles.subtitle, { color: c.textSecondary }]}>
          {`At close, ${formatShortDate(sessionDate)}`}
        </Text>
      ) : null}
      {showBanner ? (
        <ErrorBanner
          onRetry={() => {
            starter.retry();
            if (refresh.failed) void refresh.refresh();
          }}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={
          Platform.OS === 'ios'
            ? { headerLargeTitle: true, headerLargeTitleShadowVisible: false, headerSearchBarOptions: searchBar }
            : { headerTitle: '' }
        }
      />
      {Platform.OS === 'android' ? <SearchField value={text} onChangeText={setText} /> : null}
      <FlashList
        testID="stock-list"
        data={items}
        extraData={mode}
        keyExtractor={itemKey}
        getItemType={(i) => i.kind}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={refresh.refreshing}
        onRefresh={() => void refresh.refresh()}
        ListHeaderComponent={header}
        ListEmptyComponent={
          search.active && !search.loading ? <EmptySearch query={search.query} /> : null
        }
        renderItem={({ item }) =>
          item.kind === 'skeleton' ? (
            <SkeletonRow />
          ) : item.kind === 'starter' ? (
            <StockRow row={item.row} loading={item.row.loading} {...rowProps} />
          ) : (
            <ResultRow result={item.result} company={index.byTicker.get(item.result.symbol)} {...rowProps} />
          )
        }
      />
    </View>
  );
}

function skeletons(): Item[] {
  return Array.from({ length: SKELETON_ROWS }, (_, i) => ({ kind: 'skeleton', id: `skeleton-${i}` }));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 34, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  subtitle: { paddingHorizontal: 16, paddingBottom: 8 },
});
