import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { usePalette } from '@/shared/theme';

/** The list header's entry to the saved-key view. */
export function KeyButton() {
  const router = useRouter();
  const c = usePalette();
  return (
    <Pressable
      onPress={() => router.push('/key')}
      accessibilityRole="button"
      accessibilityLabel="API key"
      hitSlop={8}
    >
      <Text style={{ color: c.text, fontSize: 17 }}>Key</Text>
    </Pressable>
  );
}
