import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { fmt, fmtDateTime } from '../../lib/options.js';
import { Empty, Loadable, PageHeader } from '../../components/ui.jsx';
import { actionLabel } from './labels.js';

export default function AdminHome() {
  const { api } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api.admin.overview());
  const c = data?.counts;
  const tiles = c && [
    ['Thành viên', c.users, '/admin/accounts'],
    ['Huấn luyện viên', c.trainers, '/admin/accounts'],
    ['Tài khoản bị khóa', c.locked, '/admin/accounts'],
    ['Đăng ký mới (7 ngày)', c.new_users_7d, '/admin/accounts'],
    ['Lượt đổi thưởng (7 ngày)', c.purchases_7d, '/admin/transactions'],
    ['Xu đã tiêu (7 ngày)', fmt(c.coins_spent_7d), '/admin/transactions'],
    ['Thử thách đang mở', c.active_challenges, '/admin/challenges'],
    ['Vật phẩm đang bán', c.available_rewards, '/admin/rewards'],
  ];

  return (
    <div className="page">
      <PageHeader title="Quản trị hệ thống" subtitle="Quản lý tài khoản, nội dung thử thách và cửa hàng. Quản trị viên không xem được chat hay nhật ký sức khỏe." />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div className="tile-row">
            {tiles.map(([label, value, to]) => (
              <Link key={label} to={to} className="card summary tile-link"><span className="muted small">{label}</span><b>{value}</b></Link>
            ))}
          </div>
          <article className="card">
            <div className="card-head"><h3>Thao tác gần đây</h3><Link className="muted small" to="/admin/transactions?tab=logs">Xem nhật ký</Link></div>
            {data.recent_logs.length === 0 ? <Empty>Chưa có thao tác quản trị nào.</Empty> : (
              <ul className="row-list">
                {data.recent_logs.map((log) => (
                  <li key={log.log_id}>
                    <div>
                      <b>{actionLabel(log.action)}</b>
                      <span className="muted small">{log.admin_name ?? '—'}{log.note ? ` · ${log.note}` : ''}</span>
                    </div>
                    <span className="muted small">{fmtDateTime(log.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>)}
      </Loadable>
    </div>
  );
}
