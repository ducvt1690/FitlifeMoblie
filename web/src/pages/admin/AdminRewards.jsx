import { useAuth } from '../../lib/auth.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { REWARD_CATEGORIES, fmt, labelOf } from '../../lib/options.js';
import { Empty } from '../../components/ui.jsx';
import CatalogEditor from './CatalogEditor.jsx';

const FIELDS = [
  { key: 'title', label: 'Tên vật phẩm', type: 'text', max: 100 },
  { key: 'category', label: 'Loại', type: 'select', options: REWARD_CATEGORIES },
  { key: 'cost_coins', label: 'Giá', type: 'number', min: 0, max: 100000, suffix: 'xu' },
  { key: 'icon', label: 'Biểu tượng', type: 'text', max: 100 },
];
const EMPTY = { title: '', category: 'badge', cost_coins: '100', icon: 'ribbon' };

export default function AdminRewards() {
  const { api } = useAuth();
  const load = useLoad(() => api.admin.rewards());

  return (
    <CatalogEditor title="Cửa hàng đổi thưởng" noun="vật phẩm" idKey="item_id" toggleKey="is_available"
      subtitle="Ngừng bán sẽ ẩn vật phẩm khỏi cửa hàng; người đã mua vẫn giữ."
      toggleLabels={['Đã mở bán lại.', 'Đã ngừng bán.']} fields={FIELDS} empty={EMPTY} load={load}
      create={api.admin.createReward} update={api.admin.updateReward}
      renderTable={({ edit, toggle }) => (load.data.items.length === 0 ? <Empty>Chưa có vật phẩm nào.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Vật phẩm</th><th>Loại</th><th>Giá</th><th>Đã bán</th><th>Xu thu về</th><th /></tr></thead>
            <tbody>
              {load.data.items.map((item) => (
                <tr key={item.item_id} className={item.is_available ? '' : 'is-off'}>
                  <td><b>{item.title}</b>{!item.is_available && <> <span className="tag muted-tag">Ngừng bán</span></>}</td>
                  <td>{labelOf(REWARD_CATEGORIES, item.category)}</td>
                  <td>{fmt(item.cost_coins)} xu</td>
                  <td>{item.sold}</td>
                  <td>{fmt(item.coins)}</td>
                  <td className="cell-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => edit(item)}>Sửa</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(item)}>{item.is_available ? 'Ngừng bán' : 'Mở bán'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))} />
  );
}
