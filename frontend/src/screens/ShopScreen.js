import React from 'react';
import { Text } from 'react-native';
import { Page, Card, Action } from '../components/ServerCards';
import { useRemote } from '../components/RemoteState';
import { getShop, buyItem } from '../utils/storage';
export default function ShopScreen() {
  const state = useRemote(getShop);
  const buy = item => state.run(async () => {
    await buyItem(item.item_id);
    state.setData(await getShop());
  });
  return <Page title="Cửa hàng đổi xu" subtitle={state.data ? state.data.fit_coins + ' FitCoins' : 'Đang lấy số dư'} state={state}>
 {state.data?.items.length === 0 && <Text>Chưa có vật phẩm đang mở.</Text>}
 {state.data?.items.map(item => <Card key={item.item_id} title={item.title}><Text>{item.cost_coins} xu · {item.category}</Text><Action title={item.owned ? 'Đã sở hữu' : 'Đổi ' + item.cost_coins + ' xu'} disabled={state.busy || item.owned || state.data.fit_coins < item.cost_coins} onPress={() => buy(item)} /></Card>)}
 <Text>Vật phẩm đã mua được lưu theo tài khoản. Trang bị giao diện và sử dụng voucher chưa được hỗ trợ.</Text>
 </Page>;
}
