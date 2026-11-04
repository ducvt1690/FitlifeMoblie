import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Glass from '../../ui/Glass';
import { PressScale } from '../../ui/Button';
import { colors, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';

const PHOTO = require('../../../assets/images/landing.jpg');

// Blurred landing photo behind a scrolling, keyboard-aware column, with a glass back button.
export default function AuthShell({ children, onBack, header }) {
  const { insets, gutter, contentWidth } = useLayout();
  return (
    <View style={styles.page}>
      <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'android' ? 18 : 28} />
      <LinearGradient colors={['rgba(7,9,12,0.55)', 'rgba(7,9,12,0.88)', colors.bg]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 8, paddingHorizontal: gutter }]}>
          <View style={[styles.topInner, { maxWidth: contentWidth }]}>
            {onBack && (
              <PressScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8}>
                <Glass blur radius={radius.pill} interactive style={styles.back}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Glass>
              </PressScale>
            )}
            <View style={styles.fill}>{header}</View>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={[styles.column, { maxWidth: contentWidth }]}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  top: { paddingBottom: 8 },
  topInner: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1 },
  column: { width: '100%', alignSelf: 'center', flexGrow: 1 },
});
