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
