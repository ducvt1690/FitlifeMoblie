import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

export default function FloatingNavBar({ activeTab, onSelectTab }) {
  const tabs = [
    { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home' },
    { key: 'workout', label: 'Tập luyện', icon: 'barbell-outline', activeIcon: 'barbell' },
    { key: 'activity', label: 'Thử thách', icon: 'flash-outline', activeIcon: 'flash' },
    { key: 'quests', label: 'Nhiệm vụ', icon: 'trophy-outline', activeIcon: 'trophy' },
    { key: 'menu', label: 'Tiện ích', icon: 'grid-outline', activeIcon: 'grid' },
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
                size={isActive ? 19 : 19}
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
    bottom: Platform.OS === 'ios' ? 22 : 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  dockPill: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 36,
    paddingHorizontal: 7,
    paddingVertical: 6,
    gap: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...SHADOWS.dock,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 24,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.lime,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabLabelActive: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
});
