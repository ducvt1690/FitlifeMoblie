import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  LogBox,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './src/constants/theme';

import FloatingNavBar from './src/components/FloatingNavBar';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import QuestScreen from './src/screens/QuestScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import MenuScreen from './src/screens/MenuScreen';
import AuthScreen from './src/screens/AuthScreen';
import { getAuthSession } from './src/utils/storage';

// Ẩn tất cả cảnh báo LogBox dạng thanh vàng/đen ở đáy màn hình
LogBox.ignoreAllLogs();

// Inject Google Fonts (Be Vietnam Pro + Plus Jakarta Sans) & Web CSS Polish
function useWebTypographyAndStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const fontLinkId = 'fitlife-google-fonts';
    if (!document.getElementById(fontLinkId)) {
      const link = document.createElement('link');
      link.id = fontLinkId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';
      document.head.appendChild(link);
    }

    const styleId = 'fitlife-web-global-css';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        html, body, #root {
          margin: 0;
          padding: 0;
          height: 100%;
          background-color: #0B111E;
          font-family: 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        * {
          font-family: 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          box-sizing: border-box;
        }
        input, textarea, button, select {
          font-family: 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
          outline: none !important;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.16);
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 23, 42, 0.28);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
}

export default function App() {
  useWebTypographyAndStyles();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 640;

  const [authSession, setAuthSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [webWideMode, setWebWideMode] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [menuInitialModal, setMenuInitialModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    (async () => {
      const session = await getAuthSession();
      setAuthSession(session);
      setIsAuthChecking(false);
    })();
  }, []);

  const handleNavigate = (target) => {
    if (['home', 'workout', 'activity', 'quests', 'menu'].includes(target)) {
      setMenuInitialModal(null);
      setActiveTab(target);
    } else {
      // Direct navigation to sub-features (e.g. 'aicoach', 'shop', 'profile', 'analytics')
      setMenuInitialModal(target);
      setActiveTab('menu');
    }
  };

  const handleLogout = () => {
    setAuthSession(null);
    setActiveTab('home');
    setMenuInitialModal(null);
    triggerRefresh();
  };

  // Loading state while checking persistent session
  if (isAuthChecking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.lime} />
      </View>
    );
  }

  const renderMainContent = () => {
    if (!authSession || !authSession.isLoggedIn) {
      return (
        <AuthScreen
          onLoginSuccess={(user) => {
            setAuthSession({ isLoggedIn: true, user });
            triggerRefresh();
          }}
        />
      );
    }

    return (
      <View style={styles.container}>
        {/* Active Screen */}
        <View style={styles.screenContent}>
          {activeTab === 'home' && (
            <HomeScreen
              key={`home_${refreshKey}`}
              onNavigate={handleNavigate}
            />
          )}
          {activeTab === 'workout' && (
            <WorkoutScreen key={`workout_${refreshKey}`} />
          )}
          {activeTab === 'activity' && <ChallengeScreen />}
          {activeTab === 'quests' && (
            <QuestScreen
              key={`quest_${refreshKey}`}
              onBack={() => handleNavigate('home')}
              onNavigate={handleNavigate}
              onQuestCompleted={triggerRefresh}
            />
          )}
          {activeTab === 'menu' && (
            <MenuScreen
              key={`menu_${menuInitialModal}_${refreshKey}`}
              initialModal={menuInitialModal}
              onLogout={handleLogout}
            />
          )}
        </View>

        {/* Floating Capsule Dock Navigation */}
        <FloatingNavBar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setMenuInitialModal(null);
            setActiveTab(tab);
          }}
        />
      </View>
    );
  };

  if (isDesktopWeb) {
    return (
      <SafeAreaProvider>
        <View style={styles.webBackdrop}>
          {/* Top Web Studio Bar */}
          <View style={styles.webTopBar}>
            <View style={styles.webBrandRow}>
              <View style={styles.webBrandLogo}>
                <Ionicons name="flash" size={16} color={COLORS.black} />
              </View>
              <Text style={styles.webBrandName}>FitLife Pro</Text>
              <View style={styles.webVersionBadge}>
                <Text style={styles.webVersionText}>Web & Mobile Studio</Text>
              </View>
            </View>

            {authSession?.isLoggedIn && (
              <View style={styles.webQuickNav}>
                {[
                  { key: 'home', label: 'Trang chủ', icon: 'home-outline' },
                  { key: 'workout', label: 'Tập luyện', icon: 'barbell-outline' },
                  { key: 'activity', label: 'Thử thách', icon: 'flash-outline' },
                  { key: 'quests', label: 'Nhiệm vụ', icon: 'trophy-outline' },
                  { key: 'menu', label: 'Tiện ích', icon: 'grid-outline' },
                ].map((item) => {
                  const active = activeTab === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.webNavBtn, active && styles.webNavBtnActive]}
                      onPress={() => {
                        setMenuInitialModal(null);
                        setActiveTab(item.key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={item.icon}
                        size={14}
                        color={active ? COLORS.black : '#CBD5E1'}
                      />
                      <Text
                        style={[
                          styles.webNavBtnText,
                          active && styles.webNavBtnTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.webWidthToggle}
              onPress={() => setWebWideMode((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={webWideMode ? 'phone-portrait-outline' : 'desktop-outline'}
                size={14}
                color="#E2E8F0"
              />
              <Text style={styles.webWidthToggleText}>
                {webWideMode ? 'Khung Mobile' : 'Mở rộng khung'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Centered App Viewport Card */}
          <View
            style={[
              styles.webPhoneFrame,
              webWideMode ? styles.webFrameWide : styles.webFrameMobile,
            ]}
          >
            {renderMainContent()}
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ExpoStatusBar style="dark" />
        {renderMainContent()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    position: 'relative',
  },
  screenContent: {
    flex: 1,
  },
  // Desktop Web Studio Shell
  webBackdrop: {
    flex: 1,
    backgroundColor: '#0B111E',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  webTopBar: {
    width: '100%',
    maxWidth: 1080,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.78)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    marginBottom: 14,
  },
  webBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webBrandLogo: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBrandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  webVersionBadge: {
    backgroundColor: 'rgba(188, 239, 57, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(188, 239, 57, 0.3)',
  },
  webVersionText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.lime,
  },
  webQuickNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  webNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  webNavBtnActive: {
    backgroundColor: COLORS.lime,
  },
  webNavBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  webNavBtnTextActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
  webWidthToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  webWidthToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  webPhoneFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.bg,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
  },
  webFrameMobile: {
    maxWidth: 480,
  },
  webFrameWide: {
    maxWidth: 880,
  },
});
