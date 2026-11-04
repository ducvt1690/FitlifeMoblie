import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../ui/Text';
import { colors, radius, themed } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useAuth } from '../../context/AuthContext';
import CoachChat from './CoachChat';

const STARTERS = ['Hôm nay mình nên ăn gì thêm?', 'Lên lịch tập ngực 45 phút cho mình', 'Tối nay ngủ sao cho sâu?'];

// The Coach tab: the shared chat plus what the coach remembers about the member.
export default function CoachScreen() {
  const { api } = useAuth();
  const { insets } = useLayout();
  const [facts, setFacts] = useState([]);
  const [open, setOpen] = useState(false);
  const loadMemory = useCallback(() => { api.chat.memory().then(r => setFacts(r.facts)).catch(() => {}); }, [api]);
  useFocusEffect(loadMemory);

  const header = (
    <View style={{ gap: 10, paddingTop: insets.top + 12 }}>
      <Text variant="title">AI Coach</Text>
      <Text tone="dim">Nhờ Coach lên lịch tập, ghi bữa ăn, gợi ý món hay hỏi về giấc ngủ. Coach nhớ những điều bạn dặn.</Text>
      <Pressable onPress={() => setOpen(o => !o)} style={styles.memory} accessibilityRole="button">
        <Ionicons name="sparkles" size={16} color={colors.accent} />
        <Text variant="label" tone="dim" style={{ flex: 1 }}>Coach đang nhớ {facts.length} điều về bạn</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
      </Pressable>
      {open ? (
        <View style={styles.facts}>
          {facts.length ? facts.map(f => <Text key={f} variant="label">• {f}</Text>)
            : <Text variant="label" tone="faint">Chưa có. Thử nhắn: "Nhớ giúp mình là mình đau gối trái".</Text>}
          {facts.length ? (
            <Pressable onPress={() => api.chat.clearMemory().then(r => setFacts(r.facts)).catch(() => {})} accessibilityRole="button">
              <Text variant="label" tone="danger">Xoá hết bộ nhớ</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <CoachChat starters={STARTERS} header={header} bottom={88 + insets.bottom} onAction={loadMemory} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.strokeSoft },
  facts: { gap: 6, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface },
}));
