import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_PROFILE: '@fitlife_user_profile',
  WATER_LOGS: '@fitlife_water_logs',
  WORKOUT_LOGS: '@fitlife_workout_logs',
  MEAL_LOGS: '@fitlife_meal_logs',
  BMI_HISTORY: '@fitlife_bmi_history',
  COINS: '@fitlife_coins',
  DAILY_QUESTS: '@fitlife_daily_quests',
  SLEEP_LOGS: '@fitlife_sleep_logs',
  MOOD_LOGS: '@fitlife_mood_logs',
  BOWEL_LOGS: '@fitlife_bowel_logs',
  CHALLENGES: '@fitlife_challenges',
};

export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- Profile & Settings ---
export const saveUserProfile = async (profile) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
    return true;
  } catch (e) {
    console.error('Error saving profile', e);
    return false;
  }
};

export const getUserProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    if (raw) return JSON.parse(raw);
    return {
      name: 'Người dùng FitLife',
      gender: 'male', // 'male' | 'female'
      age: 23,
      height: 170, // cm
      weight: 65,  // kg
      activityLevel: 'moderate', // sedentary, light, moderate, active
      targetWater: 2200, // ml
      targetCalories: 2000, // kcal
    };
  } catch (e) {
    console.error('Error getting profile', e);
    return null;
  }
};

// --- Water Tracker ---
export const getWaterLogsToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATER_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    return logs.filter((log) => log.date === today);
  } catch (e) {
    console.error('Error reading water logs', e);
    return [];
  }
};

export const addWaterLog = async (amount) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATER_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const newEntry = {
      id: Date.now().toString(),
      amount: Number(amount),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: getTodayKey(),
    };
    logs.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.WATER_LOGS, JSON.stringify(logs.slice(0, 100)));
    return newEntry;
  } catch (e) {
    console.error('Error adding water log', e);
    return null;
  }
};

export const resetWaterToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATER_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    const remaining = logs.filter((log) => log.date !== today);
    await AsyncStorage.setItem(KEYS.WATER_LOGS, JSON.stringify(remaining));
    return true;
  } catch (e) {
    console.error('Error resetting water', e);
    return false;
  }
};

// --- Workout Logs ---
export const getWorkoutLogsToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WORKOUT_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    return logs.filter((log) => log.date === today);
  } catch (e) {
    console.error('Error reading workouts', e);
    return [];
  }
};

export const addWorkoutLog = async (workout) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WORKOUT_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const newEntry = {
      id: Date.now().toString(),
      title: workout.title,
      durationSec: workout.durationSec || 0,
      calories: workout.calories || 0,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: getTodayKey(),
    };
    logs.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.WORKOUT_LOGS, JSON.stringify(logs.slice(0, 100)));
    return newEntry;
  } catch (e) {
    console.error('Error adding workout', e);
    return null;
  }
};

// --- Meal & Calorie Logs ---
export const getMealLogsToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MEAL_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    return logs.filter((log) => log.date === today);
  } catch (e) {
    console.error('Error reading meal logs', e);
    return [];
  }
};

export const addMealLog = async (meal) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MEAL_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const newEntry = {
      id: Date.now().toString(),
      name: meal.name,
      mealType: meal.mealType || 'Trưa', // Sáng, Trưa, Tối, Phụ
      calories: Number(meal.calories || 0),
      protein: Number(meal.protein || 0),
      carbs: Number(meal.carbs || 0),
      fat: Number(meal.fat || 0),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: getTodayKey(),
    };
    logs.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.MEAL_LOGS, JSON.stringify(logs.slice(0, 100)));
    return newEntry;
  } catch (e) {
    console.error('Error adding meal', e);
    return null;
  }
};

export const deleteMealLog = async (id) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MEAL_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const updated = logs.filter((item) => item.id !== id);
    await AsyncStorage.setItem(KEYS.MEAL_LOGS, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Error deleting meal', e);
    return false;
  }
};

// --- BMI History ---
export const getBmiHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BMI_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading BMI history', e);
    return [];
  }
};

