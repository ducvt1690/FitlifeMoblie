import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Vibration,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import {
  getAiApiKey,
  saveAiApiKey,
  getAiChatHistory,
  saveAiChatHistory,
  clearAiChatHistory,
} from '../utils/storage';
import {
  askFitLifeAi,
  loadRealtimeHealthContext,
  generateLocalSmartResponse,
} from '../utils/aiService';

const buildGreeting = (ctx) => {
  const name =
    ctx?.profile?.name && ctx.profile.name !== 'Người dùng FitLife'
      ? ctx.profile.name
      : 'bạn';
  const bmiInfo = ctx?.bmi ? ` (BMI: ${ctx.bmi} - ${ctx.bmiStatus})` : '';
  return (
    `Xin chào ${name}${bmiInfo}! Tôi là **FitLife AI Coach** 🤖⚡.\n\n` +
    `Tôi đã đồng bộ hồ sơ thể trạng và nhật ký hôm nay của bạn. Bạn có thể hỏi tôi bất kỳ điều gì với tốc độ phản hồi tức thì:\n` +
    `• 🍜 Tra cứu Calo món ăn Việt (Phở, Bún bò, Cơm tấm, Trà sữa...)\n` +
    `• 🥗 Lên thực đơn giảm mỡ / tăng cơ cá nhân hóa\n` +
    `• 🥊 Bài tập MMA, Tabata đốt mỡ 15 phút tại nhà\n` +
    `• 📊 Báo cáo đánh giá tiến độ sức khỏe hôm nay!`
  );
};

