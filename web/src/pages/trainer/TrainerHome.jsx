import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { fmtDate } from '../../lib/options.js';
import { Empty, Loadable, PageHeader } from '../../components/ui.jsx';

export default function TrainerHome() {
  const { api, user } = useAuth();
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.trainer.overview(), api.trainer.assignments('assigned')]));
  const [overview, open] = data ?? [];
  const tiles = overview && [
    ['Học viên', overview.counts.students, '/trainer/students'],
    ['Mã mời chưa dùng', overview.counts.pending_invites, '/trainer/students'],
    ['Giáo án đang dùng', overview.counts.templates, '/trainer/templates'],
    ['Bài đang giao', overview.counts.open_assignments, '/trainer/assignments'],
    ['Bài đã hoàn thành', overview.counts.done_assignments, '/trainer/assignments'],
  ];

  return (
    <div className="page">
      <PageHeader title={`Xin chào, ${user.name}`} subtitle="Tổng quan học viên và bài tập bạn đang giao.">
        <Link className="btn btn-primary" to="/trainer/students">Mời học viên</Link>
      </PageHeader>
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div className="tile-row">
            {tiles.map(([label, value, to]) => (
              <Link key={label} to={to} className="card summary tile-link"><span className="muted small">{label}</span><b>{value}</b></Link>
            ))}
          </div>
          <article className="card">
            <div className="card-head"><h3>Bài đang chờ học viên</h3><Link className="muted small" to="/trainer/assignments">Xem tất cả</Link></div>
            {open.assignments.length === 0 ? <Empty>Chưa có bài nào đang giao.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Học viên</th><th>Giáo án</th><th>Ngày giao</th></tr></thead>
                  <tbody>
                    {open.assignments.slice(0, 8).map((a) => (
                      <tr key={a.id}>
                        <td><Link to={`/trainer/students/${a.user_id}`}>{a.student?.full_name ?? '—'}</Link></td>
                        <td>{a.template?.title ?? '—'}</td>
                        <td>{fmtDate(a.assigned_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>)}
      </Loadable>
    </div>
  );
}
