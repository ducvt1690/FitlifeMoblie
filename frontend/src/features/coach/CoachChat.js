import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Text from '../../ui/Text';
import { colors, fonts, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useAuth } from '../../context/AuthContext';
import { newId } from '../../api/client';
import { useKeyboardHeight } from '../../ui/useKeyboard';

// Buttons under a reply, from the actions the server ran (ai_engine "agent:plan,meal" or the older "workout-plan").
const LINKS = [
  { match: /plan/, label: 'Mở lịch tập', icon: 'barbell', href: '/home/workout' },
  { match: /meal/, label: 'Mở Ăn uống', icon: 'restaurant', href: '/home/nutrition' },
];

// One conversation shared by the Coach tab and the "Hỏi AI" sheets, so the coach keeps the same memory everywhere.
// `bottom` is the space kept under the input while the keyboard is hidden (the tab bar, or the home indicator).
export default function CoachChat({ context = 'general', starters = [], header = null, bottom = 0, onAction, onLink }) {
  const { api } = useAuth();
  const router = useRouter();
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  // Space between this view's bottom and the screen bottom (a tab navigator may reserve some), so the input sits right on the keyboard.
  const [below, setBelow] = useState(0);
  const box = useRef(null);
  const measure = () => box.current?.measureInWindow((x, y, w, h) => setBelow(Math.max(windowHeight - (y + h), 0)));
  const lift = (keyboard ? (Platform.OS === 'ios' ? Math.max(keyboard - below, 0) : 0) : Math.max(bottom - below, 0)) + 8;
  useEffect(() => { if (keyboard) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [keyboard]);
  const { gutter, contentWidth } = useLayout();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // Post-workout meals the member added from the chat: suggestion id -> 'open' | 'eaten'.
  const [added, setAdded] = useState({});
  const scroll = useRef(null);

  // Reload on focus so a chat started in another tab shows up here too.
  useFocusEffect(useCallback(() => {
    let live = true;
    api.chat.sessions().then(async ({ sessions }) => {
      if (!live) return;
      if (!sessions.length) { setSessionId(id => id ?? newId()); return; }
      const { messages: list } = await api.chat.messages(sessions[0].session_id);
      if (live) { setSessionId(sessions[0].session_id); setMessages(list); }
    }).catch((e) => { if (live) { setSessionId(id => id ?? newId()); setError(e.message); } });
    return () => { live = false; };
  }, [api]));

  const send = useCallback(async (content) => {
    const body = content.trim();
    if (!body || sending || !sessionId) return;
    const mine = { message_id: newId(), sender: 'user', content: body };
    setMessages(m => [...m, mine]); setText(''); setSending(true); setError('');
    try {
      const res = await api.chat.send({ session_id: sessionId, message_id: mine.message_id, content: body, context });
      if (res.reply) setMessages(m => [...m, res.reply]);
      if (res.actions?.length) onAction?.(res.actions);
    } catch (e) {
      setMessages(m => m.filter(x => x.message_id !== mine.message_id));
      setText(body);
      setError(e.message);
    } finally { setSending(false); }
  }, [api, sending, sessionId, context, onAction]);

  const accept = async (id) => {
    try {
      const { suggestion } = await api.nutrition.accept(id);
      setAdded(a => ({ ...a, [id]: suggestion.status }));
      onAction?.(['meal']);
    } catch (e) { setError(e.message); }
  };

  const recent = messages.slice(-40);
  return (
    <View ref={box} onLayout={measure} style={styles.fill}>
      <ScrollView ref={scroll} style={styles.fill} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 12 }} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', gap: 10 }}>
          {header}
          {!messages.length ? starters.map(s => (
            <Pressable key={s} onPress={() => send(s)} style={styles.starter} accessibilityRole="button">
              <Text variant="label" tone="dim">{s}</Text>
            </Pressable>
          )) : null}
          {recent.map(m => (
            <View key={m.message_id} style={[styles.bubble, m.sender === 'user' ? styles.mine : styles.theirs]}>
              <Text color={m.sender === 'user' ? colors.inverse : colors.text}>{m.content}</Text>
              {m.sender === 'ai' ? LINKS.filter(l => l.match.test(m.ai_engine ?? '')).map(l => (
                <Pressable key={l.href} onPress={() => { onLink?.(); router.navigate(l.href); }} style={styles.link} accessibilityRole="button">
                  <Ionicons name={l.icon} size={16} color={colors.ink} />
                  <Text variant="label" color={colors.ink}>{l.label}</Text>
                </Pressable>
              )) : null}
              {m.sender === 'ai' && m.ai_engine?.startsWith('after-workout:') ? (() => {
                const id = m.ai_engine.slice('after-workout:'.length);
                return added[id] ? (
                  <Pressable onPress={() => { onLink?.(); router.navigate('/home/nutrition'); }} style={[styles.link, styles.linkDone]} accessibilityRole="button">
                    <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                    <Text variant="label" color={colors.text}>{added[id] === 'eaten' ? 'Đã ăn món này' : 'Đã thêm · Mở Ăn uống'}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => accept(id)} style={styles.link} accessibilityRole="button">
                    <Ionicons name="add-circle" size={16} color={colors.ink} />
                    <Text variant="label" color={colors.ink}>Thêm vào thực đơn</Text>
                  </Pressable>
                );
              })() : null}
            </View>
          ))}
          {messages.length && starters.length && !sending ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
              {starters.map(s => (
                <Pressable key={s} onPress={() => send(s)} style={styles.chip} accessibilityRole="button">
                  <Text variant="caption" tone="dim">{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {sending ? <Text variant="caption" tone="faint">Coach đang trả lời…</Text> : null}
          {error ? <Text variant="label" tone="danger">{error}</Text> : null}
        </View>
      </ScrollView>
      <View style={[styles.inputBar, { paddingHorizontal: gutter, paddingBottom: lift, maxWidth: contentWidth + gutter * 2 }]}>
        <TextInput value={text} onChangeText={setText} placeholder="Nhắn cho Coach…" placeholderTextColor={colors.textFaint}
          style={styles.input} multiline selectionColor={colors.accent} />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || sending} accessibilityLabel="Gửi"
          style={[styles.send, (!text.trim() || sending) && styles.sendOff]}>
          <Ionicons name="arrow-up" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  starter: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.strokeSoft },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.text, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent },
  linkDone: { backgroundColor: colors.surface },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.stroke },
  inputBar: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8, backgroundColor: colors.bg },
  input: { flex: 1, maxHeight: 120, minHeight: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 16, paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 12, borderRadius: 23, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke, outlineStyle: 'none' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
});
