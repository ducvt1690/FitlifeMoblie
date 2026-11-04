import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/tokens';

// Web draws the final value directly: the animated wrapper leaks `collapsable` onto the DOM <circle>.
const web = Platform.OS === 'web';
const ArcCircle = web ? Circle : Animated.createAnimatedComponent(Circle);

// Activity-style ring. `progress` 0..1+; past 1 the ring stays full.
export default function ProgressRing({ size = 120, stroke = 12, progress = 0, color, track = colors.track, children }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (web) return;
    Animated.timing(value, { toValue: clamped, duration: 900, useNativeDriver: false }).start();
  }, [clamped, value]);
  const offset = web ? circumference * (1 - clamped) : value.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ArcCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset} />
      </Svg>
      {children}
    </View>
  );
}
