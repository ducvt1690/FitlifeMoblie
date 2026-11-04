import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// Dark page with a faint accent glow at the top. Content is centred and width-capped on tablets.
// `tabBar` leaves room for the floating tab bar.
export default function Screen({ children, scroll = true, refreshing, onRefresh, tabBar = false, contentStyle }) {
  const { insets, gutter, contentWidth } = useLayout();
  const padding = { paddingTop: insets.top + 12, paddingBottom: (tabBar ? 110 : 24) + insets.bottom, paddingHorizontal: gutter };
  const inner = <View style={[{ width: '100%', maxWidth: contentWidth, alignSelf: 'center' }, contentStyle]}>{children}</View>;
  return (
    <View style={styles.page}>
      <LinearGradient colors={['rgba(198,244,50,0.10)', 'rgba(198,244,50,0)']} style={styles.glow} pointerEvents="none" />
      {scroll ? (
        <ScrollView contentContainerStyle={padding} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
          {inner}
        </ScrollView>
      ) : <View style={[styles.fill, padding]}>{inner}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  fill: { flex: 1 },
});
