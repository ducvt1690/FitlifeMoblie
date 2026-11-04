// Server data is never replaced with local balances, passwords or mock logs.
import { request, setToken, newId } from './apiClient';
export { newId } from './apiClient';
const post = (path, body) => request(path, body, 'POST', {
  retry: true
});
const put = (path, body) => request(path, body, 'PUT', {
  retry: true
});
const toProfile = p => ({
  ...p,
  name: p.full_name,
  activityLevel: p.activity_level,
  targetWater: p.target_water,
  targetCalories: p.target_calories,
  coins: p.fit_coins,
  streak: p.streak_days
});
export const getTodayKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
export const getUserProfile = async () => toProfile((await request('/api/profile')).profile);
export const saveUserProfile = async profile => {
  const fields = {
    full_name: profile.name,
    email: profile.email,
    gender: profile.gender,
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    activity_level: profile.activityLevel,
    goal: profile.goal
  };
  if (profile.date_of_birth) fields.date_of_birth = profile.date_of_birth;
  const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return toProfile((await request('/api/profile', body, 'PATCH')).profile);
};
const mapWater = l => ({
  ...l,
  id: l.log_id,
  date: l.log_date,
  time: l.log_time
});
export const getWaterLogsToday = async () => (await request('/api/water-logs')).logs.map(mapWater);
export const addWaterLog = async (amount, id = newId()) => mapWater((await post('/api/water-logs', {
  log_id: id,
  amount: Number(amount)
})).log);
const mapWorkout = l => ({
  ...l,
  id: l.workout_id,
  date: l.workout_date,
  durationSec: l.duration_seconds,
  calories: l.calories_burned
});
export const getWorkoutLogsToday = async () => (await request('/api/workout-logs')).logs.map(mapWorkout);
export const addWorkoutLog = async (w, id = newId()) => mapWorkout((await post('/api/workout-logs', {
  workout_id: id,
  title: w.title,
  category: w.category || 'Thể lực',
  duration_seconds: w.durationSec,
  calories_burned: w.calories || 0
})).log);
const mealTypes = {
  'Sáng': 'breakfast',
  'Trưa': 'lunch',
  'Tối': 'dinner',
  'Phụ': 'snack'
};
const mapMeal = l => ({
  ...l,
  id: l.meal_id,
  name: l.meal_name,
  date: l.meal_date,
  mealType: Object.keys(mealTypes).find(k => mealTypes[k] === l.meal_type) || 'Trưa'
});
export const getMealLogsToday = async () => (await request('/api/meal-logs')).logs.map(mapMeal);
export const addMealLog = async (m, id = newId()) => mapMeal((await post('/api/meal-logs', {
  meal_id: id,
  meal_name: m.name,
  meal_type: mealTypes[m.mealType] || 'lunch',
  calories: Number(m.calories),
  protein: Number(m.protein || 0),
  carbs: Number(m.carbs || 0),
  fat: Number(m.fat || 0)
})).log);
export const deleteMealLog = id => request('/api/meal-logs/' + id, undefined, 'DELETE');
export const updateMealLog = async (id, m) => mapMeal((await request('/api/meal-logs/' + id, {
  meal_name: m.name,
  meal_type: mealTypes[m.mealType] || 'lunch',
  calories: Number(m.calories),
  protein: Number(m.protein || 0),
  carbs: Number(m.carbs || 0),
  fat: Number(m.fat || 0)
}, 'PATCH')).meal);
export const getBmiHistory = async () => (await request('/api/bmi-records')).records.map(r => ({
  ...r,
  id: r.record_id,
  date: r.record_date,
  bmi: r.bmi_value,
  category: r.bmi_status,
  color: '#8DC61E'
}));
export const addBmiRecord = async () => (await post('/api/bmi-records', {})).record;
export const getCoins = async () => (await request('/api/quests')).fit_coins;
export const getStreak = async () => (await request('/api/quests')).streak_days;
const questIcons = {
  q_water: 'water-outline',
  q_workout: 'barbell-outline',
  q_meal: 'restaurant-outline',
  q_sleep: 'bed-outline',
  q_mood: 'happy-outline',
  q_checkin: 'checkmark-circle-outline',
  q_chat: 'chatbubbles-outline'
};
export const getDailyQuests = async () => (await request('/api/quests')).quests.map(q => ({
  ...q,
  id: q.quest_key,
  title: q.quest_title,
  completed: q.is_completed,
  reward: q.reward_coins,
  value: q.extra_value,
  icon: questIcons[q.quest_key],
  bgColor: '#E8FCCC',
  iconColor: '#3F6212',
  subtitle: 'Thưởng 10 xu một lần mỗi ngày'
}));
export const checkin = () => post('/api/quests/checkin', {});
export const completeQuest = async () => ({
  updated: await getDailyQuests(),
  rewardGiven: 0
}); // rewards belong to the log transaction
export const getSleepToday = async () => (await request('/api/sleep-logs')).log;
export const saveSleepToday = async (hours, quality) => (await put('/api/sleep-logs', {
  hours: Number(hours),
  quality: quality?.includes('sâu') ? 'Sâu' : quality?.includes('Chập') ? 'Chập chờn' : quality === 'Sâu' ? 'Sâu' : 'Bình thường'
})).log;
export const getMoodToday = async () => {
  const l = (await request('/api/mood-logs')).log;
  return l ? {
    ...l,
    mood: l.mood_label
  } : null;
};
export const saveMoodToday = (mood, note = '') => put('/api/mood-logs', {
  mood_label: mood,
  note
});
export const getShop = () => request('/api/rewards');
export const getPurchases = async () => (await getShop()).items.filter(i => i.owned).map(i => i.item_id);
export const buyItem = (id, purchaseId = newId()) => post(`/api/rewards/${id}/purchase`, {
  purchase_id: purchaseId
});
export const getChallenges = async () => (await request('/api/challenges')).challenges;
export const joinChallenge = id => request(`/api/challenges/${id}/join`, {}, 'POST');
export const checkinChallenge = id => request(`/api/challenges/${id}/checkin`, {}, 'POST');
export const getStats = (days = 7) => request('/api/stats?days=' + days);
export const getWeeklyStats = async () => {
  const [stats, bmi] = await Promise.all([getStats(), getBmiHistory()]);
  return {
    water: stats.days.map(d => ({
      day: d.date.slice(5),
      amount: d.water_ml
    })),
    sleep: stats.days.map(d => ({
      day: d.date.slice(5),
      hours: d.sleep_hours || 0
    })),
    steps: [],
    weight: stats.days.map(d => ({
      day: d.date.slice(5),
      weight: bmi.find(r => r.date <= d.date)?.weight ?? null
    })),
    waterTarget: stats.target_water
  };
};
export const getChatSessions = () => request('/api/chat/sessions');
export const getChatMessages = id => request(`/api/chat/sessions/${id}/messages`);
export const sendChat = (sessionId, content, messageId = newId()) => post('/api/chat/messages', {
  session_id: sessionId,
  message_id: messageId,
  content
});
export const getExercises = (params = {}) => request('/api/exercises?' + Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'));
export const getExercise = id => request('/api/exercises/' + id);
export const getCoaching = () => request('/api/coaching');
export const acceptTrainer = code => request('/api/coaching/links', {
  code
}, 'POST');
export const leaveTrainer = id => request('/api/coaching/links/' + id, undefined, 'DELETE');
export const finishAssignment = (id, action) => request(`/api/coaching/assignments/${id}/${action}`, {}, 'POST');
export const getAuthSession = async () => {
  try {
    const {
      user
    } = await request('/api/auth/me');
    if (user.role !== 'user') {
      await clearAuthSession();
      return null;
    }
    return {
      isLoggedIn: true,
      user
    };
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
};
export const clearAuthSession = async () => {
  try {
    await request('/api/auth/logout', undefined, 'POST');
  } finally {
    await setToken(null);
  }
};
async function acceptSession(data) {
  if (data.user.role !== 'user') {
    await setToken(data.token);
    await clearAuthSession();
    throw new Error('Tài khoản huấn luyện viên/quản trị sử dụng website.');
  }
  await setToken(data.token);
  return {
    success: true,
    user: data.user
  };
}
export const loginAccount = async (email, password) => {
  try {
    return await acceptSession(await request('/api/auth/login', {
      email: email.trim().toLowerCase(),
      password
    }, 'POST', {
      anonymous: true
    }));
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
};
export const registerAccount = async (name, email, password, profile) => {
  try {
    return await acceptSession(await request('/api/auth/register', {
      ...profile,
      full_name: name.trim(),
      email: email.trim().toLowerCase(),
      password
    }, 'POST', {
      anonymous: true
    }));
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
};
