import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { REWARD_CATEGORIES, fmt, fmtDateTime, labelOf } from '../../lib/options.js';
import { Empty, Loadable, PageHeader, Pager, Segmented } from '../../components/ui.jsx';
import { actionLabel } from './labels.js';

const TABS = [{ value: 'purchases', label: 'Giao dịch đổi thưởng' }, { value: 'logs', label: 'Nhật ký quản trị' }];

export default function AdminTransactions() {
  const { api } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'logs' ? 'logs' : 'purchases';
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoad(
    () => (tab === 'logs' ? api.admin.logs(page) : api.admin.transactions(page)), [tab, page]);
  const switchTab = (value) => { setPage(1); setParams(value === 'logs' ? { tab: 'logs' } : {}); };
  const rows = data && (tab === 'logs' ? data.logs : data.transactions);

  return (
    <div className="page">
      <PageHeader title="Giao dịch & nhật ký" subtitle="Lịch sử đổi xu của thành viên và mọi thao tác của quản trị viên.">
        <Segmented options={TABS} value={tab} onChange={switchTab} />
      </PageHeader>
      <article className="card">
        <Loadable loading={loading} error={error} onRetry={reload}>
          {rows && (rows.length === 0 ? <Empty>Chưa có dữ liệu.</Empty> : (<>
            <div className="table-wrap">
              {tab === 'logs' ? (
                <table className="table">
                  <thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Thao tác</th><th>Đối tượng</th><th>Ghi chú</th></tr></thead>
                  <tbody>
                    {rows.map((log) => (
                      <tr key={log.log_id}>
                        <td>{fmtDateTime(log.created_at)}</td>
                        <td>{log.admin_name ?? '—'}</td>
                        <td>{actionLabel(log.action)}</td>
                        <td className="muted small mono">{log.target_type}:{log.target_id.slice(0, 8)}</td>
                        <td>{log.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="table">
                  <thead><tr><th>Thời gian</th><th>Thành viên</th><th>Vật phẩm</th><th>Loại</th><th>Xu</th></tr></thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.purchase_id}>
                        <td>{fmtDateTime(t.purchased_at)}</td>
                        <td><b>{t.full_name ?? '—'}</b><div className="muted small">{t.email}</div></td>
                        <td>{t.item_title ?? '—'}</td>
                        <td>{labelOf(REWARD_CATEGORIES, t.item_category)}</td>
                        <td>{fmt(t.spent_coins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Pager page={data.page} total={data.total} pageSize={data.page_size} onChange={setPage} />
          </>))}
        </Loadable>
      </article>
    </div>
  );
}
