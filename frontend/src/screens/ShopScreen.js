import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { getCoins, addCoins, getPurchases, addPurchase } from '../utils/storage';
import { soundManager } from '../utils/audio';

export default function ShopScreen() {
  const [coins, setCoins] = useState(150);
  const [purchasedIds, setPurchasedIds] = useState(['badge_1']);

  const loadCoins = async () => {
    const c = await getCoins();
    setCoins(c);
    const owned = await getPurchases();
    setPurchasedIds(owned);
  };

  useEffect(() => {
    loadCoins();
  }, []);

  const SHOP_ITEMS = [
    {
      category: '🏅 Huy Hiệu Danh Dự',
      items: [
        {
          id: 'badge_1',
          name: 'Tân Binh Khởi Động',
          desc: 'Dành cho người hoàn thành nhiệm vụ ngày đầu tiên',
          price: 50,
          icon: 'ribbon-outline',
          iconBg: COLORS.pastelYellow,
          iconColor: '#B45309',
        },
        {
          id: 'badge_2',
          name: 'Bậc Thầy Hydration 💧',
          desc: 'Uống đủ 2,200ml nước liên tục 7 ngày',
          price: 150,
          icon: 'water-outline',
          iconBg: COLORS.pastelBlue,
          iconColor: '#0284C7',
        },
        {
          id: 'badge_3',
          name: 'Chiến Binh Thể Lực 🥊',
          desc: 'Hoàn thành 10 bài tập HIIT & Boxing MMA',
          price: 200,
          icon: 'flame-outline',
          iconBg: COLORS.pastelPink,
          iconColor: '#BE185D',
        },
      ],
    },
    {
      category: '🎨 Khung Avatar & Giao Diện',
      items: [
        {
          id: 'frame_1',
          name: 'Viền Vàng Hoàng Kim ✨',
          desc: 'Khung viền sang trọng mạ vàng cho ảnh đại diện',
          price: 180,
          icon: 'star-outline',
          iconBg: '#FEF3C7',
          iconColor: '#D97706',
        },
        {
          id: 'frame_2',
          name: 'Khung Neon Lime Cyberpunk ⚡',
          desc: 'Phát sáng xanh neon phong cách hiện đại thể thao',
          price: 220,
          icon: 'flash-outline',
          iconBg: COLORS.limeLight,
          iconColor: '#4D7C0F',
        },
      ],
    },
    {
      category: '📚 Giáo Án & Khóa Tập Đặc Biệt',
      items: [
        {
          id: 'course_1',
          name: 'Lộ Trình Siết Cơ Bụng 30 Ngày',
          desc: 'Giáo án độc quyền từ huấn luyện viên thể hình',
          price: 120,
          icon: 'fitness-outline',
          iconBg: COLORS.pastelGreen,
          iconColor: '#15803D',
        },
      ],
    },
  ];

  const handleBuy = async (item) => {
    if (purchasedIds.includes(item.id)) {
      Alert.alert('Đã sở hữu', `Bạn đã sở hữu "${item.name}" rồi!`);
      return;
    }

    if (coins < item.price) {
      Alert.alert(
        'Không đủ Coins 🪙',
        `Bạn cần thêm ${item.price - coins} coins nữa. Hãy hoàn thành các nhiệm vụ ở màn Quests để kiếm thêm xu nhé!`
      );
      return;
    }

    // Deduct coins
    const updated = await addCoins(-item.price);
    setCoins(updated);
    const owned = await addPurchase(item.id);
    setPurchasedIds(owned);
    soundManager.playCoinSound();

    Alert.alert(
      '🎉 Mở khóa thành công!',
      `Chúc mừng bạn đã sở hữu "${item.name}". Vật phẩm đã được áp dụng vào hồ sơ của bạn!`
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header & Balance Card */}
      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceTitle}>Cửa Hàng Đổi Xu FitLife</Text>
          <Text style={styles.balanceSubtitle}>Đổi xu thưởng lấy huy hiệu và vật phẩm VIP</Text>
        </View>

        <View style={styles.coinBadge}>
          <View style={styles.coinIconCircle}>
            <Ionicons name="sparkles" size={14} color="#D97706" />
          </View>
          <Text style={styles.coinText}>{coins} Coins</Text>
        </View>
      </View>

      {/* Sections */}
      {SHOP_ITEMS.map((section, sIdx) => (
        <View key={sIdx} style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>{section.category}</Text>
          <View style={styles.itemList}>
            {section.items.map((item) => {
              const isOwned = purchasedIds.includes(item.id);
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={[styles.itemIconWrap, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={22} color={item.iconColor} />
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.buyBtn,
                      isOwned ? styles.buyBtnOwned : styles.buyBtnActive,
                    ]}
                    onPress={() => handleBuy(item)}
                    disabled={isOwned}
                    activeOpacity={0.8}
                  >
                    {isOwned ? (
                      <View style={styles.ownedRow}>
                        <Ionicons name="checkmark" size={12} color="#059669" />
                        <Text style={styles.ownedText}>Đã có</Text>
                      </View>
                    ) : (
                      <View style={styles.buyRow}>
                        <Ionicons name="sparkles" size={10} color={COLORS.black} />
                        <Text style={styles.priceText}>{item.price}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ))}

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
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  balanceTitle: {
    fontSize: SIZES.lg,
    fontWeight: '900',
    color: COLORS.black,
  },
  balanceSubtitle: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  coinIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinText: {
    fontSize: SIZES.base,
    fontWeight: '900',
    color: '#B45309',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 10,
  },
  itemList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    ...SHADOWS.soft,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  buyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  buyBtnActive: {
    backgroundColor: COLORS.lime,
  },
  buyBtnOwned: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  buyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
  ownedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownedText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: '#059669',
  },
});
