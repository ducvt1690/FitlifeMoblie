import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { colors, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABEL = { user: 'Thành viên', trainer: 'Huấn luyện viên', admin: 'Quản trị viên' };

// Account card shared by every role. `tabBar` leaves room for the floating tab bar.
export default function MeScreen({ tabBar = true }) {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const p = user?.profile ?? {};
  const rows = [
    { label: 'Chiều cao', value: p.height ? `${p.height} cm` : '—' },
    { label: 'Cân nặng', value: p.weight ? `${p.weight} kg` : '—' },
    { label: 'Mục tiêu năng lượng', value: p.target_calories ? `${p.target_calories.toLocaleString('vi-VN')} kcal` : '—' },
    { label: 'Mục tiêu nước', value: p.target_water ? `${p.target_water.toLocaleString('vi-VN')} ml` : '—' },
  ];
  return (
    <Screen tabBar={tabBar}>
      <Text variant="title" style={styles.title}>Hồ sơ</Text>
      <Surface radius={radius.lg} style={styles.card}>
        <View style={styles.avatar}><Text variant="title">{(user?.name?.trim().split(' ').pop()?.[0] ?? 'F').toUpperCase()}</Text></View>
        <View style={styles.flex}>
          <Text variant="heading" numberOfLines={1}>{user?.name}</Text>
          <Text variant="label" tone="dim" numberOfLines={1}>{user?.email}</Text>
          <Text variant="caption" tone="faint" style={styles.role}>{ROLE_LABEL[user?.role] ?? user?.role}</Text>
        </View>
      </Surface>
      <Surface radius={radius.lg} style={styles.list}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i > 0 && styles.divider]}>
            <Text variant="label" tone="dim" style={styles.flex}>{r.label}</Text>
            <Text variant="label">{r.value}</Text>
          </View>
        ))}
      </Surface>
      <Button title="Đăng xuất" variant="glass" loading={busy}
        onPress={async () => { setBusy(true); await logout(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  role: { marginTop: 4 },
  list: { paddingHorizontal: 16, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.strokeSoft },
});
