import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import Text from './Text';
import { colors } from '../theme/tokens';

// Dumbbell mark on a 100×100 grid. scripts/build-icons.js draws the same shapes for the app icon.
export const DUMBBELL = [
  { x: 26, y: 45.5, w: 48, h: 9, r: 2 },    // bar, ends hidden under the plates
  { x: 22, y: 27, w: 11, h: 46, r: 5.5 },    // inner plates
  { x: 67, y: 27, w: 11, h: 46, r: 5.5 },
  { x: 10, y: 35, w: 9.5, h: 30, r: 4.75 },  // outer plates
  { x: 80.5, y: 35, w: 9.5, h: 30, r: 4.75 },
];

export function LogoMark({ size = 44, tile = true }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A2010" />
          <Stop offset="1" stopColor="#07090C" />
        </LinearGradient>
      </Defs>
      {tile && <Rect x="0" y="0" width="100" height="100" rx="26" fill="url(#tile)" stroke="rgba(198,244,50,0.35)" strokeWidth="1.5" />}
      <G transform="rotate(-30 50 50)">
        {DUMBBELL.map((p, i) => <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={colors.accent} />)}
      </G>
    </Svg>
  );
}

export default function Logo({ size = 40, wordmark = true }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header" accessibilityLabel="FitLife">
      <LogoMark size={size} />
      {wordmark && <Text variant="heading" style={{ fontSize: size * 0.55, lineHeight: size * 0.7, fontFamily: 'BeVietnamPro_800ExtraBold' }}>
        Fit<Text variant="heading" tone="accent" style={{ fontSize: size * 0.55, lineHeight: size * 0.7, fontFamily: 'BeVietnamPro_800ExtraBold' }}>Life</Text>
      </Text>}
    </View>
  );
}
