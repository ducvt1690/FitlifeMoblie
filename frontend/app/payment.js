import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/ui/Screen';
import Surface from '../src/ui/Surface';
import Text from '../src/ui/Text';
import Button from '../src/ui/Button';
import { useAuth } from '../src/context/AuthContext';

// Query-string status is informational only; the authenticated API is authoritative.
export default function PaymentResult() {
  const { order } = useLocalSearchParams();
  const router = useRouter(), { api, refreshUser } = useAuth();
  const [result, setResult] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);setError('');
    try { if(typeof order!=='string') throw new Error('Không có mã đơn thanh toán.'); const r=await api.payments.order(order);setResult(r);await refreshUser(); }
    catch(e){setError(e.message);}finally{setLoading(false);}
  },[api,order,refreshUser]);
  useEffect(()=>{load();},[load]);
  return <Screen><Text variant="title">Kết quả thanh toán</Text><Surface style={{padding:24,gap:16}}>
    {loading?<Text>Đang kiểm tra giao dịch…</Text>:error?<Text tone="danger">{error}</Text>:<>
      <Text variant="heading">{result?.order.status==='paid'?'Thanh toán thành công':result?.order.status==='failed'?'Thanh toán chưa thành công':'Đang chờ xác nhận thanh toán'}</Text>
      {result?.order.simulated && <Text>Giao dịch giả lập, không thu tiền thật.</Text>}
      <Text selectable>Mã đơn: {result?.order.order_id}</Text><Text>{result?.order.amount_vnd?.toLocaleString('vi-VN')} ₫</Text>
      <Text>{result?.order.status==='paid'?'Quyền lợi đã được cập nhật vào tài khoản.':'Bạn có thể kiểm tra lại trạng thái trong lịch sử thanh toán.'}</Text>
    </>}
    <Button title="Kiểm tra lại" loading={loading} onPress={load}/><Button title="Về hồ sơ" variant="glass" onPress={()=>router.replace('/home/me')}/>
  </Surface></Screen>;
}
