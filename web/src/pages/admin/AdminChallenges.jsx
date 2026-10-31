import { useAuth } from '../../lib/auth.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { fmt } from '../../lib/options.js';
import { Empty } from '../../components/ui.jsx';
import CatalogEditor from './CatalogEditor.jsx';

const FIELDS = [
  { key: 'title', label: 'Tên thử thách', type: 'text', max: 150 },
  { key: 'description', label: 'Mô tả', type: 'textarea', max: 2000 },
  { key: 'target_days', label: 'Số ngày', type: 'number', min: 1, max: 365, suffix: 'ngày' },
  { key: 'reward_coins', label: 'Thưởng', type: 'number', min: 0, max: 100000, suffix: 'xu' },
  { key: 'badge_icon', label: 'Biểu tượng huy hiệu', type: 'text', max: 100 },
];
const EMPTY = { title: '', description: '', target_days: '7', reward_coins: '70', badge_icon: 'trophy' };

export default function AdminChallenges() {
  const { api } = useAuth();
  const load = useLoad(() => api.admin.challenges());

  return (
    <CatalogEditor title="Thử thách" noun="thử thách" idKey="challenge_id" toggleKey="is_active"
      subtitle="Thử thách đang mở hiện cho mọi thành viên. Tạm dừng sẽ ẩn với người chưa tham gia."
      toggleLabels={['Đã mở lại thử thách.', 'Đã tạm dừng thử thách.']} fields={FIELDS} empty={EMPTY} load={load}
      create={api.admin.createChallenge} update={api.admin.updateChallenge}
      renderTable={({ edit, toggle }) => (load.data.challenges.length === 0 ? <Empty>Chưa có thử thách nào.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Thử thách</th><th>Ngày</th><th>Thưởng</th><th>Đang tham gia</th><th>Hoàn thành</th><th /></tr></thead>
            <tbody>
              {load.data.challenges.map((c) => (
                <tr key={c.challenge_id} className={c.is_active ? '' : 'is-off'}>
                  <td><b>{c.title}</b>{!c.is_active && <> <span className="tag muted-tag">Tạm dừng</span></>}<div className="muted small clamp-2">{c.description}</div></td>
                  <td>{c.target_days}</td>
                  <td>{fmt(c.reward_coins)} xu</td>
                  <td>{c.joined}</td>
                  <td>{c.completed}</td>
                  <td className="cell-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => edit(c)}>Sửa</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.is_active ? 'Tạm dừng' : 'Mở lại'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))} />
  );
}
