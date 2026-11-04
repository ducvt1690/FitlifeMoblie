import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from './Screen';
import Glass from './Glass';
import Text from './Text';
import { colors, radius } from '../theme/tokens';

// Placeholder for screens still being rebuilt in the new design.
export default function ComingSoon({ title, icon, note }) {
  return (
    <Screen tabBar>
      <Text variant="title" style={{ marginBottom: 20 }}>{title}</Text>
      <Glass radius={radius.lg} style={styles.card}>
        <View style={styles.badge}><Ionicons name={icon} size={28} color={colors.accent} /></View>
        <Text variant="heading" align="center">Đang làm lại</Text>
        <Text tone="dim" align="center">{note ?? 'Màn hình này đang được thiết kế lại và nối với dữ liệu thật.'}</Text>
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 28, alignItems: 'center', gap: 10 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
