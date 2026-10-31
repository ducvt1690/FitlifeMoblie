import { useCallback, useEffect, useRef, useState } from 'react';

// Tải dữ liệu khi vào trang; `reload()` gọi lại sau khi người dùng ghi/sửa.
export function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const latest = useRef(loader);
  latest.current = loader;

  const reload = useCallback(async () => {
    try {
      setData(await latest.current());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); reload(); }, deps);

  return { data, error, loading, reload };
}

// Thông báo ngắn sau mỗi thao tác (thành công hoặc lỗi), tự tắt sau 4 giây.
export function useNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef();
  const show = useCallback((type, text) => {
    clearTimeout(timer.current);
    setNotice({ type, text });
    timer.current = setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Chạy một thao tác: báo lỗi nếu hỏng, báo thành công (kèm xu thưởng) nếu được.
  const run = useCallback(async (action, success) => {
    try {
      const result = await action();
      const coins = result?.reward_coins ? ` +${result.reward_coins} xu` : '';
      const text = typeof success === 'function' ? success(result) : success;
      if (text) show('success', text + coins);
      return result;
    } catch (err) {
      show('error', err.message);
      return null;
    }
  }, [show]);

  return { notice, run };
}
