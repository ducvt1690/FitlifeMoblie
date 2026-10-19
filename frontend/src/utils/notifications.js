import { Platform, Alert } from 'react-native';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  // Graceful fallback when running in Expo Go or environment without native notification support
  console.warn('Expo Notifications native module not available:', e?.message);
}

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'web' || !Notifications) {
    return true;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    console.log('Error requesting permissions', e);
    return false;
  }
};

export const sendInstantNotification = async (title, body) => {
  if (Platform.OS === 'web' || !Notifications) {
    Alert.alert(`🔔 ${title}`, body);
    return true;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'FitLife Health',
        body: body || 'Đã đến giờ chăm sóc sức khỏe của bạn!',
        sound: true,
      },
      trigger: null, // Send immediately
    });
    return true;
  } catch (e) {
    Alert.alert(`🔔 ${title}`, body);
    return false;
  }
};

export const scheduleAllReminders = async () => {
  const granted = await requestNotificationPermissions();
  if (!granted && Notifications) {
    Alert.alert('Chưa cấp quyền', 'Vui lòng cho phép nhận thông báo trong cài đặt máy để kích hoạt lời nhắc!');
    return false;
  }

  try {
    if (Platform.OS !== 'web' && Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
      await Notifications.cancelAllScheduledNotificationsAsync();

      // 1. Morning motivation (07:30 AM)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☀️ Chào buổi sáng cùng FitLife!',
          body: 'Bắt đầu ngày mới với một ly nước ấm và kiểm tra 7 nhiệm vụ để nhận 70 Coins nhé!',
          sound: true,
        },
        trigger: {
          hour: 7,
          minute: 30,
          repeats: true,
        },
      });

      // 2. Afternoon Water Reminder (14:00 PM)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Đã đến giờ uống nước!',
          body: 'Nạp thêm 250ml nước mát để giữ cơ thể tỉnh táo và làm việc hiệu quả nào.',
          sound: true,
        },
        trigger: {
          hour: 14,
          minute: 0,
          repeats: true,
        },
      });

      // 3. Evening Workout / Wind-down (18:30 PM)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏋️ Rèn luyện thể lực thôi!',
          body: 'Dành 15 phút tập HIIT hoặc đi bộ để đốt cháy năng lượng dư thừa hôm nay nhé.',
          sound: true,
        },
        trigger: {
          hour: 18,
          minute: 30,
          repeats: true,
        },
      });

      // 4. Bedtime reminder (22:30 PM)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Chuẩn bị đi ngủ nào!',
          body: 'Thư giãn mắt, hạn chế dùng điện thoại để có giấc ngủ sâu và tái tạo cơ bắp nhé.',
          sound: true,
        },
        trigger: {
          hour: 22,
          minute: 30,
          repeats: true,
        },
      });
    } else {
      Alert.alert(
        '🔔 Lời nhắc FitLife',
        'Đã thiết lập 4 khung giờ vàng nhắc nhở trong ngày (07:30 sáng, 14:00 chiều, 18:30 chiều, 22:30 tối)!'
      );
    }

    return true;
  } catch (e) {
    console.error('Error scheduling reminders', e);
    return false;
  }
};
