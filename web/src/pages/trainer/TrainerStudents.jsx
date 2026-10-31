import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IoCopyOutline } from 'react-icons/io5';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad, useNotice } from '../../lib/useLoad.js';
import { fmtDate } from '../../lib/options.js';
import { ConfirmButton, Empty, Loadable, Notice, PageHeader } from '../../components/ui.jsx';

export default function TrainerStudents() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.trainer.links());
  const [busy, setBusy] = useState(false);

  async function act(action, message) {
    setBusy(true);
    if (await run(action, message)) await reload();
    setBusy(false);
  }

  const pending = data?.links.filter((l) => l.status === 'pending') ?? [];
  const active = data?.links.filter((l) => l.status === 'active') ?? [];
  const copy = (code) => run(async () => { await navigator.clipboard.writeText(code); return true; }, `Đã chép mã ${code}.`);

  return (
    <div className="page">
      <PageHeader title="Học viên" subtitle="Gửi mã mời cho học viên; họ nhập mã ở mục “Huấn luyện viên” để đồng ý kết nối.">
        <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.trainer.createInvite(), 'Đã tạo mã mời mới.')}>Tạo mã mời</button>
      </PageHeader>
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="split">
            <section className="card">
              <div className="card-head"><h3>Mã mời chưa dùng</h3><span className="muted small">{pending.length}/10</span></div>
              {pending.length === 0 ? <Empty>Chưa có mã nào. Bấm “Tạo mã mời”.</Empty> : (
                <ul className="row-list">
                  {pending.map((l) => (
                    <li key={l.link_id}>
                      <div>
                        <button type="button" className="invite-code" title="Chép mã" onClick={() => copy(l.invite_code)}>
                          {l.invite_code} <IoCopyOutline />
                        </button>
                        <span className="muted small">Tạo {fmtDate(l.created_at)}</span>
                      </div>
                      <ConfirmButton disabled={busy} onConfirm={() => act(() => api.trainer.endLink(l.link_id), (r) => r.message)}>Hủy</ConfirmButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card">
              <div className="card-head"><h3>Đang kết nối</h3><span className="muted small">{active.length} học viên</span></div>
              {active.length === 0 ? <Empty>Chưa có học viên nào chấp nhận lời mời.</Empty> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Học viên</th><th>Kết nối từ</th><th>Bài đang giao</th><th /></tr></thead>
                    <tbody>
                      {active.map((l) => (
                        <tr key={l.link_id}>
                          <td>
                            <Link to={`/trainer/students/${l.user_id}`}><b>{l.student?.full_name ?? '—'}</b></Link>
                            <div className="muted small">{l.student?.email}</div>
                          </td>
                          <td>{fmtDate(l.accepted_at)}</td>
                          <td>{l.open_assignments}</td>
                          <td className="cell-actions">
                            <Link className="btn btn-ghost btn-sm" to={`/trainer/students/${l.user_id}`}>Chi tiết</Link>
                            <ConfirmButton disabled={busy} onConfirm={() => act(() => api.trainer.endLink(l.link_id), (r) => r.message)}>Kết thúc</ConfirmButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </Loadable>
    </div>
  );
}
