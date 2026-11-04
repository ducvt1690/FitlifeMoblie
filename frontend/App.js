import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  LogBox,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { COLORS } from './src/constants/theme';

import FloatingNavBar from './src/components/FloatingNavBar';
import HomeScreen from './src/screens/HomeScreen';
import QuestScreen from './src/screens/QuestScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import MenuScreen from './src/screens/MenuScreen';
import AuthScreen from './src/screens/AuthScreen';
import { getAuthSession, clearAuthSession } from './src/utils/storage';
import { onSessionExpired } from './src/utils/apiClient';

// Ẩn tất cả cảnh báo LogBox dạng thanh vàng/đen ở đáy màn hình
LogBox.ignoreAllLogs();

export default function App() {
  const [authSession, setAuthSession] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [sessionError,setSessionError] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [menuInitialModal, setMenuInitialModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const checkSession = async () => {
    setSessionError('');setIsAuthChecking(true);
    try {
      const session = await getAuthSession();
      setAuthSession(session);
    } catch(e) { setSessionError(e.message); }
    finally { setIsAuthChecking(false); }
  };
  useEffect(() => {checkSession();return onSessionExpired(()=>{setAuthSession(null);setActiveTab('home');setMenuInitialModal(null);});}, []);

  const handleNavigate = (target) => {
    if (['home', 'activity', 'quests', 'menu'].includes(target)) {
      setMenuInitialModal(null);
      setActiveTab(target);
    } else {
      // Direct navigation to sub-features (e.g. 'aicoach', 'shop', 'profile', 'analytics')
      setMenuInitialModal(target);
      setActiveTab('menu');
    }
  };

  const handleLogout = async () => {
    try { await clearAuthSession(); } catch { /* Local credentials are cleared even without a connection. */ }
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
  if(sessionError)return <SafeAreaProvider><SafeAreaView style={styles.safeArea}><Text accessibilityRole="alert">{sessionError}</Text><TouchableOpacity onPress={checkSession}><Text>Thử lại</Text></TouchableOpacity><TouchableOpacity onPress={()=>{setSessionError('');setAuthSession(null);}}><Text>Về đăng nhập</Text></TouchableOpacity></SafeAreaView></SafeAreaProvider>;

  // If user is not logged in, show AuthScreen (Login / Register / Guest)
  if (!authSession || !authSession.isLoggedIn) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ExpoStatusBar style="dark" />
          <AuthScreen
            onLoginSuccess={(user) => {
              setAuthSession({ isLoggedIn: true, user });
              triggerRefresh();
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ExpoStatusBar style="dark" />
        <View style={styles.container}>
          {/* Active Screen */}
          <View style={styles.screenContent}>
            {activeTab === 'home' && (
              <HomeScreen
                key={`home_${refreshKey}`}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'activity' && <ChallengeScreen />}
            {activeTab === 'quests' && (
              <QuestScreen
                key={`quest_${refreshKey}`}
                onBack={() => handleNavigate('home')}
                onQuestCompleted={triggerRefresh}
                onNavigate={handleNavigate}
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
});
