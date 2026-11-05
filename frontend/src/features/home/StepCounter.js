import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useAuth } from '../../context/AuthContext';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { createStepCounterSession, initialStepState } from './stepCounterSession';

const STATUS = {
  idle: 'Bấm bắt đầu, sau đó cầm điện thoại và đi vài bước.',
  checking: 'Đang kiểm tra cảm biến…',
  permission: 'Đang kiểm tra quyền hoạt động thể chất. Nếu điện thoại hỏi, hãy chọn Cho phép.',
  connecting: 'Đang kết nối máy chủ…',
  waiting: 'Đã bật đếm bước. Hãy đi vài bước để cảm biến gửi kết quả đầu tiên.',
  counting: 'Đang đếm bước chân.',
  stopped: 'Đã dừng. Bấm bắt đầu để tiếp tục.',
};
export default function StepCounter({ onSynced }) {
  const { call } = useAuth();
  const [state, setState] = useState(initialStepState);
  const session = useRef(null), onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;
  useEffect(() => {
    const counter = createStepCounterSession({
      pedometer: Pedometer, platform: Platform.OS,
      read: () => call('/api/steps-logs', { timeoutMs: 12000 }),
      write: body => call('/api/steps-logs/sensor', { method: 'PUT', body, timeoutMs: 12000 }),
      onChange: setState, onSynced: total => onSyncedRef.current?.(total),
      isForeground: () => AppState.currentState === 'active',
    });
    session.current = counter; setState(initialStepState);
    const timer = setInterval(() => counter.sync(), 10000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'background') counter.background(); });
    return () => { clearInterval(timer); subscription.remove(); counter.dispose(); session.current = null; };
  }, [call]);
  const active = ['waiting', 'counting'].includes(state.phase);
  const busy = ['checking', 'permission', 'connecting'].includes(state.phase);
  const unsupported = Platform.OS === 'web' || state.phase === 'unsupported';
  return <Surface style={{ padding: 18, gap: 12 }}>
    <Text variant="heading">Đếm bước chân</Text>
    <Text>{state.total == null ? 'Chưa bắt đầu đếm' : state.total.toLocaleString('vi-VN') + ' bước hôm nay'}</Text>
    {active && <Text>Phiên này: {state.sessionSteps.toLocaleString('vi-VN')} bước</Text>}
    <Text accessibilityLiveRegion="polite" tone={state.error ? 'danger' : 'dim'}>{Platform.OS === 'web' ? 'Trình duyệt không hỗ trợ cảm biến bước chân. Mở FitLife trên điện thoại để đếm; Web hiển thị dữ liệu đã đồng bộ.' : state.error || STATUS[state.phase]}</Text>
    <Text tone="dim">Giữ App đang mở khi đi bộ. Cảm biến có thể cập nhật theo từng đợt.</Text>
    {!!state.syncMessage && <Text accessibilityLiveRegion="polite">{state.syncMessage}</Text>}
    {!unsupported && <Button title={active ? 'Dừng đếm' : busy ? 'Đang khởi động…' : 'Bắt đầu đếm'} loading={busy} onPress={() => active ? (session.current?.sync(), session.current?.stop()) : session.current?.start()} />}
    {state.phase === 'denied' && <Button title="Mở cài đặt quyền" variant="glass" onPress={() => Linking.openSettings().catch(() => setState(s => ({ ...s, error: 'Không mở được cài đặt. Bạn hãy mở Cài đặt điện thoại và cấp quyền hoạt động thể chất cho FitLife hoặc Expo Go.' })))} />}
    {state.total !== null && <Button title="Đồng bộ lên Web" variant="glass" loading={state.syncing} onPress={() => session.current?.sync()} />}
  </Surface>;
}
