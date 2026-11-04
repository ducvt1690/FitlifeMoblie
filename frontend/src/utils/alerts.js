import { Alert as NativeAlert, Platform } from 'react-native';
const safeAction = action => async () => {
  try {
    await action?.();
  } catch (e) {
    Alert.alert('Chưa thực hiện được', e.message);
  }
};
export const Alert = {
  alert(title, message, buttons) {
    const choices = buttons?.map(b => ({
      ...b,
      onPress: safeAction(b.onPress)
    }));
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, choices);
    const action = choices?.find(b => b.style !== 'cancel');
    if (choices?.some(b => b.style === 'cancel')) {
      if (window.confirm(title + '\n' + message)) action?.onPress();
    } else {
      window.alert(title + '\n' + message);
      action?.onPress();
    }
  }
};
