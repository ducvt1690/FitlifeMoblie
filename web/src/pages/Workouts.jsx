import { useEffect, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { Empty, Loadable, PageHeader } from '../components/ui.jsx';

const PAGE_SIZE = 12;

export default function Workouts() {
  const { api } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  async function load(after) {
    setLoading(true);
    try {
      const res = await api.exercises({ q: query, limit: PAGE_SIZE, after });
      setRows((prev) => (after ? [...prev, ...res.data] : res.data));
      setNext(res.meta.nextAfter);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [query]);

  return (
    <div className="page">
      <PageHeader title="Thư viện bài tập" subtitle="Tìm theo tên, nhóm cơ hoặc dụng cụ. Bấm vào bài để xem hướng dẫn." />
      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
        <IoSearch />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ví dụ: squat, ngực, dumbbell…" />
        <button className="btn btn-dark btn-sm">Tìm</button>
      </form>

      <Loadable loading={loading && !rows.length} error={error} onRetry={() => load()}>
        {rows.length ? (
          <div className="card-grid">
            {rows.map((ex) => (
              <article key={ex.exercise_id ?? ex.source_exercise_id} className="card exercise"
                onClick={() => setOpen(open === ex.source_exercise_id ? null : ex.source_exercise_id)}>
                {ex.gif_url && <img src={ex.gif_url} alt={ex.display_name} loading="lazy" />}
                <h3>{ex.display_name}</h3>
                <div className="tag-row">
                  {[...ex.display_body_parts, ...ex.display_equipments].slice(0, 3).map((t) => <span key={t} className="tag muted-tag">{t}</span>)}
                </div>
                <p className="muted small">Cơ chính: {ex.display_target_muscles.join(', ')}</p>
                {open === ex.source_exercise_id && (
                  <ol className="steps">{ex.display_instructions.map((step, i) => <li key={i}>{step.replace(/^Step:\d+\s*/, '')}</li>)}</ol>
                )}
              </article>
            ))}
          </div>
        ) : <div className="card"><Empty>Không tìm thấy bài tập phù hợp.</Empty></div>}
        {next && (
          <button className="btn btn-ghost load-more" disabled={loading} onClick={() => load(next)}>
            {loading ? 'Đang tải…' : 'Xem thêm'}
          </button>
        )}
      </Loadable>
    </div>
  );
}
