import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Glass from './Glass';
import Text from './Text';
import { PressScale } from './Button';
import { colors, radius } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// Floating glass tab bar for expo-router <Tabs tabBar={...}>. Each screen sets options.icon to an Ionicons name
// and options.title to its label; the active tab shows a lime pill with its label.
export default function GlassTabBar({ state, descriptors, emitter, navigateToTab }) {
  const { insets, contentWidth } = useLayout();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <Glass blur intensity={60} radius={radius.pill} style={[styles.bar, { maxWidth: Math.min(contentWidth - 24, 440) }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const icon = options.icon;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <PressScale key={route.key} onPress={onPress} containerStyle={focused ? styles.slotOn : styles.slot}
              accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={options.title}>
              <View style={[styles.item, focused && styles.itemOn]}>
                <Ionicons name={focused ? icon : `${icon}-outline`} size={20} color={focused ? colors.accentInk : colors.textDim} />
                {focused && <Text variant="caption" numberOfLines={1} color={colors.accentInk} style={styles.label}>{options.title}</Text>}
              </View>
            </PressScale>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 6, width: '92%' },
  slot: { flex: 1 },
  slotOn: { flex: 2 },
  item: { height: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  itemOn: { backgroundColor: colors.accent, paddingHorizontal: 12 },
  label: { fontFamily: 'BeVietnamPro_700Bold' },
});
