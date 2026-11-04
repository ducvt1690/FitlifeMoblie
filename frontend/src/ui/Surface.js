import { StyleSheet, View } from 'react-native';
import { colors, radius as radii, themed } from '../theme/tokens';

// Flat card for content on the dark page. Glass is reserved for layers that float over something.
export default function Surface({ children, style, radius = radii.md, raised = false, ...rest }) {
  return (
    <View style={[styles.base, { borderRadius: radius }, raised && styles.raised, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  base: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.strokeSoft },
  raised: { backgroundColor: colors.surfaceHigh },
}));
