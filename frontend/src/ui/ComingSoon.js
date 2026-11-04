import { StyleSheet } from 'react-native';
import Screen from './Screen';
import Surface from './Surface';
import Text from './Text';
import { radius } from '../theme/tokens';

// Placeholder for screens still being rebuilt in the new design.
export default function ComingSoon({ title, note }) {
  return (
    <Screen tabBar>
      <Text variant="title" style={{ marginBottom: 20 }}>{title}</Text>
      <Surface radius={radius.lg} style={styles.card}>
        <Text variant="heading">Sắp có</Text>
        <Text tone="dim">{note ?? 'Phần này đang được làm lại và nối với dữ liệu thật.'}</Text>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 6 },
});
