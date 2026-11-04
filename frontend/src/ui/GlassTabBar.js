import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Glass from './Glass';
import Text from './Text';
import { PressScale } from './Button';
import { colors, fonts, radius } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// Floating glass tab bar for expo-router <Tabs tabBar={...}>. Each screen sets options.icon to an Ionicons name
// and options.title to its label. Every tab shows its label; the active one is white with a filled icon.
export default function GlassTabBar({ state, descriptors, emitter, navigateToTab }) {
  const { insets, contentWidth } = useLayout();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <Glass blur intensity={60} radius={radius.lg} style={[styles.bar, { maxWidth: Math.min(contentWidth - 24, 440) }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const icon = options.icon;
          const tint = focused ? colors.text : colors.textFaint;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <PressScale key={route.key} onPress={onPress} containerStyle={styles.slot}
              accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={options.title}>
              <View style={styles.item}>
                <Ionicons name={focused ? icon : `${icon}-outline`} size={22} color={tint} />
                <Text numberOfLines={1} color={tint} style={styles.label}>{options.title}</Text>
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
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, width: '92%' },
  slot: { flex: 1 },
  item: { height: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
});
