// Giá trị khớp backend: auth/registration.js, services/meal.service.js, services/daily-log.service.js.
export const ACTIVITY = [
  { value: 'sedentary', label: 'Ít vận động', hint: 'Ngồi nhiều, hầu như không tập' },
  { value: 'light', label: 'Vận động nhẹ', hint: 'Tập 1–3 buổi/tuần' },
  { value: 'moderate', label: 'Vận động vừa', hint: 'Tập 3–5 buổi/tuần' },
  { value: 'active', label: 'Vận động nhiều', hint: 'Tập 6–7 buổi/tuần' },
];
export const GOALS = [
  { value: 'lose', label: 'Giảm cân' },
  { value: 'maintain', label: 'Giữ cân' },
  { value: 'gain', label: 'Tăng cân' },
];
export const GENDERS = [{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }];
export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Bữa sáng' },
  { value: 'lunch', label: 'Bữa trưa' },
  { value: 'dinner', label: 'Bữa tối' },
  { value: 'snack', label: 'Ăn vặt' },
];
export const SLEEP_QUALITIES = ['Sâu', 'Bình thường', 'Chập chờn'];
export const MOODS = ['Tuyệt vời', 'Vui', 'Bình thường', 'Mệt mỏi', 'Căng thẳng', 'Buồn'];
export const WORKOUT_CATEGORIES = ['Cardio', 'Sức mạnh', 'HIIT', 'Yoga', 'Đi bộ', 'Khác'];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? '—';
export const fmt = (n) => Math.round(n ?? 0).toLocaleString('vi-VN');
