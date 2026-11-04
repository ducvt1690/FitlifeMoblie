import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Logo from '../../ui/Logo';
import Glass from '../../ui/Glass';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { colors, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';

const PHOTO = require('../../../assets/images/landing.jpg');
const native = Platform.OS !== 'web';
const FEATURES = [
  { icon: 'sparkles', label: 'AI Coach' },
  { icon: 'barbell', label: 'Lịch tập' },
  { icon: 'nutrition', label: 'Dinh dưỡng' },
];

export default function LandingScreen() {
  const router = useRouter();
  const { insets, gutter, contentWidth, compact } = useLayout();
  const zoom = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    let loop;
    // Slow Ken Burns drift on the photo, skipped when the system asks for reduced motion.
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(zoom, { toValue: 1.08, duration: 20000, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(zoom, { toValue: 1, duration: 20000, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => loop?.stop();
  }, [enter, zoom]);

  const rise = (offset) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  });

  return (
    <View style={styles.page}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}>
        <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={400}
          accessible accessibilityLabel="Quả tạ trên sàn phòng tập" />
      </Animated.View>
      <LinearGradient colors={['rgba(7,9,12,0.55)', 'rgba(7,9,12,0)']} style={styles.topShade} pointerEvents="none" />
      <LinearGradient colors={['rgba(7,9,12,0)', 'rgba(7,9,12,0.75)', colors.bg]} locations={[0, 0.45, 0.85]}
        style={styles.bottomShade} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: gutter }]}>
        <Animated.View style={[styles.inner, { maxWidth: contentWidth }, rise(-12)]}>
          <Logo size={compact ? 34 : 38} />
        </Animated.View>

        <View style={[styles.inner, { maxWidth: contentWidth }]}>
          <Animated.View style={rise(28)}>
            <Text variant="caption" tone="accent" style={styles.eyebrow}>TRỢ LÝ SỨC KHỎE CÁ NHÂN</Text>
            <Text variant="display" style={styles.headline}>Khỏe hơn{'\n'}mỗi ngày.</Text>
            <Text tone="dim" style={styles.sub}>
              Lịch tập, dinh dưỡng và huấn luyện viên AI trong một ứng dụng. Theo dõi tiến bộ của bạn từng ngày.
            </Text>
            <View style={styles.chips}>
              {FEATURES.map(f => (
                <Glass key={f.label} blur intensity={30} radius={radius.pill} style={styles.chip}>
                  <Ionicons name={f.icon} size={14} color={colors.accent} />
                  <Text variant="caption" style={styles.chipText}>{f.label}</Text>
                </Glass>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={rise(48)}>
            <Glass blur intensity={50} radius={radius.lg} style={styles.panel}>
              <Button title="Bắt đầu miễn phí" icon="arrow-forward" onPress={() => router.push('/register')} />
              <Button title="Tôi đã có tài khoản" variant="ghost" onPress={() => router.push('/login')} />
            </Glass>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '72%' },
  content: { flex: 1, justifyContent: 'space-between' },
  inner: { width: '100%', alignSelf: 'center' },
  eyebrow: { letterSpacing: 1.6, marginBottom: 10, fontFamily: 'BeVietnamPro_700Bold' },
  headline: { marginBottom: 12 },
  sub: { marginBottom: 18, maxWidth: 420 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'BeVietnamPro_600SemiBold' },
  panel: { padding: 10, gap: 4 },
});
