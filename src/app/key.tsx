import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useKey } from '@/features/stocks/key-context';
import { KeyEntry } from '@/features/stocks/key/key-entry';
import { SavedKey } from '@/features/stocks/key/saved-key';

export default function KeyScreen() {
  const router = useRouter();
  const { apiKey, rejected, save, remove } = useKey();
  const [replacing, setReplacing] = useState(false);

  async function onChecked(key: string) {
    await save(key);
    // Reset the stack so there is no back navigation to the key screen (pushed from the list).
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }

  if (apiKey && !rejected && !replacing) {
    return (
      <SavedKey apiKey={apiKey} onReplace={() => setReplacing(true)} onRemove={() => void remove()} />
    );
  }
  return (
    <KeyEntry
      initialMessage={rejected ? 'That key was rejected' : undefined}
      onChecked={onChecked}
      onCancel={apiKey && !rejected ? () => setReplacing(false) : undefined}
    />
  );
}
