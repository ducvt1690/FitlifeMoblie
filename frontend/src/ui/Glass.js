import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors, radius as radii, scheme } from '../theme/tokens';

const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

// One glass surface for the whole app:
// iOS 26 uses the system Liquid Glass; older iOS, Android and web use a dark blur with a hairline edge.
// `blur` is for surfaces floating over imagery; plain cards on the dark background only need the tint.
export default function Glass({ children, style, radius = radii.md, blur = false, intensity = 40, tint, interactive = false, ...rest }) {
  const shape = { borderRadius: radius, overflow: 'hidden' };
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={scheme} isInteractive={interactive} tintColor={tint}
        style={[shape, style]} {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[shape, styles.edge, tint && { backgroundColor: tint }, style]} {...rest}>
      {blur && (
        <BlurView intensity={intensity} tint={scheme} blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
});
