import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad, useNotice } from '../../lib/useLoad.js';
import { ASSIGNMENT_STATUS, fmtDate, labelOf } from '../../lib/options.js';
import { ConfirmButton, Empty, Loadable, Notice, PageHeader, Segmented, StatusTag } from '../../components/ui.jsx';
import AssignForm from './AssignForm.jsx';

const FILTERS = [{ value: '', label: 'Tất cả' }, ...ASSIGNMENT_STATUS];

export default function TrainerAssignments() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const [status, setStatus] = useState('assigned');
  const list = useLoad(() => api.trainer.assignments(status || undefined), [status]);
  const setup = useLoad(() => Promise.all([api.trainer.links(), api.trainer.templates()]));
  const [links, templates] = setup.data ?? [];
  const students = links?.links.filter((l) => l.status === 'active').map((l) => l.student).filter(Boolean) ?? [];

  async function act(action, message) {
    const result = await run(action, message);
    if (result) await list.reload();
    return result;
  }

  return (
    <div className="page">
      <PageHeader title="Bài giao" subtitle="Theo dõi bài đã giao. Học viên tự đánh dấu hoàn thành trên tài khoản của họ." />
      <Notice notice={notice} />
      <div className="split">
        <section className="card">
          <div className="card-head"><h3>Giao bài</h3></div>
          <Loadable loading={setup.loading} error={setup.error} onRetry={setup.reload}>
            {setup.data && (students.length === 0
              ? <Empty>Chưa có học viên nào kết nối. Tạo mã mời ở mục Học viên.</Empty>
              : <AssignForm students={students} templates={templates.templates}
                  onAssign={(body) => act(() => api.trainer.assign(body), (r) => r.message)} />)}
          </Loadable>
        </section>
        <section className="card">
          <div className="card-head"><h3>Danh sách</h3><Segmented options={FILTERS} value={status} onChange={setStatus} /></div>
          <Loadable loading={list.loading} error={list.error} onRetry={list.reload}>
            {list.data && (list.data.assignments.length === 0 ? <Empty>Không có bài nào.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Học viên</th><th>Giáo án</th><th>Ngày giao</th><th>Trạng thái</th><th /></tr></thead>
                  <tbody>
                    {list.data.assignments.map((a) => (
                      <tr key={a.id}>
                        <td><Link to={`/trainer/students/${a.user_id}`}>{a.student?.full_name ?? '—'}</Link></td>
                        <td>{a.template?.title ?? '—'}{a.note && <div className="muted small">“{a.note}”</div>}</td>
                        <td>{fmtDate(a.assigned_at)}</td>
                        <td><StatusTag status={a.status}>{labelOf(ASSIGNMENT_STATUS, a.status)}</StatusTag></td>
                        <td className="cell-actions">
                          {a.status === 'assigned' && (
                            <ConfirmButton onConfirm={() => act(() => api.trainer.cancelAssignment(a.id), (r) => r.message)}>Hủy</ConfirmButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </Loadable>
        </section>
      </div>
    </div>
  );
}
