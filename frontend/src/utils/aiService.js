import { getUserProfile, getWaterLogsToday, getWorkoutLogsToday, getMealLogsToday, getSleepToday, getMoodToday, sendChat, newId } from './storage';
export const loadRealtimeHealthContext = async () => {
  const [profile, water, workouts, meals, sleep, mood] = await Promise.all([getUserProfile(), getWaterLogsToday(), getWorkoutLogsToday(), getMealLogsToday(), getSleepToday(), getMoodToday()]);
  return {
    profile,
    water,
    workouts,
    meals,
    sleep,
    mood
  };
};
export const askFitLifeAi = async (question, sessionId = newId(), messageId = newId()) => {
  const response = await sendChat(sessionId, question, messageId);
  return {
    text: response.reply.content,
    source: response.reply.ai_engine,
    sessionId
  };
};
