import { Tabs } from 'expo-router';
import GlassTabBar from './GlassTabBar';
import { colors } from '../theme/tokens';

// Tab layout with the floating glass bar. tabs: [{ name, title, icon }] where icon is an Ionicons base name.
export default function GlassTabs({ tabs }) {
  return (
    <Tabs initialRouteName={tabs[0].name} tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}>
      {tabs.map(t => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, icon: t.icon }} />)}
    </Tabs>
  );
}
