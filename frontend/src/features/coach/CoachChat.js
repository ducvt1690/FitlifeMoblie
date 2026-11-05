import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Text from '../../ui/Text';
import { colors, fonts, radius, themed } from '../../theme/tokens';
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
  const { api, token, user } = useAuth();
  const owner = token && user?.user_id ? `${user.user_id}:${token}` : null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
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
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(null);
  const [loadedOwner, setLoadedOwner] = useState(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  // Post-workout meals the member added from the chat: suggestion id -> 'open' | 'eaten'.
  const [added, setAdded] = useState({});
  const scroll = useRef(null);
  const conversationOwner = useRef(null);
  const generation = useRef(0);
  const revision = useRef(0);
  const currentSession = useRef(null);
  const ready = useRef(false);
  const inFlight = useRef(false);
  const pendingSend = useRef(null);

  // Resolve the current conversation before allowing sends. A late history response
  // must never replace a newer message/reply or another account's conversation.
  useFocusEffect(useCallback(() => {
    const load = ++generation.current;
    const live = () => generation.current === load && ownerRef.current === owner;
    ready.current = false;
    currentSession.current = null;
    setSessionId(null); setMessages([]); setError(''); setLoading(true); setLoadedOwner(null); setAiEnabled(null);
    if (conversationOwner.current !== owner) {
      conversationOwner.current = owner;
      setText(''); setAdded({}); setSending(false);
    }
    (async () => {
      try {
        // When returning during a send, wait for it to settle so history includes
        // its final reply rather than a snapshot captured halfway through the turn.
        const pending = pendingSend.current;
        if (pending?.owner === owner) await pending.promise;
        if (!live() || !owner) return;
        const version = revision.current;
        const { sessions, ai_enabled } = await api.chat.sessions();
        if (!live()) return;
        const id = sessions[0]?.session_id ?? newId();
        const list = sessions.length ? (await api.chat.messages(id)).messages : [];
        if (!live() || revision.current !== version) return;
        currentSession.current = id;
        ready.current = true;
        inFlight.current = false;
        setSessionId(id); setMessages(list); setSending(false); setLoadedOwner(owner); setAiEnabled(ai_enabled === true);
      } catch (e) {
        if (live()) { setError(e.message); setLoadedOwner(owner); }
      } finally { if (live()) setLoading(false); }
    })();
    return () => {
      generation.current += 1;
      ready.current = false;
      currentSession.current = null;
    };
  }, [api, owner, reload]));

  const send = useCallback(async (content) => {
    const body = content.trim();
    const id = currentSession.current;
    if (!body || !owner || ownerRef.current !== owner || !ready.current || inFlight.current || !id) return;
    const sendGeneration = generation.current;
    const live = () => ownerRef.current === owner && generation.current === sendGeneration && currentSession.current === id;
    inFlight.current = true;
    revision.current += 1;
    const mine = { message_id: newId(), sender: 'user', content: body };
    setMessages(m => [...m, mine]); setText(''); setSending(true); setError('');
    const pending = { owner, promise: null };
    pendingSend.current = pending;
    pending.promise = (async () => {
      try {
        const res = await api.chat.send({ session_id: id, message_id: mine.message_id, content: body, context });
        if (!live()) return;
        revision.current += 1;
        if (res.reply) setMessages(m => [...m, res.reply]);
        if (res.actions?.length) onAction?.(res.actions);
      } catch (e) {
        if (!live()) return;
        revision.current += 1;
        setMessages(m => m.filter(x => x.message_id !== mine.message_id));
        setText(draft => draft || body);
        setError(e.message);
      } finally {
        if (pendingSend.current === pending) { pendingSend.current = null; inFlight.current = false; }
        if (live()) setSending(false);
      }
    })();
    await pending.promise;
  }, [api, owner, context, onAction]);

  const accept = async (id) => {
    const actionGeneration = generation.current;
    const live = () => ownerRef.current === owner && generation.current === actionGeneration;
    if (!owner || !ready.current) return;
    try {
      const { suggestion } = await api.nutrition.accept(id);
      if (!live()) return;
      setAdded(a => ({ ...a, [id]: suggestion.status }));
      onAction?.(['meal']);
    } catch (e) { if (live()) setError(e.message); }
  };

  const ownState = !!owner && loadedOwner === owner;
  const conversationReady = ownState && !loading && !!sessionId;
  const recent = conversationReady ? messages.slice(-40) : [];
  const canSend = conversationReady && !sending;
  return (
    <View ref={box} onLayout={measure} style={styles.fill}>
      <ScrollView ref={scroll} style={styles.fill} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 12 }} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', gap: 10 }}>
          {header}
          <View style={styles.notice}>
            <Text variant="caption" tone="dim">Chỉ hỗ trợ các tính năng và dữ liệu trong FitLife.</Text>
            {conversationReady && aiEnabled === false ? (
              <Text variant="caption" tone="dim">Trợ lý cơ bản: trả lời từ hướng dẫn và dữ liệu trong app.</Text>
            ) : null}
          </View>
          {loading ? <Text variant="caption" tone="faint">Đang tải hội thoại…</Text> : null}
          {conversationReady && !messages.length ? starters.map(s => (
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
          {conversationReady && messages.length > 0 && starters.length > 0 && !sending ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
              {starters.map(s => (
                <Pressable key={s} onPress={() => send(s)} style={styles.chip} accessibilityRole="button">
                  <Text variant="caption" tone="dim">{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {ownState && sending ? <Text variant="caption" tone="faint">Coach đang trả lời…</Text> : null}
          {ownState && error ? <Text variant="label" tone="danger">{error}</Text> : null}
          {ownState && error && !sessionId && !loading ? (
            <Pressable onPress={() => setReload(n => n + 1)} style={styles.chip} accessibilityRole="button">
              <Text variant="label">Tải lại hội thoại</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.inputBar, { paddingHorizontal: gutter, paddingBottom: lift, maxWidth: contentWidth + gutter * 2 }]}>
        <TextInput value={ownState ? text : ''} onChangeText={setText} editable={conversationReady}
          placeholder="Nhắn cho Coach…" placeholderTextColor={colors.textFaint}
          style={styles.input} multiline selectionColor={colors.accent} />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || !canSend} accessibilityLabel="Gửi"
          accessibilityRole="button" accessibilityState={{ disabled: !text.trim() || !canSend }}
          style={[styles.send, (!text.trim() || !canSend) && styles.sendOff]}>
          <Ionicons name="arrow-up" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1 },
  notice: { gap: 4, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface },
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
}));
