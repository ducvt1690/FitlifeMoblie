import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import BmiCalculatorScreen from './BmiCalculatorScreen';
import WorkoutScreen from './WorkoutScreen';
import CalorieScreen from './CalorieScreen';
import WaterTrackerScreen from './WaterTrackerScreen';
import AnalyticsScreen from './AnalyticsScreen';
import AiCoachScreen from './AiCoachScreen';
import ShopScreen from './ShopScreen';
import ProfileScreen from './ProfileScreen';

export default function MenuScreen({ initialModal = null, onLogout }) {
  const [activeModal, setActiveModal] = useState(initialModal);

  React.useEffect(() => {
    if (initialModal) {
      setActiveModal(initialModal);
    }
  }, [initialModal]);
  // 'profile' | 'analytics' | 'aicoach' | 'shop' | 'notifications' | 'bmi' | 'workout' | 'calorie' | 'water'

  const featuredTools = [
    {
      id: 'profile',
      title: '👤 Hồ Sơ Cá Nhân & Mục Tiêu',
      desc: 'Cập nhật tên, cân nặng, chiều cao và mục tiêu nước, calo mỗi ngày',
      icon: 'person-circle-outline',
      iconBg: COLORS.pastelMint,
      iconColor: '#0F766E',
    },
    {
      id: 'analytics',
      title: '📊 Biểu Đồ & Thống Kê',
      desc: 'Xu hướng cân nặng, biểu đồ nước uống và bước chân 7 ngày',
      icon: 'bar-chart-outline',
      iconBg: COLORS.pastelGreen,
      iconColor: '#15803D',
    },
    {
      id: 'aicoach',
      title: '🤖 Trợ Lý AI FitLife Coach',
      desc: 'Tư vấn dinh dưỡng, gợi ý thực đơn và bài tập bằng AI thông minh',
      icon: 'sparkles-outline',
      iconBg: COLORS.limeLight,
      iconColor: '#3F6212',
    },
    {
      id: 'shop',
      title: '🎁 Cửa Hàng Đổi Xu (Shop)',
      desc: 'Dùng xu hoàn thành nhiệm vụ để đổi huy hiệu và quà tặng',
      icon: 'gift-outline',
      iconBg: COLORS.pastelYellow,
      iconColor: '#B45309',
    },
  ];

  const standardTools = [
    {
      id: 'bmi',
      title: 'Chỉ số Thể trạng & BMI',
      desc: 'Tính toán BMI, BMR, TDEE và cân nặng lý tưởng',
      icon: 'calculator-outline',
      iconBg: COLORS.pastelYellow,
      iconColor: '#B45309',
    },
    {
      id: 'workout',
      title: 'Luyện tập & Bấm giờ HIIT',
      desc: 'Bài tập toàn thân, core, cardio kèm âm thanh đếm giờ Tabata',
      icon: 'barbell-outline',
      iconBg: COLORS.pastelPurple,
      iconColor: '#7C3AED',
    },
    {
      id: 'calorie',
      title: 'Nhật ký Calo & Dinh dưỡng',
      desc: 'Tra cứu calo món ăn Việt Nam, đạm, tinh bột và chất béo',
      icon: 'restaurant-outline',
      iconBg: COLORS.pastelPink,
      iconColor: '#BE185D',
    },
    {
      id: 'water',
      title: 'Chi tiết Theo dõi Nước uống',
      desc: 'Lịch sử uống nước trong ngày và tùy chỉnh mục tiêu',
      icon: 'water-outline',
      iconBg: COLORS.pastelBlue,
      iconColor: '#0284C7',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Trung tâm Tính năng</Text>
        <Text style={styles.headerSub}>Công cụ nâng cao & Trợ lý thông minh</Text>

        {/* Featured Big Cards (AI, Analytics, Shop) */}
        <Text style={styles.groupTitle}>⭐ Tính Năng Nổi Bật</Text>
        <View style={styles.menuList}>
          {featuredTools.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => setActiveModal(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Standard Fitness Trackers */}
        <Text style={styles.groupTitle}>📱 Công Cụ Theo Dõi Thể Lực</Text>
        <View style={styles.menuList}>
          {standardTools.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => setActiveModal(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fullscreen Modals for Sub-screens */}
      <Modal visible={!!activeModal} animationType="slide">
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActiveModal(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {activeModal === 'profile' && 'Hồ Sơ Cá Nhân & Mục Tiêu'}
              {activeModal === 'analytics' && 'Biểu Đồ & Thống Kê Tuần'}
              {activeModal === 'aicoach' && 'Trợ Lý AI FitLife Coach'}
              {activeModal === 'shop' && 'Cửa Hàng Đổi Xu Quà Tặng'}
              {activeModal === 'bmi' && 'Tính Chỉ Số BMI & Thể Trạng'}
              {activeModal === 'workout' && 'Luyện Tập & Đồng Hồ HIIT'}
              {activeModal === 'calorie' && 'Nhật Ký Dinh Dưỡng'}
              {activeModal === 'water' && 'Theo Dõi Nước Uống'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1 }}>
            {activeModal === 'profile' && (
              <ProfileScreen
                onLogout={() => {
                  setActiveModal(null);
                  if (onLogout) onLogout();
                }}
              />
            )}
            {activeModal === 'analytics' && <AnalyticsScreen />}
            {activeModal === 'aicoach' && <AiCoachScreen />}
            {activeModal === 'shop' && <ShopScreen />}
            {activeModal === 'bmi' && <BmiCalculatorScreen />}
            {activeModal === 'workout' && <WorkoutScreen />}
            {activeModal === 'calorie' && <CalorieScreen />}
            {activeModal === 'water' && <WaterTrackerScreen />}
          </View>
        </View>
      </Modal>
    </View>
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
  headerTitle: {
    fontSize: SIZES.xxl,
    fontWeight: '900',
    color: COLORS.black,
  },
  headerSub: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuList: {
    gap: 12,
    marginBottom: 20,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    ...SHADOWS.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  badgeWrap: {
    backgroundColor: COLORS.lime,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.black,
  },
  notificationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  notifBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  notifActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lime,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    ...SHADOWS.soft,
  },
  notifBtnText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
  },
});