export const addBmiRecord = async (record) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BMI_HISTORY);
    const history = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const newEntry = {
      id: Date.now().toString(),
      weight: record.weight,
      height: record.height,
      bmi: record.bmi,
      category: record.category,
      color: record.color,
      date: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    history.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.BMI_HISTORY, JSON.stringify(history.slice(0, 30)));
    return newEntry;
  } catch (e) {
    console.error('Error saving BMI', e);
    return null;
  }
};

// --- Coins ---
export const getCoins = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COINS);
    return raw !== null ? Number(raw) : 150;
  } catch (e) {
    return 150;
  }
};

export const addCoins = async (amount) => {
  try {
    const current = await getCoins();
    const updated = current + amount;
    await AsyncStorage.setItem(KEYS.COINS, updated.toString());
    return updated;
  } catch (e) {
    return 150;
  }
};

// --- Daily Quests ---
export const getDailyQuests = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DAILY_QUESTS);
    const today = getTodayKey();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today && parsed.quests) {
        return parsed.quests;
      }
    }
    // Default initial quests
    const defaultQuests = [
      { id: 'q_weight', title: 'Weight', subtitle: 'Log your weight progress.', icon: 'scale-outline', iconColor: '#B45309', bgColor: '#FEF08A', reward: 10, completed: false, value: null },
      { id: 'q_water', title: 'Water intake', subtitle: 'Monitor daily water intake.', icon: 'water-outline', iconColor: '#0369A1', bgColor: '#BAE6FD', reward: 10, completed: false, value: null },
      { id: 'q_meals', title: 'Meals', subtitle: "What's on your plate?", icon: 'restaurant-outline', iconColor: '#BE185D', bgColor: '#FBCFE8', reward: 10, completed: false, value: null },
      { id: 'q_sleep', title: 'Sleep', subtitle: 'Log your sleep duration.', icon: 'bed-outline', iconColor: '#15803D', bgColor: '#BBF7D0', reward: 10, completed: false, value: null },
      { id: 'q_mood', title: 'Mood', subtitle: "How's your mood?", icon: 'happy-outline', iconColor: '#0F766E', bgColor: '#99F6E4', reward: 10, completed: false, value: null },
      { id: 'q_bowel', title: 'Bowel Movement', subtitle: 'Track your gut health.', icon: 'fitness-outline', iconColor: '#C2410C', bgColor: '#FED7AA', reward: 10, completed: false, value: null },
      { id: 'q_workout', title: 'Workout', subtitle: 'Finish a 15-min workout session.', icon: 'barbell-outline', iconColor: '#6D28D9', bgColor: '#DDD6FE', reward: 10, completed: false, value: null },
    ];
    await AsyncStorage.setItem(KEYS.DAILY_QUESTS, JSON.stringify({ date: today, quests: defaultQuests }));
    return defaultQuests;
  } catch (e) {
    return [];
  }
};

export const saveDailyQuests = async (quests) => {
  try {
    const today = getTodayKey();
    await AsyncStorage.setItem(KEYS.DAILY_QUESTS, JSON.stringify({ date: today, quests }));
    return true;
  } catch (e) {
    return false;
  }
};

export const completeQuest = async (questId, extraValue = null) => {
  try {
    const quests = await getDailyQuests();
    let rewardGiven = 0;
    const updated = quests.map((q) => {
      if (q.id === questId && !q.completed) {
        rewardGiven = q.reward || 10;
        return { ...q, completed: true, value: extraValue };
      }
      return q;
    });
    await saveDailyQuests(updated);
    if (rewardGiven > 0) {
      await addCoins(rewardGiven);
    }
    return { updated, rewardGiven };
  } catch (e) {
    return { updated: [], rewardGiven: 0 };
  }
};

// --- Sleep Log ---
export const getSleepToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SLEEP_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    return logs.find((l) => l.date === today) || null;
  } catch (e) {
    return null;
  }
};

export const saveSleepToday = async (hours, quality) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SLEEP_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    const filtered = logs.filter((l) => l.date !== today);
    const newEntry = { date: today, hours: Number(hours), quality };
    filtered.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.SLEEP_LOGS, JSON.stringify(filtered.slice(0, 30)));
    await completeQuest('q_sleep', `${hours} hrs`);
    return newEntry;
  } catch (e) {
    return null;
  }
};

// --- Mood Log ---
export const getMoodToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MOOD_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    return logs.find((l) => l.date === today) || null;
  } catch (e) {
    return null;
  }
};

