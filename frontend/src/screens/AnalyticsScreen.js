import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { getWeeklyStats } from '../utils/storage';

const EMPTY_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function AnalyticsScreen({ onBack }) {
  const [timeRange, setTimeRange] = useState('7d'); // '7d' | '30d'
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await getWeeklyStats();
      setStats(s);
    })();
  }, []);

  // Real data from storage (falls back to empty bars before first load)
  const hydrationData = stats?.water || EMPTY_WEEK.map((day) => ({ day, amount: 0 }));
  const weightData = stats?.weight || EMPTY_WEEK.map((day) => ({ day, weight: 65 }));
  const stepData = stats?.steps || EMPTY_WEEK.map((day) => ({ day, steps: 0 }));
  const sleepData = stats?.sleep || EMPTY_WEEK.map((day) => ({ day, hours: 0 }));
  const waterTarget = stats?.waterTarget || 2200;

  // Weight chart range (padded so the line never collapses when weight is flat)
  const weights = weightData.map((w) => w.weight);
  const minWeight = Math.min(...weights) - 0.5;
  const maxWeight = Math.max(...weights) + 0.5;
  const latestWeight = weights[weights.length - 1];
  const weightDelta = +(latestWeight - weights[0]).toFixed(1);

  // Summary values
  const totalSteps = stepData.reduce((acc, c) => acc + c.steps, 0);
  const avgSteps = Math.round(totalSteps / stepData.length);
  const avgWater = Math.round(hydrationData.reduce((a, c) => a + c.amount, 0) / hydrationData.length);
  const sleepNights = sleepData.filter((s) => s.hours > 0);
  const avgSleep = sleepNights.length
    ? (sleepNights.reduce((a, c) => a + c.hours, 0) / sleepNights.length).toFixed(1)
    : '--';
  const sleepGoalRate = sleepNights.length
    ? Math.round((sleepNights.filter((s) => s.hours >= 7).length / sleepNights.length) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Biểu Đồ & Thống Kê</Text>
          <Text style={styles.headerSubtitle}>Xu hướng thể trạng và sức khỏe 7 ngày qua</Text>
        </View>
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>Tuần này</Text>
        </View>
      </View>

      {/* 1. Weight Line Trend Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.pastelYellow }]}>
              <Ionicons name="scale-outline" size={18} color="#B45309" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Tiến trình Cân nặng</Text>
              <Text style={styles.cardSubtitle}>
                {weightDelta === 0
                  ? 'Cân nặng ổn định trong tuần'
                  : `${weightDelta > 0 ? 'Tăng +' : 'Giảm '}${weightDelta} kg so với đầu tuần`}
              </Text>
            </View>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeText}>{latestWeight} kg</Text>
          </View>
        </View>

        {/* Visual Line Points with connecting track */}
        <View style={styles.lineChartArea}>
          {weightData.map((item, idx) => {
            const heightPercent = Math.max(15, Math.min(85, ((item.weight - minWeight) / (maxWeight - minWeight)) * 100));
            return (
              <View key={item.day} style={styles.lineCol}>
                <View style={styles.lineTrack}>
                  <View style={[styles.lineDotWrap, { bottom: `${heightPercent}%` }]}>
                    <Text style={styles.lineDotVal}>{item.weight}</Text>
                    <View style={styles.lineDot} />
                  </View>
                </View>
                <Text style={styles.dayLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 2. Hydration Bar Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.pastelBlue }]}>
              <Ionicons name="water-outline" size={18} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Lượng nước Uống hàng ngày</Text>
              <Text style={styles.cardSubtitle}>Mục tiêu: {waterTarget} ml/ngày</Text>
            </View>
          </View>
          <Text style={styles.avgStatText}>TB: {avgWater.toLocaleString()}ml</Text>
        </View>

        {/* Visual Bar Chart */}
        <View style={styles.barChartContainer}>
          {hydrationData.map((item) => {
            const barHeight = Math.min(100, Math.round((item.amount / 2800) * 100));
            const isMet = item.amount >= waterTarget;
            return (
              <View key={item.day} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: isMet ? COLORS.lime : COLORS.pastelBlue,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.dayLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 3. Steps Comparison Card */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.pastelGreen }]}>
              <Ionicons name="walk-outline" size={18} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Bước Chân Vận Động</Text>
              <Text style={styles.cardSubtitle}>Tổng tuần: {totalSteps.toLocaleString()} bước</Text>
            </View>
          </View>
          <Text style={styles.avgStatText}>{avgSteps.toLocaleString()} / ngày</Text>
        </View>

        {/* Visual Step Bars */}
        <View style={styles.barChartContainer}>
          {stepData.map((item) => {
            const barHeight = Math.min(100, Math.round((item.steps / 12000) * 100));
            const isTarget = item.steps >= 10000;
            return (
              <View key={item.day} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: isTarget ? '#16A34A' : '#A7F3D0',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.dayLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 4. Sleep & Recovery Summary Card */}
      <View style={styles.chartCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconBadge, { backgroundColor: COLORS.pastelPurple }]}>
              <Ionicons name="bed-outline" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Chất Lượng Giấc Ngủ</Text>
              <Text style={styles.cardSubtitle}>Phục hồi năng lượng & cơ bắp</Text>
            </View>
          </View>
          <View style={[styles.statBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[styles.statBadgeText, { color: '#6D28D9' }]}>{avgSleep}h / đêm</Text>
          </View>
        </View>

        <View style={styles.sleepStatGrid}>
          <View style={styles.sleepStatBox}>
            <Text style={styles.sleepBoxVal}>{sleepGoalRate}%</Text>
            <Text style={styles.sleepBoxLabel}>Đêm đạt ≥ 7h</Text>
          </View>
          <View style={styles.sleepStatBox}>
            <Text style={styles.sleepBoxVal}>{sleepNights.length}/7</Text>
            <Text style={styles.sleepBoxLabel}>Đêm đã ghi</Text>
          </View>
          <View style={styles.sleepStatBox}>
            <Text style={styles.sleepBoxVal}>
              {sleepNights.length ? `${Math.max(...sleepNights.map((s) => s.hours))}h` : '--'}
            </Text>
            <Text style={styles.sleepBoxLabel}>Đêm ngủ dài nhất</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '900',
    color: COLORS.black,
  },
  headerSubtitle: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rangePill: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rangeText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statBadge: {
    backgroundColor: COLORS.limeLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statBadgeText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
  avgStatText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  lineChartArea: {
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 8,
  },
  lineCol: {
    flex: 1,
    alignItems: 'center',
  },
  lineTrack: {
    flex: 1,
    width: 1,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    alignItems: 'center',
  },
  lineDotWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  lineDotVal: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 2,
  },
  lineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lime,
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 8,
  },
  barChartContainer: {
    height: 130,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 18,
    height: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 9,
  },
  sleepStatGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  sleepStatBox: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  sleepBoxVal: {
    fontSize: SIZES.base,
    fontWeight: '900',
    color: COLORS.black,
  },
  sleepBoxLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
