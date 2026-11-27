import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { typeScale, usePalette } from '@/shared/theme';

/** The pinned search field for Android (iOS uses the native header search bar). */
export function SearchField({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const c = usePalette();
  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <View style={[styles.field, { backgroundColor: c.surface }]}>
        <TextInput
          style={[styles.input, { color: c.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Search"
          placeholderTextColor={c.textSecondary}
          accessibilityLabel="Search"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8}>
          <Text style={[typeScale.body, { color: c.up }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  field: { flex: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { fontSize: typeScale.body.fontSize + 2, paddingVertical: 10 },
});
