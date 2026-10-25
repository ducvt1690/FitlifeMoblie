'use strict';

// Plain MongoDB validators: enforced on Atlas even when writes bypass an ODM/API.
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const DATE = '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
const uuid = { bsonType: 'string', pattern: UUID };
const day = { bsonType: 'string', pattern: DATE };
const timestamp = { bsonType: 'date' };
const text = (maxLength, minLength = 1) => ({ bsonType: 'string', minLength, maxLength });
const integer = (minimum = 0) => ({ bsonType: 'int', minimum });
const number = (minimum, maximum) => ({
  bsonType: ['int', 'long', 'double', 'decimal'], minimum,
  ...(maximum === undefined ? {} : { maximum }),
});
const choice = (...values) => ({ bsonType: 'string', enum: values });
const bool = { bsonType: 'bool' };
const weight = number(25, 300);
const height = number(80, 250);
const index = (key, name, options = {}) => ({ key, name, ...options });
const unique = (key, name, options = {}) => index(key, name, { unique: true, ...options });
const userDayIndex = (field) => index({ user_id: 1, [field]: -1 }, `by_user_${field}`);

const QUEST_KEYS = ['q_weight', 'q_water', 'q_meals', 'q_sleep', 'q_mood', 'q_bowel', 'q_workout'];

function collection(name, id, properties, indexes = [], required = Object.keys(properties), rules = {}) {
  return {
    name,
    id,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        title: `FitLife ${name}`,
        additionalProperties: false,
        required: [id, 'created_at', 'updated_at', ...required],
        properties: {
          _id: { bsonType: 'objectId' },
          [id]: uuid,
          created_at: timestamp,
          updated_at: timestamp,
          ...properties,
        },
        ...rules,
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
    indexes: [unique({ [id]: 1 }, `uq_${id}`), ...indexes],
  };
}

