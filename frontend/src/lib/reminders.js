import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Reminders still show as a banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Schedules the after-workout reminders from the server ({ in_minutes, title, body }) as local notifications.
// Returns how many were scheduled; 0 when the member declined notifications or on web.
export async function scheduleReminders(reminders = []) {
  if (Platform.OS === 'web' || !reminders.length) return 0;
  try {
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return 0;
    await Promise.all(reminders.map(r => Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, Math.round(r.in_minutes * 60)) },
    })));
    return reminders.length;
  } catch {
    return 0;
  }
}
