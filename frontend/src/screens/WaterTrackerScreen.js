import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import {
  getUserProfile,
  saveUserProfile,
  getWaterLogsToday,
  addWaterLog,
  resetWaterToday,
} from '../utils/storage';

export default function WaterTrackerScreen() {
  const [target, setTarget] = useState(2200);
  const [logs, setLogs] = useState([]);
  const [customAmount, setCustomAmount] = useState('');
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [tempTarget, setTempTarget] = useState('2200');

  const loadData = async () => {
    const prof = await getUserProfile();
    if (prof?.targetWater) {
      setTarget(prof.targetWater);
      setTempTarget(prof.targetWater.toString());
    }
    const todayLogs = await getWaterLogsToday();
    setLogs(todayLogs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalWater = logs.reduce((sum, item) => sum + item.amount, 0);
  const progressPercent = Math.min(100, Math.round((totalWater / target) * 100));

  const handleAddWater = async (amount) => {
    if (amount <= 0) return;
    await addWaterLog(amount);
    await loadData();
  };

  const handleCustomAdd = async () => {
    const num = parseInt(customAmount, 10);
    if (!num || num <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập lượng nước hợp lệ (ml)!');
      return;
    }
    await addWaterLog(num);
    setCustomAmount('');
    await loadData();
  };

  const handleSaveTarget = async () => {
    const num = parseInt(tempTarget, 10);
    if (!num || num < 500) {
      Alert.alert('Lỗi', 'Mục tiêu nước mỗi ngày tối thiểu 500 ml!');
      return;
    }
    const prof = await getUserProfile();
    await saveUserProfile({ ...prof, targetWater: num });
    setTarget(num);
    setTargetModalVisible(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Đặt lại lượng nước',
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử uống nước hôm nay không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa hết',
          style: 'destructive',
          onPress: async () => {
            await resetWaterToday();
            await loadData();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Card: Progress Display */}
      <View style={styles.progressCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Mục tiêu hôm nay</Text>
          <TouchableOpacity
            style={styles.editTargetBtn}
            onPress={() => setTargetModalVisible(true)}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.secondary} />
            <Text style={styles.editTargetText}>Đổi mục tiêu</Text>
          </TouchableOpacity>
        </View>

        {/* Visual Water Circle */}
        <View style={styles.circleOuter}>
          <View style={[styles.circleFill, { height: `${progressPercent}%` }]} />
          <View style={styles.circleTextWrapper}>
            <Ionicons name="water" size={32} color={COLORS.secondary} />
            <Text style={styles.circleBigText}>{totalWater}</Text>
            <Text style={styles.circleSubText}>/ {target} ml</Text>
            <View style={styles.percentBadge}>
              <Text style={styles.percentBadgeText}>{progressPercent}% hoàn thành</Text>
            </View>
          </View>
        </View>

        {progressPercent >= 100 && (
          <View style={styles.congratsBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
            <Text style={styles.congratsText}>Tuyệt vời! Bạn đã đạt mục tiêu nước hôm nay! 🎉</Text>
          </View>
        )}
      </View>

      {/* Quick Add Presets */}
      <Text style={styles.sectionTitle}>Thêm nhanh</Text>
      <View style={styles.presetGrid}>
        <TouchableOpacity style={styles.presetItem} onPress={() => handleAddWater(150)}>
          <View style={styles.presetIconCircle}>
            <Ionicons name="cafe" size={24} color={COLORS.secondary} />
          </View>
          <Text style={styles.presetAmount}>+150 ml</Text>
          <Text style={styles.presetLabel}>Tách trà/cà phê</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.presetItem} onPress={() => handleAddWater(250)}>
          <View style={styles.presetIconCircle}>
            <Ionicons name="water" size={24} color={COLORS.secondary} />
          </View>
          <Text style={styles.presetAmount}>+250 ml</Text>
          <Text style={styles.presetLabel}>Cốc tiêu chuẩn</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.presetItem} onPress={() => handleAddWater(500)}>
          <View style={styles.presetIconCircle}>
            <Ionicons name="beaker" size={24} color={COLORS.secondary} />
          </View>
          <Text style={styles.presetAmount}>+500 ml</Text>
          <Text style={styles.presetLabel}>Chai nước</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.presetItem} onPress={() => handleAddWater(750)}>
          <View style={styles.presetIconCircle}>
            <Ionicons name="fitness" size={24} color={COLORS.secondary} />
          </View>
          <Text style={styles.presetAmount}>+750 ml</Text>
          <Text style={styles.presetLabel}>Bình thể thao</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Amount Input */}
      <View style={styles.customInputCard}>
        <TextInput
          style={styles.customInput}
          placeholder="Nhập lượng nước khác (ml)..."
          keyboardType="numeric"
          value={customAmount}
          onChangeText={setCustomAmount}
          placeholderTextColor={COLORS.textMuted}
        />
        <TouchableOpacity style={styles.customAddBtn} onPress={handleCustomAdd}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.customAddBtnText}>Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Log History */}
      <View style={styles.logHeaderRow}>
        <Text style={styles.sectionTitle}>Lịch sử uống hôm nay</Text>
        {logs.length > 0 && (
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Đặt lại</Text>
          </TouchableOpacity>
        )}
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="water-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Chưa có lần uống nước nào hôm nay.</Text>
        </View>
      ) : (
        <View style={styles.logList}>
          {logs.map((item) => (
            <View key={item.id} style={styles.logItem}>
              <View style={styles.logLeft}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
                <Text style={styles.logAmount}>+{item.amount} ml</Text>
              </View>
              <Text style={styles.logTime}>{item.time}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Modal: Change Daily Target */}
      <Modal visible={targetModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cài đặt mục tiêu nước</Text>
            <Text style={styles.modalSubtitle}>Lượng nước khuyến nghị: 2000 - 3000 ml tùy theo thể trạng và vận động.</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={tempTarget}
              onChangeText={setTempTarget}
              placeholder="Ví dụ: 2500"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.border }]}
                onPress={() => setTargetModalVisible(false)}
              >
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.secondary }]}
                onPress={handleSaveTarget}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700' }}>Lưu mục tiêu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
    ...SHADOW,
  },
  cardHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  editTargetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editTargetText: {
    fontSize: SIZES.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  circleOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 6,
    borderColor: '#93C5FD',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#60A5FA',
    opacity: 0.6,
  },
  circleTextWrapper: {
    alignItems: 'center',
    zIndex: 2,
  },
  circleBigText: {
    fontSize: SIZES.huge,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 2,
  },
  circleSubText: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  percentBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  percentBadgeText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  congratsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  congratsText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: '#065F46',
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  presetItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...SHADOW,
  },
  presetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  presetAmount: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.text,
  },
  presetLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  customInputCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOW,
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: SIZES.sm,
    color: COLORS.text,
  },
  customAddBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 4,
  },
  customAddBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: SIZES.sm,
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetText: {
    fontSize: SIZES.sm,
    color: COLORS.danger,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  logList: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    ...SHADOW,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logAmount: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  logTime: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    ...SHADOW,
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: SIZES.base,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
