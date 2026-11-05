import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { colors, themed } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// Full-screen sheet with a title and a close button, for forms and detail pages opened from a screen.
export default function Sheet({ visible, title, subtitle, onClose, children }) {
  const { insets, gutter, contentWidth } = useLayout();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <View style={styles.flex}>
            <Text variant="heading" numberOfLines={1}>{title}</Text>
            {subtitle ? <Text variant="caption" tone="dim">{subtitle}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Đóng" style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 24 }}>
          <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', gap: 14 }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
}));
