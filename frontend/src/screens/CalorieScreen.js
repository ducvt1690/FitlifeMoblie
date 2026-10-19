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
import { POPULAR_FOODS } from '../constants/data';
import {
  getUserProfile,
  getMealLogsToday,
  addMealLog,
  deleteMealLog,
} from '../utils/storage';

export default function CalorieScreen() {
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('Trưa');

  // Custom meal input form
  const [foodName, setFoodName] = useState('');
  const [foodCal, setFoodCal] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const prof = await getUserProfile();
    setProfile(prof);
    const todayMeals = await getMealLogsToday();
    setMeals(todayMeals);
  };

  useEffect(() => {
    loadData();
  }, []);

  const targetCalories = profile?.targetCalories || 2000;
  const totalCalories = meals.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = meals.reduce((sum, item) => sum + (item.protein || 0), 0);
  const totalCarbs = meals.reduce((sum, item) => sum + (item.carbs || 0), 0);
  const totalFat = meals.reduce((sum, item) => sum + (item.fat || 0), 0);

  const calPercent = Math.min(100, Math.round((totalCalories / targetCalories) * 100));

  const handleOpenAddModal = (mealType) => {
    setSelectedMealType(mealType);
    setFoodName('');
    setFoodCal('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleSelectPresetFood = async (food) => {
    await addMealLog({
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      mealType: selectedMealType,
    });
    setModalVisible(false);
    await loadData();
  };

  const handleAddCustomFood = async () => {
    if (!foodName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên món ăn!');
      return;
    }
    const cal = parseInt(foodCal, 10);
    if (!cal || cal <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số calo hợp lệ!');
      return;
    }

    await addMealLog({
      name: foodName.trim(),
      calories: cal,
      protein: parseFloat(foodProtein) || 0,
      carbs: parseFloat(foodCarbs) || 0,
      fat: parseFloat(foodFat) || 0,
      mealType: selectedMealType,
    });

    setModalVisible(false);
    await loadData();
  };

  const handleDeleteItem = async (id, name) => {
    Alert.alert('Xác nhận', `Bạn muốn xóa món "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await deleteMealLog(id);
          await loadData();
        },
      },
    ]);
  };

  const MEAL_TYPES = [
    { key: 'Sáng', title: 'Bữa sáng', icon: 'sunny-outline', color: '#F59E0B' },
    { key: 'Trưa', title: 'Bữa trưa', icon: 'restaurant-outline', color: '#10B981' },
    { key: 'Tối', title: 'Bữa tối', icon: 'moon-outline', color: '#6366F1' },
    { key: 'Phụ', title: 'Bữa phụ & Tráng miệng', icon: 'ice-cream-outline', color: '#EC4899' },
  ];

  const filteredPresetFoods = POPULAR_FOODS.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overview Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Năng lượng hôm nay</Text>
          <Text style={styles.overviewTarget}>Mục tiêu: {targetCalories} kcal</Text>
        </View>

        <View style={styles.caloriesNumberRow}>
          <Text style={styles.bigCalNumber}>{totalCalories}</Text>
          <Text style={styles.calUnit}>kcal đã nạp ({calPercent}%)</Text>
        </View>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${calPercent}%`,
                backgroundColor: calPercent > 100 ? COLORS.danger : COLORS.accent,
              },
            ]}
          />
        </View>

        {/* Macros Breakdown */}
        <View style={styles.macroRow}>
          <View style={styles.macroBox}>
            <Text style={[styles.macroVal, { color: '#EF4444' }]}>{Math.round(totalProtein)}g</Text>
            <Text style={styles.macroLabel}>Chất đạm (P)</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroVal, { color: '#F59E0B' }]}>{Math.round(totalCarbs)}g</Text>
            <Text style={styles.macroLabel}>Tinh bột (C)</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroVal, { color: '#10B981' }]}>{Math.round(totalFat)}g</Text>
            <Text style={styles.macroLabel}>Chất béo (F)</Text>
          </View>
        </View>
      </View>

      {/* Meal Sections */}
      {MEAL_TYPES.map((section) => {
        const sectionMeals = meals.filter((m) => m.mealType === section.key);
        const sectionTotal = sectionMeals.reduce((s, i) => s + i.calories, 0);

        return (
          <View key={section.key} style={styles.mealSectionCard}>
            <View style={styles.mealSectionHeader}>
              <View style={styles.mealSectionLeft}>
                <View style={[styles.mealIconCircle, { backgroundColor: `${section.color}20` }]}>
                  <Ionicons name={section.icon} size={18} color={section.color} />
                </View>
                <View>
                  <Text style={styles.mealSectionTitle}>{section.title}</Text>
                  <Text style={styles.mealSectionSub}>{sectionTotal} kcal</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.addFoodMiniBtn}
                onPress={() => handleOpenAddModal(section.key)}
              >
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.addFoodMiniText}>Thêm món</Text>
              </TouchableOpacity>
            </View>

            {/* List meals inside this section */}
            {sectionMeals.length === 0 ? (
              <Text style={styles.noMealText}>Chưa ghi món ăn cho bữa này.</Text>
            ) : (
              <View style={styles.foodItemList}>
                {sectionMeals.map((item) => (
                  <View key={item.id} style={styles.foodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodItemName}>{item.name}</Text>
                      <Text style={styles.foodItemMacros}>
                        {item.calories} kcal • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.id, item.name)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Modal: Add Food */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm vào {selectedMealType}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Search popular foods */}
            <Text style={styles.modalSectionLabel}>Món ăn phổ biến gợi ý</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm món (Phở, Cơm tấm, Trứng...)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.presetFoodList}>
              {filteredPresetFoods.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.presetFoodCard}
                  onPress={() => handleSelectPresetFood(f)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetFoodName}>{f.name}</Text>
                    <Text style={styles.presetFoodSub}>
                      {f.unit} • P: {f.protein}g | C: {f.carbs}g | F: {f.fat}g
                    </Text>
                  </View>
                  <View style={styles.presetCalBadge}>
                    <Text style={styles.presetCalText}>{f.calories} kcal</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom food input */}
            <Text style={[styles.modalSectionLabel, { marginTop: 24 }]}>Hoặc tự nhập món mới</Text>
            <View style={styles.customForm}>
              <TextInput
                style={styles.inputField}
                placeholder="Tên món ăn *"
                value={foodName}
                onChangeText={setFoodName}
              />
              <TextInput
                style={styles.inputField}
                placeholder="Số Calo (kcal) *"
                keyboardType="numeric"
                value={foodCal}
                onChangeText={setFoodCal}
              />

              <View style={styles.macroInputRow}>
                <TextInput
                  style={[styles.inputField, { flex: 1 }]}
                  placeholder="Đạm (P) g"
                  keyboardType="numeric"
                  value={foodProtein}
                  onChangeText={setFoodProtein}
                />
                <TextInput
                  style={[styles.inputField, { flex: 1 }]}
                  placeholder="Carb (C) g"
                  keyboardType="numeric"
                  value={foodCarbs}
                  onChangeText={setFoodCarbs}
                />
                <TextInput
                  style={[styles.inputField, { flex: 1 }]}
                  placeholder="Béo (F) g"
                  keyboardType="numeric"
                  value={foodFat}
                  onChangeText={setFoodFat}
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddCustomFood}>
                <Ionicons name="add-circle" size={20} color={COLORS.white} />
                <Text style={styles.submitBtnText}>Lưu món ăn này</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  overviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    marginBottom: 20,
    ...SHADOW,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  overviewTarget: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  caloriesNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  bigCalNumber: {
    fontSize: SIZES.huge,
    fontWeight: '900',
    color: COLORS.text,
  },
  calUnit: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  macroBox: {
    alignItems: 'center',
    flex: 1,
  },
  macroVal: {
    fontSize: SIZES.base,
    fontWeight: '800',
  },
  macroLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  mealSectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...SHADOW,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealSectionTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.text,
  },
  mealSectionSub: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  addFoodMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  addFoodMiniText: {
    fontSize: SIZES.xs,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  noMealText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  foodItemList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    gap: 8,
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  foodItemName: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  foodItemMacros: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSectionLabel: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: SIZES.sm,
    color: COLORS.text,
  },
  presetFoodList: {
    gap: 8,
  },
  presetFoodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetFoodName: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  presetFoodSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  presetCalBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  presetCalText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: '#B45309',
  },
  customForm: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    gap: 10,
    ...SHADOW,
    marginBottom: 30,
  },
  inputField: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: SIZES.sm,
    color: COLORS.text,
  },
  macroInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: SIZES.base,
  },
});
