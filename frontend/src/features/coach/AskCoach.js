import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Text from '../../ui/Text';
import { colors } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useKeyboardVisible } from '../../ui/useKeyboard';
import CoachChat from './CoachChat';

// Floating "Hỏi AI" button for a tab. It opens the same coach chat, primed for that tab, and calls onDone
// when the coach changed something (a plan or a meal) so the tab can reload. `nudge` is a short preview of a message
// the coach just posted (after a workout); it shows as a bubble with a badge until the chat is opened.
export default function AskCoach({ context, title, starters, onDone, nudge, onSeen }) {
  const { insets } = useLayout();
  const typing = useKeyboardVisible();
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(false);
  const show = () => { Haptics.selectionAsync().catch(() => {}); setOpen(true); onSeen?.(); };
  const close = () => { setOpen(false); if (changed) { setChanged(false); onDone?.(); } };

  return (
    <>
      {!typing && nudge ? (
        <Pressable onPress={show} accessibilityRole="button" accessibilityLabel={`Tin nhắn mới từ Coach: ${nudge}`}
          style={[styles.nudge, { bottom: 152 + Math.max(insets.bottom, 12) }]}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text variant="caption" numberOfLines={2} style={{ flex: 1 }}>{nudge}</Text>
        </Pressable>
      ) : null}
      {!typing ? (
        <Pressable onPress={show} accessibilityRole="button"
          accessibilityLabel="Hỏi AI Coach" style={[styles.fab, { bottom: 96 + Math.max(insets.bottom, 12) }]}>
          <Ionicons name="sparkles" size={18} color={colors.ink} />
          <Text variant="label" color={colors.ink}>Hỏi AI</Text>
          {nudge ? <View style={styles.badge}><Text variant="caption" color="#fff" style={styles.badgeText}>1</Text></View> : null}
        </Pressable>
      ) : null}
      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View style={[styles.sheet, { paddingTop: insets.top + 8 }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text variant="heading">AI Coach</Text>
              <Text variant="caption" tone="dim">{title}</Text>
            </View>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Đóng" style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <CoachChat context={context} starters={starters} bottom={insets.bottom} onAction={() => setChanged(true)} onLink={close} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 999, backgroundColor: colors.accent, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  nudge: { position: 'absolute', right: 16, maxWidth: 260, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: colors.surfaceHigh, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg },
  badgeText: { fontSize: 10, lineHeight: 12 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
