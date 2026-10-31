// Một chỗ duy nhất gọi backend. Dev: để trống VITE_API_URL, Vite proxy /api.
const API_URL = import.meta.env.VITE_API_URL ?? '';

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
    // Vite proxy trả 5xx không có JSON khi backend chưa bật.
    const message = data?.message ?? (res.status >= 500 ? FALLBACK_MESSAGES[0] : FALLBACK_MESSAGES[res.status]);
    throw new ApiError(res.status, message ?? 'Có lỗi xảy ra.');
  }
  return data;
}

export const authApi = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  me: (token) => request('/api/auth/me', { token }),
  logout: (token) => request('/api/auth/logout', { method: 'POST', token }),
};

// UUID do client tạo để backend bỏ qua request gửi lặp (bấm 2 lần, mạng chập chờn).
export const newId = () => crypto.randomUUID();

function query(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  return qs.toString() ? `?${qs}` : '';
}

// Các API cần đăng nhập. `call(path, { method, body })` đã gắn sẵn token.
export function createApi(call) {
  const post = (path, body) => call(path, { method: 'POST', body });
  const put = (path, body) => call(path, { method: 'PUT', body });

  return {
    profile: () => call('/api/profile'),
    updateProfile: (changes) => call('/api/profile', { method: 'PATCH', body: changes }),

    water: () => call('/api/water-logs'),
    addWater: (amount) => post('/api/water-logs', { log_id: newId(), amount }),
    meals: () => call('/api/meal-logs'),
    addMeal: (meal) => post('/api/meal-logs', { meal_id: newId(), ...meal }),
    deleteMeal: (mealId) => call(`/api/meal-logs/${mealId}`, { method: 'DELETE' }),
    workouts: () => call('/api/workout-logs'),
    addWorkout: (workout) => post('/api/workout-logs', { workout_id: newId(), ...workout }),
    sleep: () => call('/api/sleep-logs'),
    saveSleep: (log) => put('/api/sleep-logs', log),
    mood: () => call('/api/mood-logs'),
    saveMood: (log) => put('/api/mood-logs', log),

    quests: () => call('/api/quests'),
    checkin: () => post('/api/quests/checkin'),
    challenges: () => call('/api/challenges'),
    joinChallenge: (id) => post(`/api/challenges/${id}/join`),
    checkinChallenge: (id) => post(`/api/challenges/${id}/checkin`),
    rewards: () => call('/api/rewards'),
    buyReward: (itemId) => post(`/api/rewards/${itemId}/purchase`, { purchase_id: newId() }),

    exercises: (params = {}) => call(`/api/exercises${query(params)}`),
    stats: (days) => call(`/api/stats${query({ days })}`),
    bmi: () => call('/api/bmi-records'),

    chatSessions: () => call('/api/chat/sessions'),
    chatMessages: (sessionId) => call(`/api/chat/sessions/${sessionId}/messages`),
    sendChat: (sessionId, content) => post('/api/chat/messages', { session_id: sessionId, message_id: newId(), content }),
  };
}
