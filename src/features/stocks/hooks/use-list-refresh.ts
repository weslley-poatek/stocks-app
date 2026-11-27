import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useKey } from '../key-context';
import { refreshHistories } from '../prices';

/** Pull to refresh: one failed history doesn't fail the rest, and failure is reported as a flag. */
export function useListRefresh(symbols: readonly string[]) {
  const { apiKey } = useKey();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function refresh() {
    if (!apiKey) return;
    setRefreshing(true);
    setFailed(await refreshHistories(qc, apiKey, symbols));
    setRefreshing(false);
  }

  return { refreshing, failed, refresh };
}
