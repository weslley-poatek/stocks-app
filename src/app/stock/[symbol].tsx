import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toStockDetails } from '@/features/stocks/api/mappers';
import { isApiError } from '@/features/stocks/api/client-error';
import { chartSeries, chartSummary, quote } from '@/features/stocks/derive';
import { CompanyLogo } from '@/features/stocks/components/CompanyLogo';
import { About } from '@/features/stocks/details/about';
import { PriceBlock } from '@/features/stocks/details/price-block';
import { PriceChart } from '@/features/stocks/details/price-chart';
import { RangeSelector } from '@/features/stocks/details/range-selector';
import { StatsGrid, type DividendState } from '@/features/stocks/details/stats-grid';
import { useCompany } from '@/features/stocks/hooks/use-company';
import { useDividends } from '@/features/stocks/hooks/use-dividends';
import { useKey } from '@/features/stocks/key-context';
import { pricesQueryOptions } from '@/features/stocks/prices';
import { scrubQuote } from '@/features/stocks/scrub';
import type { Range } from '@/features/stocks/types';
import { typeScale, usePalette } from '@/shared/theme';

export default function Details() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { apiKey } = useKey();
  const c = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('1W');
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Rendered from the cached history when there is one; the key only matters for a fetch.
  const prices = useQuery({ ...pricesQueryOptions(apiKey ?? '', symbol), enabled: apiKey !== null });
  const company = useCompany(symbol, apiKey);
  const dividends = useDividends(symbol, apiKey);

  const bars = prices.data;
  const series = useMemo(() => (bars ? chartSeries(bars, range) : []), [bars, range]);
  const summary = useMemo(() => (bars ? chartSummary(bars, range) : undefined), [bars, range]);
  const details = useMemo(
    () => (bars ? toStockDetails({ symbol, bars, company, dividends: dividends.data }) : undefined),
    [symbol, bars, company, dividends.data],
  );

  const onRangeChange = useCallback((r: Range) => {
    setRange(r);
    setScrubIndex(null);
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!bars && isApiError(prices.error, 'notFound')) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: symbol }} />
        <Text style={[styles.notFound, { color: c.text }]}>{`${symbol} wasn't found`}</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>Check the ticker and try again.</Text>
        <Pressable accessibilityRole="button" onPress={goBack} style={[styles.button, { backgroundColor: c.surface }]}>
          <Text style={[styles.buttonText, { color: c.text }]}>Back to list</Text>
        </Pressable>
      </View>
    );
  }

  const scrubbed = scrubIndex === null ? undefined : series[scrubIndex];
  const shown = bars && (scrubbed ? scrubQuote(bars, scrubbed) : quote(bars));
  const direction = summary?.direction ?? 'up';
  const lineColor = direction === 'up' ? c.up : c.down;

  const dividendState: DividendState = dividends.isSuccess
    ? 'ready'
    : isApiError(dividends.error, 'forbidden')
      ? 'forbidden'
      : dividends.isError
        ? 'unavailable'
        : 'loading';

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
      ]}
    >
      <Stack.Screen options={{ title: symbol }} />
      <View style={styles.header}>
        <CompanyLogo symbol={symbol} uri={company?.logoUrl} size={44} />
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={[styles.ticker, { color: c.text }]}>{symbol}</Text>
          {company?.name ? <Text style={[styles.name, { color: c.textSecondary }]}>{company.name}</Text> : null}
        </View>
      </View>

      {shown ? (
        <PriceBlock quote={shown} scrubbing={scrubbed !== undefined} />
      ) : prices.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading price" style={styles.loading} />
      ) : null}

      <View style={styles.chartArea}>
        {bars ? (
          <PriceChart series={series} summary={summary} color={lineColor} cursorColor={c.textSecondary} gridColor={c.separator} onScrub={setScrubIndex} />
        ) : prices.isError ? (
          <View style={styles.retry}>
            <Text style={[styles.sub, { color: c.textSecondary }]}>The chart couldn’t load.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void prices.refetch()}
              style={[styles.button, { backgroundColor: c.surface }]}
            >
              <Text style={[styles.buttonText, { color: c.text }]}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading chart" />
        )}
      </View>
      <RangeSelector value={range} onChange={onRangeChange} />

      {details ? <StatsGrid details={details} dividends={dividendState} /> : null}
      {company ? <About company={company} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flexShrink: 1 },
  ticker: { fontSize: 28, fontWeight: '700' },
  name: { ...typeScale.name },
  loading: { alignSelf: 'flex-start' },
  chartArea: { minHeight: 220, justifyContent: 'center' },
  retry: { alignItems: 'center', gap: 12 },
  notFound: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  sub: { ...typeScale.body, textAlign: 'center' },
  button: { minHeight: 44, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...typeScale.body, fontWeight: '600' },
});
