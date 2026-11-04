import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Logo from '../../ui/Logo';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { colors, themed } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';

const PHOTO = require('../../../assets/images/landing.jpg');
const native = Platform.OS !== 'web';
export default function LandingScreen() {
  const router = useRouter();
  const { insets, gutter, contentWidth, compact, fs } = useLayout();
  const zoom = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    let loop;
    // Slow Ken Burns drift on the photo, skipped when the system asks for reduced motion.
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(zoom, { toValue: 1.05, duration: 24000, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(zoom, { toValue: 1, duration: 24000, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
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
          accessible accessibilityLabel="Người tập nâng thanh tạ trong phòng gym" />
      </Animated.View>
      <LinearGradient colors={[`rgba(${colors.shade},0.6)`, `rgba(${colors.shade},0)`]} style={styles.topShade} pointerEvents="none" />
      <LinearGradient colors={[`rgba(${colors.shade},0)`, `rgba(${colors.shade},0.8)`, colors.bg]} locations={[0, 0.4, 0.78]}
        style={styles.bottomShade} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: gutter }]}>
        <Animated.View style={[styles.inner, { maxWidth: contentWidth }, rise(-10)]}>
          <Logo size={compact ? 28 : 32} />
        </Animated.View>

        <View style={[styles.inner, { maxWidth: contentWidth }]}>
          <Animated.View style={rise(24)}>
            <Text variant="display" style={[styles.headline, { fontSize: fs(compact ? 60 : 68), lineHeight: fs(compact ? 68 : 76) }]}>
              {'KHỎE HƠN\nMỖI NGÀY.'}
            </Text>
            <Text tone="dim" style={styles.sub}>Ghi lại buổi tập, bữa ăn và lượng nước. Xem tiến bộ của bạn mỗi tuần.</Text>
          </Animated.View>

          <Animated.View style={rise(40)}>
            <Button title="Tạo tài khoản" onPress={() => router.push('/register')} />
            <View style={styles.signin}>
              <Text tone="dim">Đã có tài khoản?</Text>
              <Button title="Đăng nhập" variant="ghost" onPress={() => router.push('/login')} style={styles.signinBtn} />
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  content: { flex: 1, justifyContent: 'space-between' },
  inner: { width: '100%', alignSelf: 'center' },
  headline: { marginBottom: 14 },
  sub: { marginBottom: 28, maxWidth: 360 },
  signin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  signinBtn: { marginLeft: -12 },
}));
