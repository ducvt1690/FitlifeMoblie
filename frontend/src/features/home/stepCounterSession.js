export const initialStepState = { phase: 'idle', total: null, sessionSteps: 0, syncing: false, error: '', syncMessage: '' };

function timed(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]).finally(() => clearTimeout(timer));
}

// Sensor and network adapters are injected so lifecycle/race behaviour can be tested without inventing steps.
export function createStepCounterSession({ pedometer, read, write, onChange, onSynced, isForeground = () => true, platform = 'native', timeoutMs = 12000, permissionTimeoutMs = 60000 }) {
  let state = { ...initialStepState }, sensor = null, latest = null, acknowledged = 0;
  let generation = 0, starting = false, sending = false, disposed = false;
  const emit = patch => { state = { ...state, ...patch }; if (!disposed) onChange({ ...state }); };
  const removeSensor = () => { sensor?.remove(); sensor = null; };
  const stop = () => { generation++; starting = false; removeSensor(); emit({ phase: 'stopped' }); };

  async function start() {
    if (disposed || starting || sensor) return;
    if (platform === 'web') { emit({ phase: 'unsupported', error: 'Trình duyệt không hỗ trợ cảm biến bước chân. Hãy mở FitLife trên điện thoại; Web chỉ hiển thị dữ liệu đã đồng bộ.' }); return; }
    starting = true;
    const revision = ++generation;
    const current = () => !disposed && revision === generation;
    emit({ phase: 'checking', error: '', syncMessage: '', sessionSteps: 0 });
    try {
      const available = await timed(pedometer.isAvailableAsync(), timeoutMs, 'Chưa nhận được phản hồi từ cảm biến. Vui lòng thử lại.');
      if (!current()) return;
      if (!available) { emit({ phase: 'unsupported', error: 'Thiết bị này không hỗ trợ cảm biến đếm bước chân. Máy ảo thường không có cảm biến này.' }); return; }
      emit({ phase: 'permission' });
      let permission = await timed(pedometer.getPermissionsAsync(), timeoutMs, 'Chưa đọc được quyền hoạt động thể chất.');
      if (!current()) return;
      if (!permission.granted && permission.canAskAgain !== false) permission = await timed(pedometer.requestPermissionsAsync(), permissionTimeoutMs, 'Chưa nhận được lựa chọn quyền. Vui lòng cho phép hoạt động thể chất và thử lại.');
      if (!current()) return;
      if (!permission.granted) { emit({ phase: 'denied', error: 'Chưa được cấp quyền hoạt động thể chất. Hãy cho phép FitLife trong cài đặt quyền của điện thoại rồi thử lại.' }); return; }
      emit({ phase: 'connecting' });
      const saved = await timed(read(), timeoutMs, 'Không kết nối được máy chủ để đồng bộ bước chân. Kiểm tra mạng và thử lại.');
      if (!current()) return;
      if (!isForeground()) { stop(); return; }
      const baseline = Math.max(saved.steps, latest?.date === saved.date ? latest.total : 0);
      latest = { date: saved.date, total: baseline }; acknowledged = saved.steps;
      emit({ phase: 'waiting', total: baseline, sessionSteps: 0 });
      sensor = pedometer.watchStepCount(({ steps }) => {
        if (!current() || !Number.isInteger(steps) || steps < 0 || steps < state.sessionSteps) return;
        latest = { date: saved.date, total: Math.min(200000, baseline + steps) };
        emit({ phase: steps ? 'counting' : 'waiting', total: latest.total, sessionSteps: steps });
      });
    } catch (error) {
      if (current()) { removeSensor(); emit({ phase: 'error', error: error.message || 'Chưa khởi động được cảm biến. Vui lòng thử lại.' }); }
    } finally { if (current()) starting = false; }
  }

  async function sync() {
    if (disposed || sending || !latest || latest.total <= acknowledged) return;
    sending = true;
    const sample = { ...latest };
    emit({ syncing: true, syncMessage: '' });
    try {
      const result = await timed(write(sample), timeoutMs, 'Chưa đồng bộ được. Số bước mới vẫn đang hiển thị trong App; hãy thử đồng bộ lại.');
      if (disposed || latest?.date !== sample.date) return;
      // Only acknowledge the submitted sample, so events received during the request remain pending.
      acknowledged = Math.max(acknowledged, sample.total);
      emit({ syncMessage: 'Đã đồng bộ bước chân lên tài khoản.' });
      onSynced?.(result.steps);
    } catch (error) {
      if (!disposed) { emit({ syncMessage: error.message }); if (error.status === 409) stop(); }
    } finally { sending = false; emit({ syncing: false }); }
  }
  return { start, stop, sync,
    background() { if (sensor) { sync(); stop(); } },
    dispose() { disposed = true; generation++; removeSensor(); },
  };
}
