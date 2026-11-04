import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'fitlife.token';

// Keychain/Keystore on the phone; the web build has no secure store, so it falls back to localStorage.
export const tokenStore = {
  async get() {
    try {
      return Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
    } catch { return null; }
  },
  async set(token) {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
      else await SecureStore.setItemAsync(KEY, token);
    } catch { /* the session still works until the app restarts */ }
  },
  async clear() {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
      else await SecureStore.deleteItemAsync(KEY);
    } catch { /* nothing stored */ }
  },
};
