import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import Text from './Text';
import TextField from './TextField';
import Button from './Button';
import Segmented from './Segmented';

export const ASSIGNMENT_LABELS = { assigned: 'Đang chờ hoàn thành', done: 'Đã hoàn thành', cancelled: 'Đã hủy' };
export const INVITE_LABELS = { pending: 'Chờ sử dụng', active: 'Đã chấp nhận', ended: 'Đã kết thúc', revoked: 'Đã thu hồi', expired: 'Hết hạn' };
export const LEVELS = [{ value: 'beginner', label: 'Cơ bản' }, { value: 'intermediate', label: 'Trung cấp' }, { value: 'advanced', label: 'Nâng cao' }];
export const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
export const money = value => `${Number(value ?? 0).toLocaleString('vi-VN')} ₫`;
export const queryString = values => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v != null)).toString();
export const managementStyles = StyleSheet.create({ stack: { gap: 14, paddingTop: 16 }, card: { padding: 16, gap: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' } });

// Share the existing Context/fetch approach, stale-response protection and loading states.
export function usePagedResource(path, filters = {}, enabled = true) {
  const { call } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('');
  const generation = useRef(0);
  const extra = queryString(filters);
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true); setError('');
    try {
      const result = await call(`${path}?${queryString({ page, page_size: 20, q: query, status, sort })}${extra ? `&${extra}` : ''}`);
      if (requestId === generation.current) {
        setData(result);
        const lastPage = Math.max(1, Math.ceil((result.total ?? 0) / (result.page_size ?? 20)));
        if (page > lastPage) setPage(lastPage);
      }
      return result;
    } catch (e) {
      if (requestId === generation.current) { setError(e.message); setData(null); }
      return null;
    } finally { if (requestId === generation.current) setLoading(false); }
  }, [call, path, page, query, status, sort, extra]);
  useFocusEffect(useCallback(() => { if (enabled) load(); return () => { generation.current += 1; }; }, [load, enabled]));
  return { data, loading, error, load, page, setPage, query, setQuery, status, setStatus, sort, setSort };
}

export function SearchControls({ resource, statuses, sorts }) {
  const [draft, setDraft] = useState(resource.query);
  const search = () => { resource.setPage(1); resource.setQuery(draft.trim()); };
  return <>
    <TextField label="Tìm kiếm" value={draft} onChangeText={setDraft} maxLength={100} returnKeyType="search" onSubmitEditing={search} />
    <Button title="Tìm kiếm" onPress={search} disabled={resource.loading} variant="glass" />
    {statuses ? <Segmented options={[{ value: '', label: 'Tất cả' }, ...statuses]} value={resource.status} onChange={v => { resource.setPage(1); resource.setStatus(v); }} /> : null}
    {sorts ? <Segmented options={sorts} value={resource.sort} onChange={v => { resource.setPage(1); resource.setSort(v); }} /> : null}
  </>;
}

export function ResourceState({ resource, count }) {
  return <>
    {resource.error ? <Text tone="danger" accessibilityLiveRegion="polite">{resource.error}</Text> : null}
    {resource.loading ? <Text tone="dim">Đang tải…</Text> : resource.data ? <Text tone="dim">{resource.data.total ?? count ?? 0} kết quả</Text> : null}
    {!resource.loading && resource.data && count === 0 ? <Text>Không có dữ liệu phù hợp.</Text> : null}
    {resource.error ? <Button title="Thử lại" variant="glass" onPress={resource.load} /> : null}
  </>;
}

export function Pager({ resource }) {
  const pages = Math.max(1, Math.ceil((resource.data?.total ?? 0) / (resource.data?.page_size ?? 20)));
  return <View style={managementStyles.row}>
    <Button title="Trang trước" variant="glass" disabled={resource.loading || resource.page <= 1} onPress={() => resource.setPage(p => p - 1)} />
    <Text>Trang {resource.page}/{pages}</Text>
    <Button title="Trang sau" variant="glass" disabled={resource.loading || resource.page >= pages} onPress={() => resource.setPage(p => p + 1)} />
  </View>;
}
