import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { seedHistory } from '../prices';

/** True once the stored histories of `symbols` have been put in the query cache (design D6). */
export function useSeeded(symbols: readonly string[]): boolean {
  const qc = useQueryClient();
  const id = symbols.join(',');
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(symbols.map((s) => seedHistory(qc, s))).then(
      () => live && setDone(id),
      () => live && setDone(id),
    );
    return () => {
      live = false;
    };
    // `id` stands for `symbols`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, id]);
  return done === id;
}
