import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import { HEALTH_TIPS } from '../constants/data';
import {
  getUserProfile,
  getWaterLogsToday,
  getWorkoutLogsToday,
  getMealLogsToday,
  addWaterLog,
} from '../utils/storage';

export default function DashboardScreen({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [waterTotal, setWaterTotal] = useState(0);
  const [calorieIntake, setCalorieIntake] = useState(0);
  const [calorieBurned, setCalorieBurned] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [randomTip, setRandomTip] = useState(HEALTH_TIPS[0]);

  const loadData = async () => {
    const prof = await getUserProfile();
    setProfile(prof);

    // Water
    const waterLogs = await getWaterLogsToday();
    const wTotal = waterLogs.reduce((sum, item) => sum + item.amount, 0);
    setWaterTotal(wTotal);

    // Workouts
    const workoutLogs = await getWorkoutLogsToday();
    const wBurned = workoutLogs.reduce((sum, item) => sum + (item.calories || 0), 0);
    setCalorieBurned(wBurned);
    setWorkoutCount(workoutLogs.length);

    // Meals
    const mealLogs = await getMealLogsToday();
    const cTotal = mealLogs.reduce((sum, item) => sum + (item.calories || 0), 0);
    setCalorieIntake(cTotal);

    // Merge recent activities
    const combined = [
      ...waterLogs.map((l) => ({ ...l, type: 'water', text: `Đã uống ${l.amount} ml nước` })),
      ...workoutLogs.map((w) => ({ ...w, type: 'workout', text: `Tập: ${w.title} (-${w.calories} kcal)` })),
      ...mealLogs.map((m) => ({ ...m, type: 'meal', text: `Ăn: ${m.name} (+${m.calories} kcal)` })),
    ].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

    setRecentActivities(combined);
  };

  useEffect(() => {
    loadData();
    const randomIdx = Math.floor(Math.random() * HEALTH_TIPS.length);
    setRandomTip(HEALTH_TIPS[randomIdx]);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleQuickAddWater = async () => {
    await addWaterLog(250);
    await loadData();
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Chào buổi sáng ☀️';
    if (hours < 18) return 'Chào buổi chiều 🌤️';
    return 'Chào buổi tối 🌙';
  };

  const targetWater = profile?.targetWater || 2200;
  const targetCalories = profile?.targetCalories || 2000;
  const waterProgress = Math.min(100, Math.round((waterTotal / targetWater) * 100));
  const caloriePercent = Math.min(100, Math.round((calorieIntake / targetCalories) * 100));

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Top Banner / Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>{getGreeting()}</Text>
        <Text style={styles.nameText}>{profile?.name || 'Bạn'}</Text>
        <Text style={styles.subGreeting}>Hôm nay là một ngày tuyệt vời để rèn luyện!</Text>
      </View>

      {/* Main Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Nước uống */}
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: COLORS.secondary, borderLeftWidth: 4 }]}
          onPress={() => onNavigate('water')}
          activeOpacity={0.8}
        >
          <View style={styles.statHeader}>
            <View style={[styles.statIconBadge, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="water" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.statPercent}>{waterProgress}%</Text>
          </View>
          <Text style={styles.statValue}>{waterTotal} <Text style={styles.statUnit}>/ {targetWater} ml</Text></Text>
          <Text style={styles.statTitle}>Nước đã uống</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${waterProgress}%`, backgroundColor: COLORS.secondary }]} />
          </View>
        </TouchableOpacity>

        {/* Năng lượng Calo */}
        <TouchableOpacity
          style={[styles.statCard, { borderLeftColor: COLORS.accent, borderLeftWidth: 4 }]}
          onPress={() => onNavigate('calorie')}
          activeOpacity={0.8}
        >
          <View style={styles.statHeader}>
            <View style={[styles.statIconBadge, { backgroundColor: COLORS.accentLight }]}>
              <Ionicons name="restaurant" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.statPercent}>{caloriePercent}%</Text>
          </View>
          <Text style={styles.statValue}>{calorieIntake} <Text style={styles.statUnit}>/ {targetCalories} kcal</Text></Text>
          <Text style={styles.statTitle}>Calo nạp vào</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${caloriePercent}%`, backgroundColor: COLORS.accent }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Secondary Row: Calo đốt & Bài tập */}
      <View style={styles.secondaryStatsRow}>
        <View style={styles.smallStatBox}>
          <Ionicons name="flame" size={22} color={COLORS.danger} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.smallStatValue}>{calorieBurned} kcal</Text>
            <Text style={styles.smallStatLabel}>Calo tiêu hao</Text>
          </View>
        </View>

        <View style={styles.smallStatBox}>
          <Ionicons name="barbell" size={22} color={COLORS.purple} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.smallStatValue}>{workoutCount} bài</Text>
            <Text style={styles.smallStatLabel}>Đã hoàn thành</Text>
          </View>
        </View>
      </View>

      {/* Quick Action Shortcuts */}
      <Text style={styles.sectionTitle}>Lối tắt nhanh</Text>
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleQuickAddWater}>
          <View style={[styles.actionIconCircle, { backgroundColor: COLORS.secondaryLight }]}>
            <Ionicons name="add" size={22} color={COLORS.secondary} />
          </View>
          <Text style={styles.actionBtnText}>+250ml Nước</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('workout')}>
          <View style={[styles.actionIconCircle, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons name="fitness" size={22} color={COLORS.purple} />
          </View>
          <Text style={styles.actionBtnText}>Tập luyện</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('calorie')}>
          <View style={[styles.actionIconCircle, { backgroundColor: COLORS.accentLight }]}>
            <Ionicons name="nutrition" size={22} color={COLORS.accent} />
          </View>
          <Text style={styles.actionBtnText}>Ghi món ăn</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('bmi')}>
          <View style={[styles.actionIconCircle, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="calculator" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.actionBtnText}>Tính BMI</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Health Tip Card */}
      <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Ionicons name="bulb" size={22} color={COLORS.accent} />
          <Text style={styles.tipTitle}>Mẹo sức khỏe hôm nay</Text>
        </View>
        <Text style={styles.tipBody}>{randomTip}</Text>
      </View>

      {/* Recent Activities */}
      <Text style={styles.sectionTitle}>Hoạt động gần đây</Text>
      {recentActivities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Chưa có hoạt động nào trong hôm nay. Hãy bắt đầu ngay!</Text>
        </View>
      ) : (
        <View style={styles.activityList}>
          {recentActivities.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <View
                style={[
                  styles.activityIconDot,
                  {
                    backgroundColor:
                      act.type === 'water'
                        ? COLORS.secondaryLight
                        : act.type === 'workout'
                        ? COLORS.purpleLight
                        : COLORS.accentLight,
                  },
                ]}
              >
                <Ionicons
                  name={
                    act.type === 'water'
                      ? 'water'
                      : act.type === 'workout'
                      ? 'flame'
                      : 'restaurant'
                  }
                  size={16}
                  color={
                    act.type === 'water'
                      ? COLORS.secondary
                      : act.type === 'workout'
                      ? COLORS.purple
                      : COLORS.accent
                  }
                />
              </View>
              <Text style={styles.activityText} numberOfLines={1}>{act.text}</Text>
              <Text style={styles.activityTime}>{act.time}</Text>
            </View>
          ))}
        </View>
      )}

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
  greetingSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  greetingText: {
    fontSize: SIZES.base,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  nameText: {
    fontSize: SIZES.title,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  subGreeting: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    ...SHADOW,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statPercent: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  statValue: {
    fontSize: SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  statUnit: {
    fontSize: SIZES.xs,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  statTitle: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  smallStatBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    ...SHADOW,
  },
  smallStatValue: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.text,
  },
  smallStatLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    alignItems: 'center',
    width: '23%',
  },
  actionIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...SHADOW,
  },
  actionBtnText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  tipTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: '#B45309',
  },
  tipBody: {
    fontSize: SIZES.sm,
    color: '#78350F',
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
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
    textAlign: 'center',
  },
  activityList: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    ...SHADOW,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityIconDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  activityTime: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
});
