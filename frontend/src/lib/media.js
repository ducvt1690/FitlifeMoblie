import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

// Avatar and cover photos stay on this device: the picked image is copied into the app's documents
// (the picker's cache can be cleared by the system) and its path is remembered per account.
const key = (userId, kind) => `fitlife.photo.${kind}.${userId}`;

export async function loadPhotos(userId) {
  if (!userId) return {};
  const [avatar, cover] = await Promise.all([AsyncStorage.getItem(key(userId, 'avatar')), AsyncStorage.getItem(key(userId, 'cover'))]);
  return { avatar, cover };
}

// Returns the saved uri, or null when the member cancelled or refused photo access.
export async function pickPhoto(userId, kind) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Cần quyền truy cập ảnh để đổi ảnh. Bạn có thể bật trong Cài đặt.');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, quality: 0.7, aspect: kind === 'avatar' ? [1, 1] : [16, 9],
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  let uri = res.assets[0].uri;
  if (Platform.OS !== 'web') {
    const old = await AsyncStorage.getItem(key(userId, kind));
    // A new name each time, so cached copies of the old picture are not shown.
    const dest = new File(Paths.document, `${kind}-${userId}-${Date.now()}.jpg`);
    new File(uri).copy(dest);
    uri = dest.uri;
    if (old) try { new File(old).delete(); } catch {}
  }
  await AsyncStorage.setItem(key(userId, kind), uri);
  return uri;
}

export async function clearPhoto(userId, kind) {
  const old = await AsyncStorage.getItem(key(userId, kind));
  if (old && Platform.OS !== 'web') try { new File(old).delete(); } catch {}
  await AsyncStorage.removeItem(key(userId, kind));
}
