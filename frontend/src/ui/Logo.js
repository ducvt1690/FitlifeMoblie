import { View } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';
import Text from './Text';
import { colors, fonts } from '../theme/tokens';

// Dumbbell mark on a 100×100 grid. scripts/build-icons.js draws the same shapes for the app icon.
export const DUMBBELL = [
  { x: 26, y: 45.5, w: 48, h: 9, r: 2 },    // bar, ends hidden under the plates
  { x: 22, y: 27, w: 11, h: 46, r: 5.5 },    // inner plates
  { x: 67, y: 27, w: 11, h: 46, r: 5.5 },
  { x: 10, y: 35, w: 9.5, h: 30, r: 4.75 },  // outer plates
  { x: 80.5, y: 35, w: 9.5, h: 30, r: 4.75 },
];

export function LogoMark({ size = 44, color = colors.accent }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="rotate(-30 50 50)">
        {DUMBBELL.map((p, i) => <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={color} />)}
      </G>
    </Svg>
  );
}

export default function Logo({ size = 32, wordmark = true }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="FitLife">
      <LogoMark size={size} />
      {wordmark && (
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.78, lineHeight: size, letterSpacing: 0.2 }}>FitLife</Text>
      )}
    </View>
  );
}
