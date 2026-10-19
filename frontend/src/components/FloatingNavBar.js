import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

export default function FloatingNavBar({ activeTab, onSelectTab }) {
  const tabs = [
    { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'activity', label: 'Thử thách', icon: 'flash-outline', activeIcon: 'flash' },
    { key: 'quests', label: 'Nhiệm vụ', icon: 'trophy-outline', activeIcon: 'trophy' },
    { key: 'menu', label: 'Menu', icon: 'grid-outline', activeIcon: 'grid' },
  ];

  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockPill}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                isActive ? styles.tabActive : styles.tabInactive,
              ]}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={isActive ? 21 : 20}
                color={isActive ? COLORS.black : '#94A3B8'}
              />
              {isActive && (
                <Text style={styles.tabLabelActive} numberOfLines={1}>
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  dockPill: {
    flexDirection: 'row',
    backgroundColor: '#0F172A', // Deep obsidian dark dock
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...SHADOWS.dock,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.lime, // Neon Lime active pill
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabLabelActive: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
});
