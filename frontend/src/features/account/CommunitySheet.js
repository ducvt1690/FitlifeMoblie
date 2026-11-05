import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../../ui/Sheet';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import { managementStyles as styles } from '../../ui/Management';

export default function CommunitySheet({ visible, onClose }) {
  const { call, refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true); setError('');
    try { const result = await call('/api/challenges'); if (requestId === generation.current) setData(result); }
    catch (e) { if (requestId === generation.current) { setError(e.message); setData(null); } } finally { if (requestId === generation.current) setLoading(false); }
  }, [call]);
  useEffect(() => { if (visible) { setConfirm(null); load(); } return () => { generation.current += 1; }; }, [visible, load]);
  const run = async (path, body) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { const result = await call(path, { method: 'POST', body }); setSuccess(result.message ?? 'Đã cập nhật.'); setConfirm(null); await Promise.all([load(), refreshUser()]); return true; }
    catch (e) { setError(e.message); return false; } finally { lock.current = false; setBusy(false); }
  };
  return <Sheet visible={visible} title="Thử thách" onClose={onClose}>
    {loading ? <Text>Đang tải…</Text> : null}
    {error ? <><Text tone="danger">{error}</Text><Button title="Thử lại" variant="glass" onPress={load} /></> : null}
    {success ? <Text tone="accent">{success}</Text> : null}
    {data && !loading ? <>{!data.challenges?.length ? <Text>Chưa có thử thách đang mở.</Text> : data.challenges.map(c => <Surface key={c.challenge_id} style={styles.card}>
      <Text variant="heading">{c.title}</Text><Text>{c.description}</Text><Text>{c.current_progress}/{c.target_days} ngày · Thưởng {c.reward_coins} xu</Text>
      {c.joined ? <><Button title={c.checked_in_today ? 'Đã check-in hôm nay' : 'Check-in hôm nay'} disabled={busy || c.checked_in_today} onPress={() => run(`/api/challenges/${c.challenge_id}/checkin`)} /><Button title="Rời thử thách" variant="glass" disabled={busy} onPress={() => setConfirm({ type: 'leave', item: c })} /></> : <Button title="Tham gia" disabled={busy} onPress={() => run(`/api/challenges/${c.challenge_id}/join`)} />}
      {confirm?.type === 'leave' && confirm.item.challenge_id === c.challenge_id ? <><Text>Rời thử thách sẽ xóa tiến độ lượt hiện tại. Tiếp tục?</Text><Button title="Xác nhận rời" loading={busy} onPress={() => run(`/api/challenges/${c.challenge_id}/leave`)} /><Button title="Giữ lượt tập" variant="glass" onPress={() => setConfirm(null)} /></> : null}
    </Surface>)}</> : null}
  </Sheet>;
}
