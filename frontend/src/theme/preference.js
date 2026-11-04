import { Appearance, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The saved theme choice. It is read synchronously at start-up so the first frame already has the right palette.
const KEY = 'fitlife.theme';
export const THEMES = [
  { value: 'dark', label: 'Tối' },
  { value: 'light', label: 'Sáng' },
  { value: 'system', label: 'Theo máy' },
];

export function readTheme() {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return THEMES.some(t => t.value === v) ? v : 'dark';
  } catch { return 'dark'; }
}

export function saveTheme(value) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
    else SecureStore.setItem(KEY, value);
  } catch {}
}

// The palette a choice stands for right now ('system' follows the phone's setting).
export const resolveScheme = (choice) => (choice === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : choice);
