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

export default function ChallengeScreen() {
  const [activeFilter, setActiveFilter] = useState('Active challenge');

  const [challenges, setChallenges] = useState([
    {
      id: 'c1',
      title: 'Run 20 km',
      remainingTime: '2.4 hours remaining',
      progress: 90,
      myProgress: '18 / 20 km',
      barColor: COLORS.lime,
      icon: 'walk',
      iconBg: COLORS.pastelYellow,
      iconColor: '#B45309',
      participants: [
        { name: 'Alex', avatarBg: '#FEF08A', status: '20km Completed', completed: true },
        { name: 'Sarah', avatarBg: '#FED7AA', status: '17km Not done yet', completed: false },
        { name: 'Mike', avatarBg: '#DDD6FE', status: '16km Not done yet', completed: false },
      ],
    },
    {
      id: 'c2',
      title: 'Drink water',
      remainingTime: '2.4 hours remaining',
      progress: 41,
      myProgress: '1.6 / 4 Liters',
      barColor: '#FDE047',
      icon: 'water',
      iconBg: COLORS.pastelBlue,
      iconColor: '#0284C7',
      participants: [
        { name: 'Emma', avatarBg: '#BAE6FD', status: '100% 4 liters total', completed: true },
        { name: 'David', avatarBg: '#FBCFE8', status: '50% 2 liters total', completed: false },
        { name: 'Lily', avatarBg: '#BBF7D0', status: '25% 1 liters total', completed: false },
      ],
    },
    {
      id: 'c3',
      title: 'Sleep for 30 days',
      remainingTime: '15 days remaining',
      progress: 50,
      myProgress: '15 / 30 Days',
      barColor: '#DDD6FE',
      icon: 'bed',
      iconBg: COLORS.pastelPurple,
      iconColor: '#7C3AED',
      participants: [
        { name: 'Chris', avatarBg: '#FED7AA', status: '20 days Completed', completed: true },
        { name: 'John', avatarBg: '#BBF7D0', status: '15 days in progress', completed: false },
        { name: 'Anna', avatarBg: '#BAE6FD', status: '10 days in progress', completed: false },
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
      remainingTime: `${newDays} days remaining`,
      progress: 10,
      myProgress: `Mục tiêu: ${newTarget || 'Đạt chỉ tiêu'}`,
      barColor: COLORS.lime,
      icon: 'flag',
      iconBg: COLORS.pastelMint,
      iconColor: '#0F766E',
      participants: [
        { name: 'Alex', avatarBg: '#FEF08A', status: 'Vừa tham gia', completed: false },
        { name: 'Sarah', avatarBg: '#FED7AA', status: 'Sẵn sàng', completed: false },
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
    if (activeFilter === 'Challenges completed') return c.progress >= 100;
    if (activeFilter === 'Active challenge') return c.progress < 100;
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
        <Text style={styles.headerTitle}>Challenge</Text>
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.7}
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
        {['All', 'Active challenge', 'Challenges completed'].map((item) => {
          const isActive = activeFilter === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : styles.filterPillInactive,
              ]}
              onPress={() => setActiveFilter(item)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  isActive ? styles.filterTextActive : styles.filterTextInactive,
                ]}
              >
                {item}
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
                <View>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <View style={styles.timeRow}>
                    <Ionicons name="hourglass-outline" size={11} color={COLORS.textMuted} />
                    <Text style={styles.timeText}>{c.remainingTime}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.progressPercentText}>{c.progress}%</Text>
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
                    <Ionicons name="person" size={11} color={COLORS.black} />
                  </View>
                  <Text style={styles.friendStatus} numberOfLines={1}>{p.status}</Text>
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
              placeholder="Tên thử thách (Ví dụ: Chạy bộ 30km, 100 cái hít đất...)"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.textInputField}
              placeholder="Mục tiêu cụ thể (Ví dụ: 30 km, 14 ngày)"
              value={newTarget}
              onChangeText={setNewTarget}
            />
            <TextInput
              style={styles.textInputField}
              placeholder="Thời hạn hoàn thành (Số ngày)"
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
            <Text style={styles.modalSubDesc}>Tiến độ hiện tại: {selectedChallenge?.progress}% ({selectedChallenge?.remainingTime})</Text>
            <View style={[styles.progressTrack, { marginVertical: 14 }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${selectedChallenge?.progress}%`, backgroundColor: selectedChallenge?.barColor || COLORS.lime },
                ]}
              />
            </View>
            <Text style={{ fontSize: SIZES.xs, color: COLORS.textSecondary, marginBottom: 16 }}>
              Bấm check-in để ghi nhận nỗ lực hôm nay của bạn và tăng điểm tiến độ!
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
      <View style={{ height: 100 }} />
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
    fontSize: SIZES.xxl,
    fontWeight: '900',
    color: COLORS.black,
  },
  plusButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  filtersScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
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
    fontSize: SIZES.xs,
    fontWeight: '700',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  filterTextInactive: {
    color: COLORS.textSecondary,
  },
  challengeList: {
    gap: 16,
  },
  challengeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
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
  },
  challengeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTitle: {
    fontSize: SIZES.base,
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
    fontSize: 11,
    color: COLORS.textMuted,
  },
  progressPercentText: {
    fontSize: SIZES.xl,
    fontWeight: '900',
    color: COLORS.black,
  },
  progressTrack: {
    height: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
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
    gap: 4,
  },
  friendAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  friendStatus: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
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