export default function AiCoachScreen() {
  const [healthCtx, setHealthCtx] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [turboMode, setTurboMode] = useState(true); // Mặc định Siêu Tốc 0.3s

  // Settings Modal for Gemini API Key
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState(false);

  const scrollRef = useRef();

  useEffect(() => {
    initAiScreen();
  }, []);

  const initAiScreen = async () => {
    const [ctx, savedHistory, savedKey] = await Promise.all([
      loadRealtimeHealthContext(),
      getAiChatHistory(),
      getAiApiKey(),
    ]);

    setHealthCtx(ctx);
    setApiKeyInput(savedKey || '');
    setHasCustomKey(Boolean(savedKey && savedKey.length > 15));

    if (savedHistory && savedHistory.length > 0) {
      setMessages(savedHistory);
    } else {
      const initialMsg = [
        {
          id: 'welcome_1',
          sender: 'ai',
          text: buildGreeting(ctx),
          source: 'FitLife Turbo AI ⚡',
          time: 'Vừa xong',
        },
      ];
      setMessages(initialMsg);
    }
  };

  const QUICK_PROMPTS = [
    '📊 Đánh giá tiến độ hôm nay của tôi',
    '🍜 1 tô phở bò và 1 ly trà sữa bao nhiêu calo?',
    `🥗 Lên thực đơn ${healthCtx?.profile?.targetCalories || 1800} kcal giảm mỡ`,
    '🥊 Bài tập MMA / HIIT đốt mỡ bụng 15 phút',
    `💧 Lượng nước chuẩn cho người ${healthCtx?.profile?.weight || 65}kg`,
  ];

  const handleSend = async (textToSend = null) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    setInputText('');
    setIsTyping(true);

    // Giữ độ trễ ngắn 300ms tạo cảm giác tự nhiên nhưng cực nhanh
    await new Promise((r) => setTimeout(r, 280));

    try {
      const result = await askFitLifeAi(text, updatedWithUser, turboMode);
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: result.text,
        source: result.source,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...updatedWithUser, aiMsg];
      setMessages(finalMessages);
      await saveAiChatHistory(finalMessages);

      // Refresh context banner
      const freshCtx = await loadRealtimeHealthContext();
      setHealthCtx(freshCtx);
    } catch (e) {
      // Fallback an toàn: Không bao giờ báo lỗi kết nối, luôn đưa ra lời khuyên từ hồ sơ
      const fallbackResult = generateLocalSmartResponse(text, healthCtx || {});
      const fallbackMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: fallbackResult.text,
        source: 'FitLife Turbo AI ⚡',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalFallback = [...updatedWithUser, fallbackMsg];
      setMessages(finalFallback);
      await saveAiChatHistory(finalFallback);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSaveApiKey = async () => {
    const cleanKey = apiKeyInput.trim();
    await saveAiApiKey(cleanKey);
    setHasCustomKey(Boolean(cleanKey && cleanKey.length > 15));
    setSettingsVisible(false);
    Alert.alert(
      '✅ Đã lưu cấu hình AI',
      cleanKey
        ? 'Đã kích hoạt kết nối trực tiếp tới Google Gemini 2.5 Flash!'
        : 'Đã lưu chế độ FitLife Turbo AI (Siêu tốc & Ổn định).'
    );
  };

  const handleClearChat = async () => {
    await clearAiChatHistory();
    const freshCtx = await loadRealtimeHealthContext();
    setHealthCtx(freshCtx);
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: buildGreeting(freshCtx),
        source: 'FitLife Turbo AI ⚡',
        time: 'Vừa xong',
      },
    ]);
  };

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, [messages, isTyping]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.coachAvatar}>
          <Ionicons name="flash" size={18} color={COLORS.black} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.coachName}>FitLife AI Coach</Text>
            <TouchableOpacity
              style={[styles.modeBadge, turboMode ? styles.modeBadgeTurbo : styles.modeBadgeGemini]}
              onPress={() => setTurboMode(!turboMode)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={turboMode ? 'flash' : 'cloud'}
                size={10}
                color={turboMode ? '#15803D' : '#0369A1'}
              />
              <Text style={[styles.modeBadgeText, !turboMode && { color: '#0369A1' }]}>
                {turboMode ? 'Turbo 0.3s' : (hasCustomKey ? 'Gemini 2.5' : 'Cloud AI')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.coachStatus}>
            {turboMode ? 'Phản hồi siêu tốc • Không lo lỗi mạng' : 'Mô hình mở rộng • Có thể mất vài giây'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleClearChat}
          activeOpacity={0.7}
          title="Làm mới cuộc trò chuyện"
        >
          <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerActionBtn, hasCustomKey && { backgroundColor: COLORS.limeLight }]}
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
          title="Cài đặt API Key"
        >
          <Ionicons name="key-outline" size={18} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Live Health Context Strip */}
      {healthCtx && (
        <View style={styles.contextStrip}>
          <View style={styles.contextPill}>
            <Ionicons name="body-outline" size={12} color="#15803D" />
            <Text style={styles.contextPillText}>
              {healthCtx.profile.weight}kg • BMI {healthCtx.bmi}
            </Text>
          </View>
          <View style={styles.contextPill}>
            <Ionicons name="flame-outline" size={12} color="#EA580C" />
            <Text style={styles.contextPillText}>
              {healthCtx.caloriesInToday}/{healthCtx.profile.targetCalories} kcal
            </Text>
          </View>
          <View style={styles.contextPill}>
            <Ionicons name="water-outline" size={12} color="#0284C7" />
            <Text style={styles.contextPillText}>
              {healthCtx.waterToday}/{healthCtx.profile.targetWater} ml
            </Text>
          </View>
        </View>
      )}

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <View
              key={m.id}
              style={[
                styles.messageWrap,
                isUser ? styles.messageWrapUser : styles.messageWrapAi,
              ]}
            >
              {!isUser && (
                <View style={styles.miniAiIcon}>
                  <Ionicons name="flash" size={12} color={COLORS.black} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.bubbleUser : styles.bubbleAi,
                ]}
              >
                {!isUser && m.source && (
                  <View style={styles.sourceRow}>
                    <Ionicons name="shield-checkmark" size={10} color="#4D7C0F" />
                    <Text style={styles.sourceText}>{m.source}</Text>
                  </View>
                )}
                <Text style={[styles.bubbleText, isUser && { color: COLORS.white }]}>
                  {m.text}
                </Text>
                <Text style={[styles.timeText, isUser && { color: 'rgba(255,255,255,0.7)' }]}>
                  {m.time}
                </Text>
              </View>
            </View>
          );
        })}

        {isTyping && (
          <View style={[styles.messageWrap, styles.messageWrapAi]}>
            <View style={styles.miniAiIcon}>
              <Ionicons name="flash" size={12} color={COLORS.black} />
            </View>
            <View style={[styles.bubble, styles.bubbleAi, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={COLORS.black} />
              <Text style={{ fontSize: SIZES.xs, color: COLORS.textSecondary, fontWeight: '700' }}>
                AI đang tính toán chỉ số cho bạn...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Suggested Quick Prompts */}
      <View style={{ backgroundColor: COLORS.bg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptScroll}
        >
          {QUICK_PROMPTS.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => handleSend(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.promptText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Input Field */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Hỏi bất kỳ món ăn, bài tập, dinh dưỡng..."
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, isTyping && { opacity: 0.5 }]}
          onPress={() => handleSend()}
          activeOpacity={0.8}
          disabled={isTyping}
        >
          <Ionicons name="arrow-up" size={20} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Gemini API Key Configuration Modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Cấu hình Tốc độ & Engine AI</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Ứng dụng đang chạy ở chế độ **FitLife Turbo AI (Tốc độ 0.3s)**, được tối ưu riêng cho hồ sơ dinh dưỡng & luyện tập của bạn, đảm bảo mượt mà 100% không lo lỗi mạng.
            </Text>
            <Text style={[styles.modalDesc, { marginTop: 8 }]}>
              Nếu bạn có **Google Gemini API Key** riêng (lấy miễn phí tại aistudio.google.com), hãy dán vào bên dưới để kích hoạt mô hình Gemini 2.5 Flash:
            </Text>

            <TextInput
              style={styles.keyInput}
              placeholder="AIzaSy... (Để trống để dùng Turbo AI mặc định)"
              placeholderTextColor={COLORS.textMuted}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.clearKeyBtn}
                onPress={() => {
                  setApiKeyInput('');
                  setTurboMode(true);
                }}
              >
                <Text style={styles.clearKeyText}>Dùng Turbo mặc định</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveKeyBtn}
                onPress={handleSaveApiKey}
              >
                <Text style={styles.saveKeyText}>Lưu cấu hình</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  coachAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachName: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  modeBadgeTurbo: {
    backgroundColor: COLORS.lime,
  },
  modeBadgeGemini: {
    backgroundColor: '#E0F2FE',
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  coachStatus: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ECFDF5',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contextPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  chatArea: {
    flex: 1,
  },
  messageWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
    gap: 8,
  },
  messageWrapUser: {
    justifyContent: 'flex-end',
  },
  messageWrapAi: {
    justifyContent: 'flex-start',
  },
  miniAiIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '83%',
    padding: 14,
    borderRadius: 20,
    ...SHADOWS.soft,
  },
  bubbleUser: {
    backgroundColor: COLORS.black,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4D7C0F',
    textTransform: 'uppercase',
  },
  bubbleText: {
    fontSize: SIZES.sm,
    color: COLORS.black,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 9,
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  promptScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  promptChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    ...SHADOWS.soft,
  },
  promptText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: SIZES.sm,
    color: COLORS.black,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: SIZES.md,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalDesc: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  keyInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.sm,
    color: COLORS.black,
    marginTop: 14,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  clearKeyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
  },
  clearKeyText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveKeyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.lime,
  },
  saveKeyText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
});
