import { useEffect, useRef, useState } from 'react';
import { IoAdd, IoSend, IoSparkles } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { newId } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Loadable, PageHeader } from '../components/ui.jsx';

const SUGGESTIONS = ['Hôm nay mình uống đủ nước chưa?', 'Mình nên ăn bao nhiêu calo?', 'Gợi ý bài tập 15 phút', 'BMI của mình thế nào?'];

export default function Coach() {
  const { api } = useAuth();
  const sessions = useLoad(() => api.chatSessions());
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef(null);

  // Mặc định mở cuộc trò chuyện gần nhất.
  useEffect(() => {
    if (!active && sessions.data?.sessions.length) setActive(sessions.data.sessions[0].session_id);
  }, [sessions.data, active]);

  // Cuộc trò chuyện mới tạo ở client chưa có trên server nên không cần tải.
  const saved = sessions.data?.sessions.some((s) => s.session_id === active);
  useEffect(() => {
    if (!active || !saved) return;
    let cancelled = false;
    api.chatMessages(active)
      .then((res) => { if (!cancelled) setMessages(res.messages); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, api]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, sending]);

  async function send(content) {
    const body = content.trim();
    if (!body || sending) return;
    const sessionId = active ?? newId();
    if (!active) setActive(sessionId);
    setMessages((m) => [...m, { message_id: `pending-${Date.now()}`, sender: 'user', content: body }]);
    setText('');
    setSending(true);
    setError('');
    try {
      const res = await api.sendChat(sessionId, body);
      setMessages((m) => [...m.slice(0, -1), res.message, res.reply].filter(Boolean));
      sessions.reload();
    } catch (err) {
      setMessages((m) => m.slice(0, -1));
      setText(body);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function startNew() {
    setActive(newId());
    setMessages([]);
  }

  return (
    <div className="page">
      <PageHeader title="AI Coach" subtitle={sessions.data?.ai_enabled
        ? 'Trợ lý dùng mô hình AI kèm số liệu hôm nay của bạn.'
        : 'Trợ lý trả lời theo số liệu hôm nay của bạn (nước, calo, giấc ngủ, tập luyện, BMI).'}>
        <button className="btn btn-ghost" onClick={startNew}><IoAdd /> Cuộc trò chuyện mới</button>
      </PageHeader>

      <Loadable loading={sessions.loading} error={sessions.error} onRetry={sessions.reload}>
        <div className="chat">
          <aside className="card chat-sessions">
            <h3 className="sub-title">Lịch sử</h3>
            {sessions.data?.sessions.length ? sessions.data.sessions.map((s) => (
              <button key={s.session_id} className={`nav-item ${s.session_id === active ? 'active' : ''}`} onClick={() => setActive(s.session_id)}>
                <span className="ellipsis">{s.title}</span>
              </button>
            )) : <p className="muted small">Chưa có cuộc trò chuyện nào.</p>}
          </aside>

          <section className="card chat-main">
            <div className="chat-log">
              {!messages.length && (
                <div className="chat-empty">
                  <span className="badge-icon lg"><IoSparkles /></span>
                  <p className="muted">Hỏi bất cứ điều gì về sức khỏe. Tin nhắn đầu tiên mỗi ngày được +10 xu.</p>
                  <div className="pill-group">
                    {SUGGESTIONS.map((s) => <button key={s} className="pill" onClick={() => send(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.message_id} className={`bubble ${m.sender === 'ai' ? 'from-ai' : 'from-me'}`}>{m.content}</div>
              ))}
              {sending && <div className="bubble from-ai typing">Đang trả lời…</div>}
              <div ref={bottom} />
            </div>
            {error && <p className="alert alert-error">{error}</p>}
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <textarea rows="1" value={text} maxLength={4000} placeholder="Nhập câu hỏi…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              <button className="btn btn-primary" disabled={!text.trim() || sending} aria-label="Gửi"><IoSend /></button>
            </form>
          </section>
        </div>
      </Loadable>
    </div>
  );
}
