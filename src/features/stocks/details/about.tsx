import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { typeScale, usePalette } from '@/shared/theme';
import type { Company } from '../types';

/** Sector › subsector › segment, then the legal name; a missing part is left out. */
function AboutView({ company }: { company: Company }) {
  const c = usePalette();
  const classification = [company.sector, company.subsector, company.segment].filter(Boolean).join(' › ');
  const legal = company.legalName || undefined;
  if (!classification && !legal) return null;
  return (
    <View style={styles.block}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>About</Text>
      {classification ? <Text style={[styles.body, { color: c.text }]}>{classification}</Text> : null}
      {legal ? <Text style={[styles.body, { color: c.textSecondary }]}>{legal}</Text> : null}
    </View>
  );
}

/** Memoized, so a scrub step on the details screen leaves it alone. */
export const About = memo(AboutView);

const styles = StyleSheet.create({
  block: { gap: 4 },
  title: { ...typeScale.ticker },
  body: { ...typeScale.body },
});
