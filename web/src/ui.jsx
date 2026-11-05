import { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiRefreshCw, FiX, FiSearch } from 'react-icons/fi';
import { useAuth, useNotify } from './context';
export const date = v => v ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—';
export const number = v => v == null ? '—' : new Intl.NumberFormat('vi-VN').format(v);
export const money = v => v == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
export function useResource(path) {
  const { call } = useAuth();
  const [state, set] = useState({ data: null, loading: true, error: null });
  const [version, reload] = useState(0);
  const refresh = useCallback(() => reload(v => v + 1), []);
  useEffect(() => {
    if (!path) { set({ data: null, loading: false, error: null }); return; }
    const abort = new AbortController();
    set(s => ({ ...s, loading: true, error: null }));
    call(path, { signal: abort.signal }).then(data => set({ data, loading: false, error: null }))
      .catch(error => { if (error.name !== 'AbortError') set({ data: null, loading: false, error }); });
    return () => abort.abort();
  }, [path, call, version]);
  return { ...state, refresh };
}
export function useAction(onSuccess) {
  const { call } = useAuth(); const notify = useNotify(); const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = async (path, options, message = 'Đã lưu thay đổi.') => {
    if (locked.current) return null;
    locked.current = true; setBusy(true);
    try { const result = await call(path, options); notify(typeof result?.message === 'string' ? result.message : message); onSuccess?.(result); return result ?? { success: true }; }
    catch (error) { notify(error.message, 'error'); return null; }
    finally { locked.current = false; setBusy(false); }
  };
  return { run, busy };
}
export function PageHead({ title, description, action }) {
  return <header className="page-head"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
export function Button({ children, icon: Icon, secondary, danger, busy, ...props }) {
  return <button className={`button ${secondary ? 'secondary' : ''} ${danger ? 'danger' : ''}`} {...props} disabled={props.disabled || busy}>{Icon && <Icon aria-hidden="true" />}{busy ? 'Đang xử lý…' : children}</button>;
}
export function Field({ label, children, hint, ...props }) {
  return <label className="field"><span>{label}</span>{children || <input {...props} />}{hint && <small>{hint}</small>}</label>;
}
export function Select({ label, options, empty, ...props }) {
  return <Field label={label}><select {...props}>{empty !== undefined && <option value="">{empty}</option>}{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>;
}
export function State({ resource, empty, children }) {
  if (resource.loading) return <div className="skeleton" role="status" aria-label="Đang tải dữ liệu"><span /><span /><span /></div>;
  if (resource.error) return <div className="empty error" role="alert"><h2>Chưa tải được dữ liệu</h2><p>{resource.error.message}</p><Button secondary icon={FiRefreshCw} onClick={resource.refresh}>Thử lại</Button></div>;
  if (empty) return <div className="empty"><h2>Chưa có dữ liệu</h2><p>Kết quả sẽ xuất hiện tại đây khi có dữ liệu phù hợp.</p></div>;
  return children;
}
export function Badge({ value, children }) { return <span className={`badge ${value === true || ['done', 'active', 'paid', 'pending'].includes(value) ? 'positive' : ['cancelled', 'failed', 'ended', 'expired', false].includes(value) ? 'negative' : ''}`}>{children ?? String(value ?? '—')}</span>; }
export function Pager({ data, page, setPage }) {
  if (!data || data.total == null) return null;
  const pages = Math.max(1, Math.ceil(data.total / (data.page_size || 20)));
  return <nav className="pager" aria-label="Phân trang"><span>{number(data.total)} bản ghi</span><div><button aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)}><FiArrowLeft /></button><span>Trang {page} / {pages}</span><button aria-label="Trang sau" disabled={page >= pages} onClick={() => setPage(page + 1)}><FiArrowRight /></button></div></nav>;
}
export function Search({ value, onChange, placeholder = 'Tìm kiếm…' }) {
  return <label className="search"><FiSearch aria-hidden="true" /><input aria-label="Tìm kiếm" maxLength={100} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
export function Table({ columns, rows, rowKey }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c.label} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={rowKey ? r[rowKey] : r.id || i}>{columns.map(c => <td key={c.label}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
export function Modal({ title, children, onClose, wide }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const handle = e => { e.preventDefault(); closeRef.current(); };
    dialog.addEventListener('cancel', handle);
    return () => { dialog.removeEventListener('cancel', handle); dialog.close(); previous?.focus?.(); };
  }, []);
  return <dialog className={wide ? 'wide' : ''} ref={ref} aria-labelledby="dialog-title"><header><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Đóng" onClick={onClose}><FiX /></button></header>{children}</dialog>;
}
export function Record({ value }) {
  return <dl className="record">{Object.entries(value || {}).filter(([k]) => k !== '_id').map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{v && typeof v === 'object' ? <pre>{JSON.stringify(v, null, 2)}</pre> : String(v ?? '—')}</dd></div>)}</dl>;
}
export function Metric({ label, value, unit }) { return <div className="metric"><span>{label}</span><strong>{value ?? '—'}{unit && <small>{unit}</small>}</strong></div>; }
