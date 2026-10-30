'use strict';

// Plain MongoDB validators: enforced on Atlas even when writes bypass an ODM/API.
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const DATE = '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
const uuid = { bsonType: 'string', pattern: UUID };
// Firebase auth.uid and other verified subject IDs need not be UUIDs.
const identity = { bsonType: 'string', minLength: 1, maxLength: 128 };
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
const textArray = (maxItems, maxLength = 100) => ({
  bsonType: 'array', maxItems, items: text(maxLength),
});
const weight = number(25, 300);
const height = number(80, 250);
const index = (key, name, options = {}) => ({ key, name, ...options });
const unique = (key, name, options = {}) => index(key, name, { unique: true, ...options });
const userDayIndex = (field) => index({ user_id: 1, [field]: -1 }, `by_user_${field}`);

const SCHEMA_VERSION = 2;
const ROLES = ['user', 'trainer', 'admin'];
const QUEST_KEYS = ['q_water', 'q_workout', 'q_meal', 'q_sleep', 'q_mood', 'q_checkin', 'q_chat'];
const dailyUnique = (field) => unique({ user_id: 1, [field]: 1 }, `uq_user_${field}`);

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
          [id]: id === 'user_id' ? identity : uuid,
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
    role: choice(...ROLES),
    is_active: bool,
    gender: choice('male', 'female'),
    age: { ...integer(5), maximum: 100 },
    date_of_birth: { ...day, description: 'Optional date of birth; API validates the calendar date and derives age.' },
    height,
    weight,
    activity_level: choice('sedentary', 'light', 'moderate', 'active'),
    goal: choice('lose', 'maintain', 'gain'),
    target_water: { ...integer(500), maximum: 4350 },
    target_calories: integer(1200),
    fit_coins: integer(),
    streak_days: integer(),
    timezone: { ...text(100), pattern: '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+.-]+)*$' },
    streak_last_date: day,
  }, [unique({ email: 1 }, 'uq_user_email')], [
    'email', 'full_name', 'role', 'is_active', 'gender', 'age', 'height', 'weight',
    'activity_level', 'goal', 'target_water', 'target_calories', 'fit_coins', 'streak_days', 'timezone',
  ], { oneOf: [
    { properties: { gender: { enum: ['male'] }, target_calories: { minimum: 1500 } } },
    { properties: { gender: { enum: ['female'] }, target_calories: { minimum: 1200 } } },
  ] }),

  collection('water_logs', 'log_id', {
    user_id: identity,
    amount: integer(1),
    log_time: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
    log_date: day,
  }, [userDayIndex('log_date')]),

  collection('workout_logs', 'workout_id', {
    user_id: identity,
    title: text(150),
    category: text(50),
    duration_seconds: integer(1),
    calories_burned: integer(),
    workout_date: day,
  }, [userDayIndex('workout_date')]),

  collection('exercises', 'exercise_id', {
    source: choice('exercisedb_v1'),
    source_exercise_id: text(100),
    name: text(200),
    gif_url: text(1000),
    body_parts: textArray(20),
    equipments: textArray(20),
    target_muscles: textArray(20),
    secondary_muscles: textArray(20),
    instructions: textArray(50, 2000),
    name_vi: text(200, 0),
    body_parts_vi: textArray(20),
    equipments_vi: textArray(20),
    target_muscles_vi: textArray(20),
    secondary_muscles_vi: textArray(20),
    instructions_vi: textArray(50, 2000),
    is_active: bool,
    synced_at: timestamp,
  }, [
    unique({ source: 1, source_exercise_id: 1 }, 'uq_exercise_source_id'),
    index({ is_active: 1, source: 1, name: 1 }, 'by_active_source_name'),
    index({ body_parts: 1, is_active: 1 }, 'by_body_part_active'),
    index({ target_muscles: 1, is_active: 1 }, 'by_target_muscle_active'),
    index({ equipments: 1, is_active: 1 }, 'by_equipment_active'),
  ], ['source', 'source_exercise_id', 'name', 'gif_url', 'body_parts', 'equipments',
    'target_muscles', 'secondary_muscles', 'instructions', 'is_active', 'synced_at']),

  collection('meal_logs', 'meal_id', {
    user_id: identity,
    meal_name: text(150),
    calories: integer(1),
    protein: number(0),
    carbs: number(0),
    fat: number(0),
    meal_type: choice('breakfast', 'lunch', 'dinner', 'snack'),
    meal_date: day,
  }, [userDayIndex('meal_date')]),

  collection('daily_quest_logs', 'quest_log_id', {
    user_id: identity,
    quest_key: choice(...QUEST_KEYS),
    quest_title: text(150),
    reward_coins: { ...integer(10), maximum: 10 },
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
    user_id: identity,
    weight,
    height,
    bmi_value: number(0.01),
    bmi_status: choice('Thiếu cân', 'Cân đối', 'Thừa cân nhẹ', 'Tiền béo phì / Béo phì'),
    record_date: day,
  }, [dailyUnique('record_date')]),

  collection('sleep_logs', 'sleep_id', {
    user_id: identity,
    hours: number(0, 24),
    quality: choice('Sâu', 'Bình thường', 'Chập chờn'),
    sleep_date: day,
  }, [dailyUnique('sleep_date')]),

  collection('mood_logs', 'mood_id', {
    user_id: identity,
    mood_label: text(50),
    note: text(2000, 0),
    mood_date: day,
  }, [dailyUnique('mood_date')], ['user_id', 'mood_label', 'mood_date']),

  collection('workout_templates', 'template_id', {
    trainer_id: identity,
    title: text(150),
    category: text(50),
    duration_seconds: integer(1),
    calories_est: integer(),
    level: choice('beginner', 'intermediate', 'advanced'),
    description: text(5000),
    is_active: bool,
  }, [
    index({ trainer_id: 1, is_active: 1 }, 'by_trainer_active'),
    index({ is_active: 1, level: 1 }, 'by_active_level'),
  ]),

  collection('trainer_assignments', 'id', {
    trainer_id: identity,
    user_id: identity,
    template_id: uuid,
    note: text(2000, 0),
    assigned_at: timestamp,
    status: choice('assigned', 'done', 'cancelled'),
    done_at: { bsonType: ['date', 'null'] },
  }, [
    index({ trainer_id: 1, user_id: 1, status: 1 }, 'by_trainer_user_status'),
    index({ user_id: 1, status: 1, assigned_at: -1 }, 'by_user_assignment_status'),
    index({ template_id: 1 }, 'by_assignment_template'),
  ], ['trainer_id', 'user_id', 'template_id', 'assigned_at', 'status', 'done_at'], {
    oneOf: [
      { properties: { status: { enum: ['done'] }, done_at: timestamp } },
      { properties: { status: { enum: ['assigned', 'cancelled'] }, done_at: { bsonType: 'null' } } },
    ],
  }),

  collection('challenges', 'challenge_id', {
    title: text(150),
    description: text(2000),
    target_days: integer(1),
    reward_coins: integer(),
    badge_icon: text(100),
    is_active: bool,
  }, [index({ is_active: 1, target_days: 1 }, 'by_active_duration')]),

  collection('user_challenges', 'id', {
    user_id: identity,
    challenge_id: uuid,
    current_progress: integer(),
    is_completed: bool,
    joined_at: timestamp,
    last_checkin: { bsonType: ['date', 'null'] },
    last_checkin_date: day,
  }, [
    unique({ user_id: 1, challenge_id: 1 }, 'uq_user_active_challenge', {
      partialFilterExpression: { is_completed: false },
    }),
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
    user_id: identity,
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

  collection('ai_chat_sessions', 'session_id', {
    user_id: identity,
    title: text(150),
  }, [index({ user_id: 1, updated_at: -1 }, 'by_user_session_updated')]),

  collection('ai_chat_messages', 'message_id', {
    user_id: identity,
    session_id: uuid,
    sender: choice('user', 'ai'),
    content: text(32000),
    // Model labels may change; the examples in the specification are not a closed enum.
    ai_engine: text(100),
    timestamp,
  }, [
    index({ user_id: 1, session_id: 1, timestamp: 1, message_id: 1 }, 'by_user_session_message_time'),
  ], [
    'user_id', 'session_id', 'sender', 'content', 'timestamp',
  ]),
];

const references = collections
  .filter((entry) => entry.name !== 'users' && entry.validator.$jsonSchema.properties.user_id)
  .map((entry) => ({ from: entry.name, field: 'user_id', to: 'users', target: 'user_id' }));
references.push(
  { from: 'user_challenges', field: 'challenge_id', to: 'challenges', target: 'challenge_id' },
  { from: 'purchases', field: 'item_id', to: 'reward_items', target: 'item_id' },
  { from: 'workout_templates', field: 'trainer_id', to: 'users', target: 'user_id' },
  { from: 'trainer_assignments', field: 'trainer_id', to: 'users', target: 'user_id' },
  { from: 'trainer_assignments', field: 'template_id', to: 'workout_templates', target: 'template_id' },
  { from: 'ai_chat_messages', field: 'session_id', to: 'ai_chat_sessions', target: 'session_id' },
);

module.exports = { collections, references, QUEST_KEYS, ROLES, SCHEMA_VERSION };
