import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? `${window.location.protocol}//${window.location.hostname}:5000` : `http://${metroHost || '10.0.2.2'}:5000`)).replace(/\/$/, '');
const TOKEN_KEY = 'fitlife.server.session';
const listeners = new Set();
let token,
  revision = 0;
export const newId = () => randomUUID();
export const onSessionExpired = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}
async function readToken() {
  if (token === undefined) {
    if (Platform.OS === 'web') {
      try {
        token = window.sessionStorage.getItem(TOKEN_KEY);
      } catch {
        token = null;
      }
    } else token = await SecureStore.getItemAsync(TOKEN_KEY);
  }
  return token;
}
export async function setToken(value) {
  revision++;
  token = value;
  if (Platform.OS === 'web') {
    try {
      if (value) window.sessionStorage.setItem(TOKEN_KEY, value);else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {/* The current tab still keeps the session in memory. */}
  } else if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export async function request(path, body, method = body === undefined ? 'GET' : 'POST', {
  retry = false,
  anonymous = false
} = {}) {
  const session = anonymous ? null : await readToken();
  const started = revision;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        method,
        signal: controller.signal,
        headers: {
          ...(body === undefined ? {} : {
            'Content-Type': 'application/json'
          }),
          ...(session ? {
            Authorization: `Bearer ${session}`
          } : {})
        },
        ...(body === undefined ? {} : {
          body: JSON.stringify(body)
        })
      });
    } catch (error) {
      if (retry && started === revision) return await request(path, body, method, {
        anonymous,
        retry: false
      });
      throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    }
    if (started !== revision) throw new ApiError('Phiên đã thay đổi. Vui lòng tải lại dữ liệu.');
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (started !== revision) throw new ApiError('Phiên đã thay đổi. Vui lòng tải lại dữ liệu.');
    if (!response.ok) {
      if (response.status === 401 && session) {
        await setToken(null);
        for (const listener of listeners) listener();
      }
      throw new ApiError(data?.message || `Không thể xử lý yêu cầu (${response.status}).`, response.status);
    }
    if (data === null && response.status !== 204) throw new ApiError('Máy chủ trả dữ liệu không hợp lệ.');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
