import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../ui/Text';
import { colors, fonts, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useAuth } from '../../context/AuthContext';
import { newId } from '../../api/client';

const STARTERS = ['Hôm nay mình nên ăn gì thêm?', 'Tối nay ngủ sao cho sâu?', 'Gợi ý bài tập 15 phút ở nhà'];

// One running conversation per visit; the server keeps the history and the free-tier limit.
export default function CoachScreen() {
  const { api } = useAuth();
  const { insets, gutter, contentWidth } = useLayout();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef(null);

  useEffect(() => {
    api.chat.sessions().then(async ({ sessions }) => {
      if (!sessions.length) { setSessionId(newId()); return; }
      setSessionId(sessions[0].session_id);
      setMessages((await api.chat.messages(sessions[0].session_id)).messages);
    }).catch((e) => { setSessionId(newId()); setError(e.message); });
  }, [api]);

  const send = useCallback(async (content) => {
    const body = content.trim();
    if (!body || sending || !sessionId) return;
    const mine = { message_id: newId(), sender: 'user', content: body };
    setMessages(m => [...m, mine]); setText(''); setSending(true); setError('');
    try {
      const res = await api.chat.send({ session_id: sessionId, message_id: mine.message_id, content: body });
      if (res.reply) setMessages(m => [...m, res.reply]);
    } catch (e) {
      setMessages(m => m.filter(x => x.message_id !== mine.message_id));
      setText(body);
      setError(e.message);
    } finally { setSending(false); }
  }, [api, sending, sessionId]);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: gutter, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', gap: 10 }}>
          <Text variant="title">AI Coach</Text>
          <Text tone="dim">Hỏi về ăn uống, tập luyện hay giấc ngủ. Coach đọc số liệu hôm nay của bạn.</Text>
          {!messages.length ? STARTERS.map(s => (
            <Pressable key={s} onPress={() => send(s)} style={styles.starter} accessibilityRole="button">
              <Text variant="label" tone="dim">{s}</Text>
            </Pressable>
          )) : null}
          {messages.map(m => (
            <View key={m.message_id} style={[styles.bubble, m.sender === 'user' ? styles.mine : styles.theirs]}>
              <Text color={m.sender === 'user' ? colors.ink : colors.text}>{m.content}</Text>
            </View>
          ))}
          {sending ? <Text variant="caption" tone="faint">Coach đang trả lời…</Text> : null}
          {error ? <Text variant="label" tone="danger">{error}</Text> : null}
        </View>
      </ScrollView>
      <View style={[styles.inputBar, { marginHorizontal: gutter, marginBottom: 96 + insets.bottom, maxWidth: contentWidth }]}>
        <TextInput value={text} onChangeText={setText} placeholder="Nhắn cho Coach…" placeholderTextColor={colors.textFaint}
          style={styles.input} multiline selectionColor={colors.accent} />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || sending} accessibilityLabel="Gửi"
          style={[styles.send, (!text.trim() || sending) && styles.sendOff]}>
          <Ionicons name="arrow-up" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  starter: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.strokeSoft },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.text, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 6 },
  inputBar: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 16, paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 12, borderRadius: 23, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke, outlineStyle: 'none' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
});
