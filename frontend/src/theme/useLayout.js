import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONTENT_MAX = 560;

// Screen-size aware values: small phones shrink type a little, tablets center a fixed-width column.
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 375;
  const tablet = width >= 600;
  const scale = compact ? 0.92 : tablet ? 1.08 : 1;
  const contentWidth = Math.min(width, CONTENT_MAX);
  return {
    width, height, insets, compact, tablet, scale,
    contentWidth,
    gutter: compact ? 16 : 20,
    columns: tablet ? 2 : 1,
    fs: (size) => Math.round(size * scale),
  };
}
