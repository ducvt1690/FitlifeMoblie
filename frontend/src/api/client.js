import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

// EXPO_PUBLIC_API_URL wins (deployed backend). In development without it, use the computer that serves
// the Expo bundle, port 5000, so a phone on the same Wi-Fi reaches the local backend with no setup.
function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:5000`;
}
export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const FALLBACK_MESSAGES = {
  0: 'Không kết nối được máy chủ. Kiểm tra mạng hoặc backend đã chạy chưa.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
  500: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
};

export async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, FALLBACK_MESSAGES[0]);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? FALLBACK_MESSAGES[res.status] ?? FALLBACK_MESSAGES[500];
    throw new ApiError(res.status, message);
  }
  return data;
}

export const authApi = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  me: (token) => request('/api/auth/me', { token }),
  logout: (token) => request('/api/auth/logout', { method: 'POST', token }),
};

// Client-made ids let the backend ignore a request sent twice (double tap, flaky network).
export const newId = () => randomUUID();

// Signed-in endpoints. `call(path, { method, body })` already carries the token.
export function createApi(call) {
  const post = (path, body) => call(path, { method: 'POST', body });
  return {
    profile: () => call('/api/profile'),
    stats: (days) => call(`/api/stats${days ? `?days=${days}` : ''}`),
    water: () => call('/api/water-logs'),
    addWater: (amount) => post('/api/water-logs', { log_id: newId(), amount }),
    steps: () => call('/api/steps-logs'),
    admin: {
      overview: () => call('/api/admin/overview'),
    },
  };
}
