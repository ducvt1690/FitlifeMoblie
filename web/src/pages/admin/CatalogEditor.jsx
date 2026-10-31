import { useState } from 'react';
import { useNotice } from '../../lib/useLoad.js';
import { Loadable, Notice, PageHeader } from '../../components/ui.jsx';
import Field from '../../components/Field.jsx';

// Khung chung cho hai danh mục admin quản lý (thử thách, vật phẩm): form tạo/sửa bên trái, bảng bên phải.
// `fields`: [{ key, label, type: 'text'|'number'|'textarea'|'select', options?, min?, max?, suffix? }]
export default function CatalogEditor({ title, subtitle, noun, idKey, toggleKey, toggleLabels, fields, empty, load, create, update, renderTable }) {
  const { notice, run } = useNotice();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const body = Object.fromEntries(fields.map((f) => [f.key, f.type === 'number' ? Number(form[f.key]) : String(form[f.key]).trim()]));
  const valid = fields.every((f) => (f.type === 'number'
    ? form[f.key] !== '' && Number.isInteger(body[f.key]) && body[f.key] >= (f.min ?? 0) && body[f.key] <= (f.max ?? 100000)
    : body[f.key] !== ''));

  function reset() { setEditing(null); setForm(empty); }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const result = await run(() => (editing ? update(editing, body) : create({ ...body, [toggleKey]: true })),
      editing ? `Đã cập nhật ${noun}.` : `Đã tạo ${noun}.`);
    setBusy(false);
    if (result) { reset(); await load.reload(); }
  }

  const edit = (item) => { setEditing(item[idKey]); setForm(Object.fromEntries(fields.map((f) => [f.key, String(item[f.key])]))); };
  const toggle = async (item) => {
    if (await run(() => update(item[idKey], { [toggleKey]: !item[toggleKey] }), item[toggleKey] ? toggleLabels[1] : toggleLabels[0])) await load.reload();
  };

  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />
      <Notice notice={notice} />
      <div className="split">
        <section className="card">
          <div className="card-head"><h3>{editing ? `Sửa ${noun}` : `Thêm ${noun}`}</h3></div>
          <form className="form" onSubmit={save}>
            {fields.map((f) => {
              if (f.type === 'textarea') {
                return (
                  <label key={f.key} className="field">
                    <span className="field-label">{f.label}</span>
                    <textarea className="textarea" rows="3" maxLength={f.max} value={form[f.key]} onChange={set(f.key)} />
                  </label>
                );
              }
              if (f.type === 'select') {
                return (
                  <label key={f.key} className="field">
                    <span className="field-label">{f.label}</span>
                    <select className="select" value={form[f.key]} onChange={set(f.key)}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                );
              }
              return <Field key={f.key} label={f.label} type={f.type} min={f.min} max={f.max} suffix={f.suffix}
                maxLength={f.type === 'text' ? f.max : undefined} value={form[f.key]} onChange={set(f.key)} />;
            })}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={!valid || busy}>{editing ? 'Lưu thay đổi' : `Tạo ${noun}`}</button>
              {editing && <button type="button" className="btn btn-ghost" onClick={reset}>Hủy sửa</button>}
            </div>
          </form>
        </section>
        <section className="card">
          <Loadable loading={load.loading} error={load.error} onRetry={load.reload}>
            {load.data && renderTable({ edit, toggle })}
          </Loadable>
        </section>
      </div>
    </div>
  );
}