const collections = [
  collection('users', 'user_id', {
    email: {
      ...text(100, 3),
      // Canonical lowercase only, so case changes cannot bypass the unique index.
      pattern: '^[a-z0-9.!#$%&\u0027*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,}$',
    },
    password_hash: {
      ...text(1024, 40),
      pattern: '^(scrypt\\$|\\$2[aby]\\$|\\$argon2(id|i|d)\\$)',
    },
    full_name: text(100),
    gender: choice('male', 'female'),
    age: { ...integer(5), maximum: 100 },
    height,
    weight,
    activity_level: choice('sedentary', 'light', 'moderate', 'active'),
    goal: choice('lose', 'maintain', 'gain'),
    target_water: integer(500),
    target_calories: integer(800),
    fit_coins: integer(),
    streak_days: integer(),
    timezone: { ...text(100), pattern: '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+.-]+)*$' },
    streak_last_date: day,
  }, [unique({ email: 1 }, 'uq_user_email')], [
    'email', 'password_hash', 'full_name', 'gender', 'age', 'height', 'weight',
    'activity_level', 'goal', 'target_water', 'target_calories', 'fit_coins', 'streak_days', 'timezone',
  ]),

  collection('water_logs', 'log_id', {
    user_id: uuid,
    amount: integer(1),
    log_time: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    log_date: day,
  }, [userDayIndex('log_date')]),

  collection('workout_logs', 'workout_id', {
    user_id: uuid,
    title: text(150),
    category: text(50),
    duration_seconds: integer(1),
    calories_burned: integer(),
    workout_date: day,
  }, [userDayIndex('workout_date')]),

  collection('meal_logs', 'meal_id', {
    user_id: uuid,
    meal_name: text(150),
    calories: integer(1),
    protein: number(0),
    carbs: number(0),
    fat: number(0),
    meal_type: choice('breakfast', 'lunch', 'dinner', 'snack'),
    meal_date: day,
  }, [userDayIndex('meal_date')]),

  collection('daily_quest_logs', 'quest_log_id', {
    user_id: uuid,
    quest_key: choice(...QUEST_KEYS),
    quest_title: text(150),
    reward_coins: integer(),
    is_completed: bool,
    extra_value: text(500, 0),
    quest_date: day,
    completed_at: { bsonType: ['date', 'null'] },
  }, [unique({ user_id: 1, quest_date: 1, quest_key: 1 }, 'uq_user_day_quest')], [
    'user_id', 'quest_key', 'quest_title', 'reward_coins', 'is_completed', 'quest_date',
  ], {
    oneOf: [
      { properties: { is_completed: { enum: [true] }, completed_at: timestamp }, required: ['completed_at'] },
      { properties: { is_completed: { enum: [false] }, completed_at: { bsonType: 'null' } } },
    ],
  }),

  collection('bmi_history', 'record_id', {
    user_id: uuid,
    weight,
    height,
    bmi_value: number(0.01),
    bmi_status: choice('Thiếu cân', 'Cân đối', 'Thừa cân nhẹ', 'Tiền béo phì / Béo phì'),
    record_date: day,
  }, [userDayIndex('record_date')]),

  collection('sleep_logs', 'sleep_id', {
    user_id: uuid,
    hours: number(0, 24),
    quality: choice('Sâu', 'Bình thường', 'Chập chờn'),
    sleep_date: day,
  }, [userDayIndex('sleep_date')]),

  collection('mood_logs', 'mood_id', {
    user_id: uuid,
    mood_label: text(50),
    note: text(2000, 0),
    mood_date: day,
  }, [userDayIndex('mood_date')], ['user_id', 'mood_label', 'mood_date']),

  collection('challenges', 'challenge_id', {
    title: text(150),
    description: text(2000),
    target_days: integer(1),
    reward_coins: integer(),
    badge_icon: text(100),
    is_active: bool,
  }, [index({ is_active: 1, target_days: 1 }, 'by_active_duration')]),

  collection('user_challenges', 'id', {
    user_id: uuid,
    challenge_id: uuid,
    current_progress: integer(),
    is_completed: bool,
    joined_at: timestamp,
    last_checkin: { bsonType: ['date', 'null'] },
    last_checkin_date: day,
  }, [
    unique({ user_id: 1, challenge_id: 1 }, 'uq_user_challenge'),
    index({ challenge_id: 1, is_completed: 1 }, 'by_challenge_completion'),
  ], ['user_id', 'challenge_id', 'current_progress', 'is_completed', 'joined_at', 'last_checkin']),

  collection('reward_items', 'item_id', {
    title: text(100),
    category: choice('badge', 'theme', 'voucher'),
    cost_coins: integer(),
    icon: text(100),
    is_available: bool,
  }, [index({ is_available: 1, category: 1, cost_coins: 1 }, 'by_available_category_price')]),

  collection('purchases', 'purchase_id', {
    user_id: uuid,
    item_id: uuid,
    // Snapshot trusted from reward_items by the future backend, never from the client.
    item_category: choice('badge', 'theme', 'voucher'),
    spent_coins: integer(),
    purchased_at: timestamp,
  }, [
    unique({ user_id: 1, item_id: 1 }, 'uq_user_badge', { partialFilterExpression: { item_category: 'badge' } }),
    userDayIndex('purchased_at'),
    index({ item_id: 1 }, 'by_purchased_item'),
  ]),

  collection('ai_chat_messages', 'message_id', {
    user_id: uuid,
    sender: choice('user', 'ai'),
    content: text(32000),
    // Model labels may change; the examples in the specification are not a closed enum.
    ai_engine: text(100),
    timestamp,
  }, [index({ user_id: 1, timestamp: -1, message_id: 1 }, 'by_user_chat_time')], [
    'user_id', 'sender', 'content', 'timestamp',
  ]),
];

const references = collections
  .filter((entry) => entry.name !== 'users' && entry.validator.$jsonSchema.properties.user_id)
  .map((entry) => ({ from: entry.name, field: 'user_id', to: 'users', target: 'user_id' }));
references.push(
  { from: 'user_challenges', field: 'challenge_id', to: 'challenges', target: 'challenge_id' },
  { from: 'purchases', field: 'item_id', to: 'reward_items', target: 'item_id' },
);

module.exports = { collections, references, QUEST_KEYS };
