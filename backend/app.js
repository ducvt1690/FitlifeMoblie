'use strict';

const express = require('express');
const cors = require('cors');
const { createProfileRouter } = require('./routes/profile.routes');
const { createWaterRouter } = require('./routes/water.routes');
const { createWorkoutRouter } = require('./routes/workout.routes');
const { createExerciseRouter } = require('./routes/exercise.routes');
const { createMealRouter } = require('./routes/meal.routes');
const { createQuestRouter } = require('./routes/quest.routes');
const { createAuthRouter } = require('./routes/auth.routes');
const { createDailyLogRouter } = require('./routes/daily-log.routes');
const { createBmiRouter } = require('./routes/bmi.routes');
const { createChallengeRouter } = require('./routes/challenge.routes');
const { createRewardRouter } = require('./routes/reward.routes');
const { createStatsRouter } = require('./routes/stats.routes');
const { createChatRouter } = require('./routes/chat.routes');
const { DEFAULT_SESSION_TTL_SECONDS } = require('./auth/session');
const { HttpError } = require('./utils/http-error');
const { corsOptions } = require('./utils/cors-options');

function createApp({ db, sessionTtlSeconds = DEFAULT_SESSION_TTL_SECONDS, corsOrigins, ai, logger = console }) {
  if (!db) throw new Error('A connected MongoDB database is required.');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(corsOrigins)));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  const parseJSON = express.json({ limit: '16kb' });
  app.use((req, res, next) => {
    parseJSON(req, res, (error) => {
      if (!error) return next();
      // Only parser errors can set these client statuses. Never expose the
      // parser's raw error: it may contain the submitted login credentials.
      const messages = {
        400: 'JSON hoặc nội dung nén không hợp lệ.',
        413: 'Nội dung yêu cầu quá lớn.',
        415: 'Charset hoặc encoding của yêu cầu không được hỗ trợ.',
      };
      if (Object.hasOwn(messages, error.status)) {
        return res.status(error.status).json({ success: false, message: messages[error.status] });
      }
      return next(error);
    });
  });
  app.get('/', (req, res) => {
    res.json({
      status: 'online', project: 'FitLife Health & MMA API', version: '2.0.0',
      endpoints: {
        auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me'],
        profile: ['GET /api/profile', 'PATCH /api/profile'],
        water: ['GET /api/water-logs', 'POST /api/water-logs'],
        workouts: ['GET /api/workout-logs', 'POST /api/workout-logs'],
        exercises: ['GET /api/exercises', 'GET /api/exercises/:exerciseId'],
        meals: ['GET /api/meal-logs', 'POST /api/meal-logs', 'PATCH /api/meal-logs/:mealId', 'DELETE /api/meal-logs/:mealId'],
        quests: ['GET /api/quests', 'POST /api/quests/checkin'],
        sleep: ['GET /api/sleep-logs', 'PUT /api/sleep-logs'],
        mood: ['GET /api/mood-logs', 'PUT /api/mood-logs'],
        bmi: ['GET /api/bmi-records', 'POST /api/bmi-records'],
        challenges: ['GET /api/challenges', 'POST /api/challenges/:challengeId/join', 'POST /api/challenges/:challengeId/checkin'],
        rewards: ['GET /api/rewards', 'POST /api/rewards/:itemId/purchase'],
        stats: ['GET /api/stats'],
        chat: ['GET /api/chat/sessions', 'GET /api/chat/sessions/:sessionId/messages', 'POST /api/chat/messages'],
      },
    });
  });
  app.get('/health', async (req, res, next) => {
    try {
      await db.command({ ping: 1 });
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) { next(error); }
  });
  app.use('/api/auth', createAuthRouter({ db, sessionTtlSeconds }));
  app.use('/api/profile', createProfileRouter({ db }));
  app.use('/api/water-logs', createWaterRouter({ db }));
  app.use('/api/workout-logs', createWorkoutRouter({ db }));
  app.use('/api/exercises', createExerciseRouter({ db }));
  app.use('/api/meal-logs', createMealRouter({ db }));
  app.use('/api/quests', createQuestRouter({ db }));
  app.use('/api/sleep-logs', createDailyLogRouter({ db, kind: 'sleep' }));
  app.use('/api/mood-logs', createDailyLogRouter({ db, kind: 'mood' }));
  app.use('/api/bmi-records', createBmiRouter({ db }));
  app.use('/api/challenges', createChallengeRouter({ db }));
  app.use('/api/rewards', createRewardRouter({ db }));
  app.use('/api/stats', createStatsRouter({ db }));
  app.use('/api/chat', createChatRouter({ db, ai }));
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint không tồn tại.' });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    const unavailable = /^(MongoNetwork|MongoServerSelection|MongoTopologyClosed|MongoNotConnected)/.test(error.name || '');
    // Driver errors can contain credentials or query data; log only the type.
    logger.error?.('API request failed:', error.name || 'Error');
    return res.status(unavailable ? 503 : 500).json({
      success: false,
      message: unavailable ? 'Tạm thời không kết nối được database.' : 'Không thể xử lý yêu cầu lúc này.',
    });
  });
  return app;
}

module.exports = { createApp };
