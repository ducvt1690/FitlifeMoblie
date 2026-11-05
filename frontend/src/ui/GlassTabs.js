import { Fragment } from 'react';
import { Tabs } from 'expo-router';
import GlassTabBar from './GlassTabBar';
import { colors, useScheme } from '../theme/tokens';

// Tab layout with the floating glass bar. tabs: [{ name, title, icon }] where icon is an Ionicons base name.
export default function GlassTabs({ tabs }) {
  // A theme change remounts each tab's content with the new palette; the open tab and its history stay.
  const scheme = useScheme();
  return (
    <Tabs initialRouteName={tabs[0].name} tabBar={(props) => <GlassTabBar {...props} />}
      screenLayout={({ children }) => <Fragment key={scheme}>{children}</Fragment>}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}>
      {tabs.map(t => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, icon: t.icon }} />)}
    </Tabs>
  );
}