export const saveMoodToday = async (mood, note) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MOOD_LOGS);
    const logs = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    const filtered = logs.filter((l) => l.date !== today);
    const newEntry = { date: today, mood, note };
    filtered.unshift(newEntry);
    await AsyncStorage.setItem(KEYS.MOOD_LOGS, JSON.stringify(filtered.slice(0, 30)));
    await completeQuest('q_mood', mood);
    return newEntry;
  } catch (e) {
    return null;
  }
};


// ===================== Persistence for Shop / Challenges / Steps / Weekly stats =====================
const EXTRA_KEYS = {
  PURCHASES: '@fitlife_purchases',
  STEPS: '@fitlife_steps',
  CHALLENGES_V2: '@fitlife_challenges_v2',
  AI_API_KEY: '@fitlife_ai_api_key',
  AI_CHAT_HISTORY: '@fitlife_ai_chat_history',
  AUTH_SESSION: '@fitlife_auth_session',
  AUTH_ACCOUNTS: '@fitlife_auth_accounts',
};

const lastNDayKeys = (n) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()],
    });
  }
  return out;
};

// --- Shop purchases ---
export const getPurchases = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.PURCHASES);
    return raw ? JSON.parse(raw) : ['badge_1'];
  } catch (e) {
    return ['badge_1'];
  }
};

export const addPurchase = async (id) => {
  try {
    const current = await getPurchases();
    if (!current.includes(id)) current.push(id);
    await AsyncStorage.setItem(EXTRA_KEYS.PURCHASES, JSON.stringify(current));
    return current;
  } catch (e) {
    return [];
  }
};

// --- Steps (per day) ---
export const getStepsToday = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.STEPS);
    const map = raw ? JSON.parse(raw) : {};
    return map[getTodayKey()] ?? 7420;
  } catch (e) {
    return 7420;
  }
};

export const addStepsToday = async (amount) => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.STEPS);
    const map = raw ? JSON.parse(raw) : {};
    const key = getTodayKey();
    map[key] = (map[key] ?? 7420) + amount;
    await AsyncStorage.setItem(EXTRA_KEYS.STEPS, JSON.stringify(map));
    return map[key];
  } catch (e) {
    return 7420;
  }
};

