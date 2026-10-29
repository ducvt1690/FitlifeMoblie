import { INITIAL_API_EXERCISES, normalizeApiExercise } from '../utils/exerciseApi';

export const HEALTH_TIPS = [
  "Uống một ly nước ấm ngay khi thức dậy giúp đánh thức hệ tiêu hóa và đào thải độc tố.",
  "Duy trì ít nhất 7-8 tiếng ngủ mỗi đêm để cơ bắp phục hồi và tăng cường hệ miễn dịch.",
  "Nhai kỹ no lâu: Ăn chậm giúp dạ dày truyền tín hiệu no lên não kịp thời, tránh ăn quá mức.",
  "Mỗi 45 phút ngồi làm việc, hãy đứng dậy vươn vai và đi lại nhẹ nhàng trong 2-3 phút.",
  "Ăn nhiều rau xanh và củ quả nhiều màu sắc giúp bổ sung đa dạng vi chất và chất chống oxy hóa.",
  "Tập luyện 20-30 phút mỗi ngày mang lại hiệu quả bền vững hơn là dồn sức tập 2 tiếng cuối tuần.",
  "Hạn chế đồ uống có đường tinh luyện, thay bằng nước lọc, nước chanh hoặc trà thảo mộc.",
];

export const WORKOUT_CATEGORIES = [
  { id: 'all', name: 'Tất cả (API)', icon: 'grid-outline' },
  { id: 'cardio', name: 'Cardio', icon: 'pulse-outline' },
  { id: 'chest', name: 'Ngực (Chest)', icon: 'fitness-outline' },
  { id: 'back', name: 'Lưng (Back)', icon: 'body-outline' },
  { id: 'waist', name: 'Eo & Bụng', icon: 'flame-outline' },
  { id: 'upper arms', name: 'Tay (Arms)', icon: 'barbell-outline' },
  { id: 'shoulders', name: 'Vai (Shoulders)', icon: 'accessibility-outline' },
  { id: 'upper legs', name: 'Đùi & Mông', icon: 'walk-outline' },
  { id: 'lower legs', name: 'Bắp chân', icon: 'footsteps-outline' },
];

// Default exercises normalized from ExerciseDB API
export const EXERCISES = INITIAL_API_EXERCISES.map(normalizeApiExercise);

export const POPULAR_FOODS = [
  { id: 'f1', name: 'Phở bò tái', calories: 430, protein: 28, carbs: 55, fat: 10, unit: '1 tô vừa' },
  { id: 'f2', name: 'Cơm tấm sườn bì chả', calories: 650, protein: 32, carbs: 75, fat: 22, unit: '1 dĩa' },
  { id: 'f3', name: 'Bánh mì thịt chả', calories: 380, protein: 18, carbs: 48, fat: 12, unit: '1 ổ' },
  { id: 'f4', name: 'Ức gà áp chảo (150g)', calories: 240, protein: 46, carbs: 0, fat: 5, unit: '1 phần' },
  { id: 'f5', name: 'Trứng gà luộc/ốp la', calories: 78, protein: 6.5, carbs: 0.6, fat: 5.3, unit: '1 quả' },
  { id: 'f6', name: 'Bún chả Hà Nội', calories: 520, protein: 25, carbs: 62, fat: 18, unit: '1 suất' },
  { id: 'f7', name: 'Khoai lang luộc', calories: 120, protein: 2, carbs: 28, fat: 0.2, unit: '1 củ vừa' },
  { id: 'f8', name: 'Salad cá ngừ dầu giấm', calories: 180, protein: 20, carbs: 8, fat: 7, unit: '1 tô' },
  { id: 'f9', name: 'Chuối già chín', calories: 95, protein: 1.2, carbs: 23, fat: 0.3, unit: '1 trái' },
  { id: 'f10', name: 'Sữa chua không đường', calories: 85, protein: 5, carbs: 6, fat: 4, unit: '1 hộp' },
];
