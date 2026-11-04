import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// Plain dark page. Content is centred and width-capped on tablets.
// `tabBar` leaves room for the floating tab bar.
export default function Screen({ children, scroll = true, refreshing, onRefresh, tabBar = false, contentStyle }) {
  const { insets, gutter, contentWidth } = useLayout();
  const padding = { paddingTop: insets.top + 12, paddingBottom: (tabBar ? 110 : 24) + insets.bottom, paddingHorizontal: gutter };
  const inner = <View style={[{ width: '100%', maxWidth: contentWidth, alignSelf: 'center' }, contentStyle]}>{children}</View>;
  return (
    <View style={styles.page}>
      {scroll ? (
        // iOS moves the focused field above the keyboard by itself; Android resizes the window (app.json softwareKeyboardLayoutMode).
        <ScrollView contentContainerStyle={padding} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
          {inner}
        </ScrollView>
      ) : <View style={[styles.fill, padding]}>{inner}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
});
