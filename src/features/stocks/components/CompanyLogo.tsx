import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/shared/theme';

type Props = {
  symbol: string;
  uri?: string;
  size: number;
};

/** The first two letters or digits of a ticker ("PETR4" gives "PE"); "?" when it has none. */
export function initialsOf(symbol: string): string {
  const letters = symbol.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
  return letters || '?';
}

/**
 * The company's logo, or its ticker's initials in a circle of the same size while there is no logo
 * or it fails to load. The space is always taken, so nothing shifts. Decorative to screen readers.
 */
export function CompanyLogo(props: Props) {
  // Keyed by uri, so a recycled list cell starts over (not failed, not loaded) for its new logo.
  return <Logo key={props.uri ?? ''} {...props} />;
}

function Logo({ symbol, uri, size }: Props) {
  const c = usePalette();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = !!uri && !failed;
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      testID="company-logo-box"
      style={[styles.box, box, { backgroundColor: c.surface }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {loaded && showImage ? null : (
        <Text
          testID="company-logo-initials"
          style={[styles.initials, { color: c.textSecondary, fontSize: Math.round(size * 0.38) }]}
          allowFontScaling={false}
        >
          {initialsOf(symbol)}
        </Text>
      )}
      {showImage ? (
        <Image
          testID="company-logo"
          source={{ uri }}
          contentFit="contain"
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontWeight: '600' },
});
