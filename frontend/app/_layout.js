import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { colors, scheme } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready, user } = useAuth();
  const role = user?.role;
  const [fontsLoaded] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  });
  const loaded = ready && fontsLoaded;
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade_from_bottom' }}>
      {/* "/" shows the landing page or sends a signed-in person to their role's area. */}
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      {/* Each area exists only for its role: signing in or out drops the other screens from history. */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user && role !== 'admin'}>
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
