import React, { useState, useRef, useEffect } from 'react';
import { Text, View } from 'react-native';
import { Page, Card, Action, Input } from '../components/ServerCards';
import { useRemote, RemoteState } from '../components/RemoteState';
import { getChatSessions, getChatMessages, sendChat, newId } from '../utils/storage';
export default function AiCoachScreen() {
  const state = useRemote(getChatSessions),
    [active, setActive] = useState(null),
    [messages, setMessages] = useState([]),
    [content, setContent] = useState('');
  const pending = useRef(null),
    [messageError, setMessageError] = useState('');
  useEffect(() => {
    if (!active && state.data?.sessions.length) setActive(state.data.sessions[0].session_id);
  }, [state.data, active]);
  useEffect(() => {
    let cancelled = false;
    if (active && state.data?.sessions.some(s => s.session_id === active)) getChatMessages(active).then(d => {
      if (!cancelled) setMessages(d.messages);
    }).catch(e => {
      if (!cancelled) setMessageError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [active, state.data]);
  const send = () => state.run(async () => {
    const text = content.trim();
    if (!text) return;
    const sessionId = active || newId();
    if (!active) setActive(sessionId);
    if (!pending.current || pending.current.content !== text || pending.current.sessionId !== sessionId) pending.current = {
      sessionId,
      content: text,
      messageId: newId()
    };
    const data = await sendChat(sessionId, text, pending.current.messageId);
    pending.current = null;
    setContent('');
    setMessageError('');
    setMessages(m => [...m.filter(x => x.message_id !== data.message.message_id && x.message_id !== data.reply.message_id), data.message, data.reply]);
    state.setData(await getChatSessions());
  });
  return <Page title="AI Coach" subtitle={state.data?.ai_enabled ? 'Trợ lý AI dựa trên nhật ký của bạn' : 'Trợ lý theo quy tắc từ nhật ký sức khỏe đã lưu'} state={state}>
 <Action title="Cuộc trò chuyện mới" disabled={state.busy} onPress={() => {
      setActive(newId());
      setMessages([]);
      setMessageError('');
      pending.current = null;
    }} />
 {state.data?.sessions.map(s => <Action key={s.session_id} title={s.title} disabled={state.busy} onPress={() => {
      setMessages([]);
      setActive(s.session_id);
    }} />)}
 <RemoteState error={messageError} onRetry={() => getChatMessages(active).then(d => {
      setMessages(d.messages);
      setMessageError('');
    }).catch(e => setMessageError(e.message))} />
 {messages.length === 0 && <Text>Chưa có tin nhắn trong cuộc trò chuyện này.</Text>}
 {messages.map(m => <Card key={m.message_id} title={m.sender === 'ai' ? 'FitLife Coach' : 'Bạn'}><Text selectable>{m.content}</Text></Card>)}
 <Input label="Câu hỏi" value={content} onChangeText={setContent} multiline maxLength={4000} /><Action title={state.busy ? 'Đang gửi…' : 'Gửi câu hỏi'} disabled={state.busy || !content.trim()} onPress={send} />
 </Page>;
}