// --- Challenges ---
export const getSavedChallenges = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.CHALLENGES_V2);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const saveChallenges = async (list) => {
  try {
    await AsyncStorage.setItem(EXTRA_KEYS.CHALLENGES_V2, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
};

// --- Weekly statistics built from real stored logs ---
export const getWeeklyStats = async () => {
  try {
    const days = lastNDayKeys(7);
    const [waterRaw, stepsRaw, bmiRaw, sleepRaw, profile] = await Promise.all([
      AsyncStorage.getItem(KEYS.WATER_LOGS),
      AsyncStorage.getItem(EXTRA_KEYS.STEPS),
      AsyncStorage.getItem(KEYS.BMI_HISTORY),
      AsyncStorage.getItem(KEYS.SLEEP_LOGS),
      getUserProfile(),
    ]);
    const waterLogs = waterRaw ? JSON.parse(waterRaw) : [];
    const stepsMap = stepsRaw ? JSON.parse(stepsRaw) : {};
    const sleepLogs = sleepRaw ? JSON.parse(sleepRaw) : [];

    const water = days.map((d) => ({
      day: d.label,
      amount: waterLogs.filter((l) => l.date === d.key).reduce((s, l) => s + l.amount, 0),
    }));
    const steps = days.map((d) => ({ day: d.label, steps: stepsMap[d.key] ?? 0 }));
    const sleep = days.map((d) => {
      const found = sleepLogs.find((l) => l.date === d.key);
      return { day: d.label, hours: found ? found.hours : 0 };
    });

    // Weight: carry the last known weight forward across the week
    const bmiHistory = bmiRaw ? JSON.parse(bmiRaw) : [];
    let lastWeight = profile?.weight ?? 65;
    const weight = days.map((d) => {
      const [dd, mm, yy] = [d.key.slice(8), d.key.slice(5, 7), d.key.slice(0, 4)];
      const label = `${Number(dd)}/${Number(mm)}/${yy}`;
      const rec = bmiHistory.find((r) => r.date === label);
      if (rec) lastWeight = rec.weight;
      return { day: d.label, weight: lastWeight };
    });

    return { water, steps, sleep, weight, waterTarget: profile?.targetWater || 2200 };
  } catch (e) {
    return null;
  }
};

// --- AI Coach Settings & History ---
export const getAiApiKey = async () => {
  try {
    const key = await AsyncStorage.getItem(EXTRA_KEYS.AI_API_KEY);
    return key || '';
  } catch (e) {
    return '';
  }
};

export const saveAiApiKey = async (key) => {
  try {
    await AsyncStorage.setItem(EXTRA_KEYS.AI_API_KEY, (key || '').trim());
    return true;
  } catch (e) {
    return false;
  }
};

export const getAiChatHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.AI_CHAT_HISTORY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const saveAiChatHistory = async (messages) => {
  try {
    await AsyncStorage.setItem(
      EXTRA_KEYS.AI_CHAT_HISTORY,
      JSON.stringify((messages || []).slice(-40))
    );
    return true;
  } catch (e) {
    return false;
  }
};

export const clearAiChatHistory = async () => {
  try {
    await AsyncStorage.removeItem(EXTRA_KEYS.AI_CHAT_HISTORY);
    return true;
  } catch (e) {
    return false;
  }
};

// --- Authentication & Account Management ---
export const getAuthSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.AUTH_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const saveAuthSession = async (session) => {
  try {
    await AsyncStorage.setItem(EXTRA_KEYS.AUTH_SESSION, JSON.stringify(session));
    return true;
  } catch (e) {
    return false;
  }
};

export const clearAuthSession = async () => {
  try {
    await AsyncStorage.removeItem(EXTRA_KEYS.AUTH_SESSION);
    return true;
  } catch (e) {
    return false;
  }
};

export const getRegisteredAccounts = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_KEYS.AUTH_ACCOUNTS);
    const list = raw ? JSON.parse(raw) : [];
    // Pre-populate with a demo account if empty
    if (list.length === 0) {
      list.push({
        id: 'acc_demo',
        name: 'Nguyễn Thành Nam',
        email: 'demo@fitlife.app',
        password: '123',
        createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem(EXTRA_KEYS.AUTH_ACCOUNTS, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return [];
  }
};

export const registerAccount = async (name, email, password) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const accounts = await getRegisteredAccounts();

    if (accounts.some((a) => a.email === cleanEmail)) {
      return { success: false, message: 'Email này đã được đăng ký tài khoản!' };
    }

    const newAcc = {
      id: Date.now().toString(),
      name: cleanName,
      email: cleanEmail,
      password,
      createdAt: new Date().toISOString(),
    };

    accounts.push(newAcc);
    await AsyncStorage.setItem(EXTRA_KEYS.AUTH_ACCOUNTS, JSON.stringify(accounts));

    // Save current session & update user profile name
    const session = {
      isLoggedIn: true,
      user: { id: newAcc.id, name: cleanName, email: cleanEmail },
      isGuest: false,
    };
    await saveAuthSession(session);

    // Update profile
    const prof = (await getUserProfile()) || {};
    prof.name = cleanName;
    await saveUserProfile(prof);

    return { success: true, user: session.user };
  } catch (e) {
    return { success: false, message: 'Lỗi đăng ký tài khoản: ' + e.message };
  }
};

export const loginAccount = async (email, password) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const accounts = await getRegisteredAccounts();

    // Check credentials
    const found = accounts.find((a) => a.email === cleanEmail && a.password === password);
    if (!found) {
      return { success: false, message: 'Email hoặc mật khẩu không chính xác!' };
    }

    const session = {
      isLoggedIn: true,
      user: { id: found.id, name: found.name, email: found.email },
      isGuest: false,
    };
    await saveAuthSession(session);

    // Update profile name
    const prof = (await getUserProfile()) || {};
    prof.name = found.name;
    await saveUserProfile(prof);

    return { success: true, user: session.user };
  } catch (e) {
    return { success: false, message: 'Lỗi đăng nhập: ' + e.message };
  }
};

export const loginAsGuest = async () => {
  try {
    const session = {
      isLoggedIn: true,
      user: { id: 'guest', name: 'Khách Demo', email: 'guest@fitlife.local' },
      isGuest: true,
    };
    await saveAuthSession(session);
    return { success: true, user: session.user };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
