import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reminders still show as a banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Schedules the after-workout reminders from the server ({ in_minutes, title, body }) as local notifications.
// Returns how many were scheduled; 0 when the member declined notifications or on web.
export async function scheduleReminders(reminders = []) {
  if (Platform.OS === 'web' || !reminders.length || !(await readReminderSettings()).after_workout) return 0;
  try {
    if (!(await allowed())) return 0;
    await Promise.all(reminders.map(r => Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, Math.round(r.in_minutes * 60)) },
    })));
    return reminders.length;
  } catch {
    return 0;
  }
}

// Notification switches on the profile page, kept on this device.
const SETTINGS = 'fitlife.reminders';
const WATER_HOURS = [9, 11, 13, 15, 17, 19];
export async function readReminderSettings() {
  try { return { after_workout: true, water: false, ...JSON.parse(await AsyncStorage.getItem(SETTINGS) ?? '{}') }; }
  catch { return { after_workout: true, water: false }; }
}

async function allowed() {
  if (Platform.OS === 'web') return false;
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
  return granted;
}

// Saves the switches; turning water reminders on schedules one every two hours from 9:00 to 19:00, every day.
export async function saveReminderSettings(next) {
  if (next.water && !(await allowed())) throw new Error('Bạn chưa cho phép FitLife gửi thông báo. Hãy bật trong Cài đặt của máy.');
  await AsyncStorage.setItem(SETTINGS, JSON.stringify(next));
  if (Platform.OS === 'web') return;
  await Promise.all(WATER_HOURS.map(h => Notifications.cancelScheduledNotificationAsync(`water-${h}`).catch(() => {})));
  if (next.water) {
    await Promise.all(WATER_HOURS.map(hour => Notifications.scheduleNotificationAsync({
      identifier: `water-${hour}`,
      content: { title: 'Uống nước nào 💧', body: 'Một ly 250 ml giúp bạn tỉnh táo và tập tốt hơn.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
    })));
  }
}
