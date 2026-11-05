export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const KEY = 'fitlife.web.session';
// Session storage keeps each browser tab isolated and is cleared when the tab closes.
export const tokenStore = {
  get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(token) { try { token ? sessionStorage.setItem(KEY, token) : sessionStorage.removeItem(KEY); } catch { /* Private mode can disable storage. */ } },
};
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function queryString(query = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null));
  return params.size ? `?${params}` : '';
}
export async function request(path, { token, method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, signal,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message || (res.status === 401 ? 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.' : `Yêu cầu chưa thành công (${res.status}).`));
  return data;
}
export const ROLES = { user: 'Thành viên', trainer: 'Huấn luyện viên', admin: 'Quản trị viên' };
export const ASSIGNMENT_STATUS = { assigned: 'Chờ hoàn thành', done: 'Hoàn thành', cancelled: 'Đã hủy' };
export const PAYMENT_STATUS = { pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại' };
export const LEVELS = { beginner: 'Cơ bản', intermediate: 'Trung bình', advanced: 'Nâng cao' };
export const rootFor = role => ({ user: '/member', trainer: '/trainer', admin: '/admin' })[role] || '/login';
