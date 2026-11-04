import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { getSavedChallenges, saveChallenges, addCoins } from '../utils/storage';
import { soundManager } from '../utils/audio';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Đang diễn ra' },
  { key: 'completed', label: 'Đã hoàn thành' },
];

export default function ChallengeScreen() {
  const [activeFilter, setActiveFilter] = useState('active');

  const [challenges, setChallenges] = useState([
    {
      id: 'c1',
      title: 'Chạy bộ 20 km trong tuần',
      remainingTime: 'Còn 2 ngày 4 giờ',
      progress: 90,
      myProgress: '18 / 20 km',
      barColor: COLORS.lime,
      icon: 'walk',
      iconBg: COLORS.pastelYellow,
      iconColor: '#B45309',
      participants: [
        { name: 'Minh', avatarBg: '#FEF08A', status: 'Hoàn thành 20km', completed: true },
        { name: 'Lan', avatarBg: '#FED7AA', status: 'Đã chạy 17km', completed: false },
        { name: 'Huy', avatarBg: '#DDD6FE', status: 'Đã chạy 16km', completed: false },
      ],
    },
    {
      id: 'c2',
      title: 'Uống đủ 2.5L nước mỗi ngày',
      remainingTime: 'Còn 5 giờ hôm nay',
      progress: 65,
      myProgress: '1.6 / 2.5 Lít',
      barColor: '#38BDF8',
      icon: 'water',
      iconBg: COLORS.pastelBlue,
      iconColor: '#0284C7',
      participants: [
        { name: 'Trang', avatarBg: '#BAE6FD', status: 'Đạt 100% (2.5L)', completed: true },
        { name: 'Đức', avatarBg: '#FBCFE8', status: 'Đạt 80% (2.0L)', completed: false },
        { name: 'Vy', avatarBg: '#BBF7D0', status: 'Đạt 60% (1.5L)', completed: false },
      ],
    },
    {
      id: 'c3',
      title: 'Ngủ sớm trước 23h (30 ngày)',
      remainingTime: 'Còn 15 ngày',
      progress: 50,
      myProgress: '15 / 30 Ngày',
      barColor: '#A78BFA',
      icon: 'bed',
      iconBg: COLORS.pastelPurple,
      iconColor: '#7C3AED',
      participants: [
        { name: 'Nam', avatarBg: '#FED7AA', status: 'Chuỗi 20 ngày', completed: true },
        { name: 'Tuấn', avatarBg: '#BBF7D0', status: 'Chuỗi 15 ngày', completed: false },
        { name: 'Mai', avatarBg: '#BAE6FD', status: 'Chuỗi 10 ngày', completed: false },
      ],
    },
  ]);

  // Modal create challenge
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDays, setNewDays] = useState('7');

  // Modal check in
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  // Persistence: load saved challenges once, then save on every change
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await getSavedChallenges();
      if (saved && saved.length > 0) setChallenges(saved);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveChallenges(challenges);
  }, [challenges, loaded]);

  const handleCreateChallenge = () => {
    if (!newTitle.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên thử thách!');
      return;
    }
    const newEntry = {
      id: `c_${Date.now()}`,
      title: newTitle.trim(),
      remainingTime: `Còn ${newDays || 7} ngày`,
      progress: 10,
      myProgress: `Mục tiêu: ${newTarget || 'Đạt chỉ tiêu'}`,
      barColor: COLORS.lime,
      icon: 'flag',
      iconBg: COLORS.pastelMint,
      iconColor: '#0F766E',
      participants: [
        { name: 'Bạn', avatarBg: '#FEF08A', status: 'Vừa tham gia', completed: false },
        { name: 'Minh', avatarBg: '#FED7AA', status: 'Sẵn sàng', completed: false },
      ],
    };
    setChallenges((prev) => [newEntry, ...prev]);
    setCreateModalVisible(false);
    setNewTitle('');
    setNewTarget('');
    Vibration.vibrate(80);
    Alert.alert('Thành công', `Đã tạo thử thách "${newTitle.trim()}"! Mời bạn bè cùng tham gia ngay.`);
  };

  const handleCheckIn = async (id) => {
    const target = challenges.find((c) => c.id === id);
    if (!target) return;
    const nextProgress = Math.min(100, target.progress + 10);
    const justCompleted = target.progress < 100 && nextProgress >= 100;

    soundManager.playCoinSound();
    setChallenges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, progress: nextProgress } : c))
    );
    setSelectedChallenge(null);

    if (justCompleted) {
      await addCoins(30);
      Alert.alert('🏆 Hoàn thành thử thách!', `Bạn đã hoàn thành "${target.title}" và nhận +30 Coins thưởng!`);
    } else {
      Alert.alert('🎉 Tuyệt vời!', 'Tiến độ thử thách của bạn đã tăng thêm +10%!');
    }
  };

  const filteredChallenges = challenges.filter((c) => {
    if (activeFilter === 'completed') return c.progress >= 100;
    if (activeFilter === 'active') return c.progress < 100;
    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Thử Thách Cộng Đồng</Text>
          <Text style={styles.headerSub}>Đua top rèn luyện thể lực cùng bạn bè mỗi ngày</Text>
        </View>
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="add" size={22} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {FILTER_OPTIONS.map((item) => {
          const isActive = activeFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : styles.filterPillInactive,
              ]}
              onPress={() => setActiveFilter(item.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  isActive ? styles.filterTextActive : styles.filterTextInactive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Challenge Cards List */}
      <View style={styles.challengeList}>
        {filteredChallenges.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.challengeCard}
            onPress={() => setSelectedChallenge(c)}
            activeOpacity={0.85}
          >
            {/* Top row */}
            <View style={styles.cardTopRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.challengeIconWrap, { backgroundColor: c.iconBg }]}>
                  <Ionicons name={c.icon} size={20} color={c.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                    <Text style={styles.timeText}>{c.remainingTime}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.percentBadge}>
                <Text style={styles.progressPercentText}>{c.progress}%</Text>
              </View>
            </View>

            {/* Thick Progress bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${c.progress}%`, backgroundColor: c.barColor },
                ]}
              />
            </View>

            {/* Friends Progress Row */}
            <View style={styles.friendsList}>
              {c.participants.map((p, idx) => (
                <View key={idx} style={styles.friendItem}>
                  <View style={[styles.friendAvatar, { backgroundColor: p.avatarBg }]}>
                    <Text style={styles.friendInitial}>{(p.name || 'U')[0]}</Text>
                  </View>
                  <Text style={styles.friendName}>{p.name}</Text>
                  <Text style={styles.friendStatus} numberOfLines={1}>
                    {p.status}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal Create Challenge */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>⚡ Tạo Thử Thách Mới</Text>
            <Text style={styles.modalSubDesc}>Đặt mục tiêu cùng bạn bè rèn luyện mỗi ngày:</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Tên thử thách (VD: Chạy bộ 30km, 100 cái hít đất...)"
              placeholderTextColor={COLORS.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.textInputField}
              placeholder="Mục tiêu cụ thể (VD: 30 km, 14 ngày)"
              placeholderTextColor={COLORS.textMuted}
              value={newTarget}
              onChangeText={setNewTarget}
            />
            <TextInput
              style={styles.textInputField}
              placeholder="Thời hạn hoàn thành (Số ngày)"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={newDays}
              onChangeText={setNewDays}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateChallenge}>
                <Text style={styles.submitBtnText}>Tạo thử thách</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Check-in Detail */}
      <Modal visible={!!selectedChallenge} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>🏆 {selectedChallenge?.title}</Text>
            <Text style={styles.modalSubDesc}>
              Tiến độ hiện tại: {selectedChallenge?.progress}% ({selectedChallenge?.remainingTime})
            </Text>
            <View style={[styles.progressTrack, { marginVertical: 14 }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${selectedChallenge?.progress}%`,
                    backgroundColor: selectedChallenge?.barColor || COLORS.lime,
                  },
                ]}
              />
            </View>
            <Text style={{ fontSize: SIZES.xs, color: COLORS.textSecondary, marginBottom: 16 }}>
              Bấm Check-in để ghi nhận nỗ lực hôm nay của bạn và tăng +10% tiến độ!
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedChallenge(null)}>
                <Text style={styles.cancelBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => selectedChallenge && handleCheckIn(selectedChallenge.id)}
              >
                <Text style={styles.submitBtnText}>+ Check-in (+10%)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom padding for floating dock */}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  plusButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  filtersScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: COLORS.black,
  },
  filterPillInactive: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  filterTextInactive: {
    color: COLORS.textSecondary,
  },
  challengeList: {
    gap: 14,
  },
  challengeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  challengeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  percentBadge: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  progressPercentText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
  },
  progressTrack: {
    height: 11,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  friendsList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  friendItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  friendAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  friendInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.black,
  },
  friendName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.black,
  },
  friendStatus: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    ...SHADOWS.card,
  },
  modalHeaderTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 6,
  },
  modalSubDesc: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  textInputField: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: SIZES.sm,
    color: COLORS.black,
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cancelBtnText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  submitBtn: {
    backgroundColor: COLORS.lime,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    ...SHADOWS.soft,
  },
  submitBtnText: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
  },
});
