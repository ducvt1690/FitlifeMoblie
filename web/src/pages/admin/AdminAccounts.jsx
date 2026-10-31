import { useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad, useNotice } from '../../lib/useLoad.js';
import { ROLES, fmt, fmtDate, labelOf } from '../../lib/options.js';
import { ConfirmButton, Empty, Loadable, Notice, PageHeader, Pager, Segmented, StatusTag } from '../../components/ui.jsx';

const ROLE_FILTERS = [{ value: '', label: 'Mọi vai trò' }, ...ROLES];
const STATUS_FILTERS = [{ value: '', label: 'Tất cả' }, { value: 'active', label: 'Hoạt động' }, { value: 'locked', label: 'Đã khóa' }];

export default function AdminAccounts() {
  const { api, user } = useAuth();
  const { notice, run } = useNotice();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: '', page: 1 });
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
  const { data, error, loading, reload } = useLoad(() => api.admin.accounts(params), [JSON.stringify(params)]);
  const [busy, setBusy] = useState('');
  const change = (key) => (value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  async function update(account, changes, message) {
    setBusy(account.user_id);
    if (await run(() => api.admin.updateAccount(account.user_id, changes), message)) await reload();
    setBusy('');
  }

  return (
    <div className="page">
      <PageHeader title="Tài khoản" subtitle="Khóa/mở khóa và cấp quyền huấn luyện viên. Mỗi thao tác được ghi vào nhật ký quản trị." />
      <Notice notice={notice} />
      <div className="filter-bar">
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); change('q')(search.trim()); }}>
          <IoSearch />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo email hoặc tên" maxLength={100} />
          <button className="btn btn-dark btn-sm">Tìm</button>
        </form>
        <Segmented options={ROLE_FILTERS} value={filters.role} onChange={change('role')} />
        <Segmented options={STATUS_FILTERS} value={filters.status} onChange={change('status')} />
      </div>
      <article className="card">
        <Loadable loading={loading} error={error} onRetry={reload}>
          {data && (data.accounts.length === 0 ? <Empty>Không có tài khoản phù hợp.</Empty> : (<>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Xu</th><th>Ngày tạo</th><th /></tr></thead>
                <tbody>
                  {data.accounts.map((a) => {
                    const editable = a.role !== 'admin' && a.user_id !== user.user_id;
                    const disabled = busy === a.user_id;
                    return (
                      <tr key={a.user_id}>
                        <td><b>{a.full_name}</b><div className="muted small">{a.email}</div></td>
                        <td>{labelOf(ROLES, a.role)}</td>
                        <td>{a.is_active ? <StatusTag status="done">Hoạt động</StatusTag> : <StatusTag status="locked">Đã khóa</StatusTag>}</td>
                        <td>{a.role === 'user' ? fmt(a.fit_coins) : '—'}</td>
                        <td>{fmtDate(a.created_at)}</td>
                        <td className="cell-actions">
                          {editable && (<>
                            {a.role === 'user'
                              ? <ConfirmButton disabled={disabled} onConfirm={() => update(a, { role: 'trainer' }, `Đã cấp quyền huấn luyện viên cho ${a.full_name}.`)}>Cấp HLV</ConfirmButton>
                              : <ConfirmButton disabled={disabled} onConfirm={() => update(a, { role: 'user' }, `${a.full_name} đã trở về thành viên.`)}>Thu hồi HLV</ConfirmButton>}
                            {a.is_active
                              ? <ConfirmButton className="btn btn-danger-ghost btn-sm" disabled={disabled} onConfirm={() => update(a, { is_active: false }, `Đã khóa ${a.email}.`)}>Khóa</ConfirmButton>
                              : <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => update(a, { is_active: true }, `Đã mở khóa ${a.email}.`)}>Mở khóa</button>}
                          </>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} total={data.total} pageSize={data.page_size} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>))}
        </Loadable>
      </article>
    </div>
  );
}
