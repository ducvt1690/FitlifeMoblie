import Constants from 'expo-constants';


const randomUUID = () => {
  try {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

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

export async function request(path, { method = 'GET', body, token, timeoutMs } = {}) {
  let res;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      ...(controller ? { signal: controller.signal } : {}),
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, controller?.signal.aborted ? 'Máy chủ phản hồi quá lâu. Kiểm tra kết nối và thử lại.' : FALLBACK_MESSAGES[0]);
  } finally {
    if (timer) clearTimeout(timer);
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
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (email, code, new_password) => request('/api/auth/reset-password', { method: 'POST', body: { email, code, new_password } }),
};

// Client-made ids let the backend ignore a request sent twice (double tap, flaky network).
export const newId = () => randomUUID();

// Signed-in endpoints. `call(path, { method, body })` already carries the token.
export function createApi(call) {
  const post = (path, body) => call(path, { method: 'POST', body });
  return {
    profile: () => call('/api/profile'),
    updateProfile: (body) => call('/api/profile', { method: 'PATCH', body }),
    changePassword: (current_password, new_password) => post('/api/auth/change-password', { current_password, new_password }),
    lifetime: () => call('/api/stats/lifetime'),
    bmi: (limit = 60) => call(`/api/bmi-records?limit=${limit}`),
    payments: {
      plans: () => call('/api/payments/plans'),
      orders: () => call('/api/payments/orders'),
      create: (product, return_url, order_id = newId()) => post('/api/payments/orders', { order_id, product, return_url }),
      simulate: (id, outcome) => post(`/api/payments/orders/${encodeURIComponent(id)}/simulate`, { outcome }),
      order: (id) => call(`/api/payments/orders/${encodeURIComponent(id)}`),
    },
    stats: (days) => call(`/api/stats${days ? `?days=${days}` : ''}`),
    water: () => call('/api/water-logs'),
    addWater: (amount) => post('/api/water-logs', { log_id: newId(), amount }),
    steps: () => call('/api/steps-logs'),
    nutrition: {
      today: () => call('/api/nutrition/today'),
      parse: (text) => post('/api/nutrition/parse', { text }),
      parsePhoto: (image) => post('/api/nutrition/parse-photo', { image }),
      suggest: () => post('/api/nutrition/suggestions'),
      accept: (id) => post(`/api/nutrition/suggestions/${id}/accept`),
      eat: (id) => post(`/api/nutrition/suggestions/${id}/eat`),
      setDay: (completed) => call('/api/nutrition/day', { method: 'PUT', body: { completed } }),
      setAllergies: (allergies) => call('/api/nutrition/allergies', { method: 'PUT', body: { allergies } }),
      addMeal: (meal) => post('/api/meal-logs', { meal_id: newId(), ...meal }),
      removeMeal: (id) => call(`/api/meal-logs/${id}`, { method: 'DELETE' }),
    },
    exercises: {
      get: (id) => call(`/api/exercises/${id}`),
    },
    plans: {
      today: () => call('/api/workout-plans/today'),
      create: (body) => post('/api/workout-plans', body),
      setDone: (id, done) => call(`/api/workout-plans/${id}/items`, { method: 'PUT', body: { done } }),
      complete: (id) => post(`/api/workout-plans/${id}/complete`),
    },
    workouts: () => call('/api/workout-logs'),
    chat: {
      sessions: () => call('/api/chat/sessions'),
      messages: (id) => call(`/api/chat/sessions/${id}/messages`),
      send: (body) => post('/api/chat/messages', body),
      memory: () => call('/api/chat/memory'),
      clearMemory: () => call('/api/chat/memory', { method: 'DELETE' }),
    },
    admin: {
      overview: () => call('/api/admin/overview'),
      accounts: (query = {}) => {
        const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== '' && value != null));
        return call(`/api/admin/accounts${params.size ? `?${params}` : ''}`);
      },
      updateAccount: (id, body) => call(`/api/admin/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    },
  };
}
