import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../ui/Screen';
import Glass from '../../ui/Glass';
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
    { icon: 'resize', label: 'Chiều cao', value: p.height ? `${p.height} cm` : '—' },
    { icon: 'scale', label: 'Cân nặng', value: p.weight ? `${p.weight} kg` : '—' },
    { icon: 'flame', label: 'Mục tiêu năng lượng', value: p.target_calories ? `${p.target_calories.toLocaleString('vi-VN')} kcal` : '—' },
    { icon: 'water', label: 'Mục tiêu nước', value: p.target_water ? `${p.target_water.toLocaleString('vi-VN')} ml` : '—' },
  ];
  return (
    <Screen tabBar={tabBar}>
      <Text variant="title" style={styles.title}>Hồ sơ</Text>
      <Glass radius={radius.lg} style={styles.card}>
        <View style={styles.avatar}><Text variant="title" color={colors.accentInk}>{(user?.name?.trim().split(' ').pop()?.[0] ?? 'F').toUpperCase()}</Text></View>
        <View style={styles.flex}>
          <Text variant="heading" numberOfLines={1}>{user?.name}</Text>
          <Text variant="label" tone="dim" numberOfLines={1}>{user?.email}</Text>
          <View style={styles.role}><Text variant="caption" tone="accent">{ROLE_LABEL[user?.role] ?? user?.role}</Text></View>
        </View>
      </Glass>
      <Glass radius={radius.lg} style={styles.list}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i > 0 && styles.divider]}>
            <Ionicons name={r.icon} size={18} color={colors.textDim} />
            <Text variant="label" tone="dim" style={styles.flex}>{r.label}</Text>
            <Text variant="label">{r.value}</Text>
          </View>
        ))}
      </Glass>
      <Button title="Đăng xuất" variant="glass" icon="log-out-outline" loading={busy}
        onPress={async () => { setBusy(true); await logout(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  role: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  list: { paddingHorizontal: 16, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.strokeSoft },
});
