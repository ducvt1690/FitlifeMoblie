const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  randomUUID
} = require('node:crypto');
const {
  once
} = require('node:events');
const {
  before,
  after,
  test
} = require('node:test');
const {
  createRequire
} = require('node:module');
const backendRequire = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const {
  MongoMemoryReplSet
} = backendRequire('mongodb-memory-server');
const {
  MongoClient
} = backendRequire('mongodb');
const {
  createApp
} = require('../../backend/app');
const {
  initializeDatabase
} = require('../../backend/database/mongodb/database');
const {
  initializeAuthSessions
} = require('../../backend/database/connection');
const {
  seedCatalogs
} = require('../../backend/database/mongodb/seed');
let replica, client, db, server, base, app, api, tokenStore;
let pauseJson;
const onboarding = {
  gender: 'female',
  age: 25,
  height: 160,
  weight: 55,
  activity_level: 'light',
  goal: 'maintain'
};
const password = 'Mobile-integration-test!';
async function loadMobile() {
  const context = vm.createContext({
    console,
    fetch: async (...args) => {
      const response = await fetch(...args);
      if (pauseJson && String(args[0]).endsWith('/api/water-logs')) {
        const paused = pauseJson;
        pauseJson = null;
        const json = response.json.bind(response);
        response.json = async () => {
          paused.ready();
          await paused.gate;
          return json();
        };
      }
      return response;
    },
    AbortController,
    setTimeout,
    clearTimeout,
    URL,
    process: {
      env: {
        EXPO_PUBLIC_API_URL: base
      }
    }
  });
  tokenStore = new Map();
  const legacyStore = new Map();
  const mocks = {
    'react-native': {
      Platform: {
        OS: 'android'
      }
    },
    'expo-constants': {
      default: {
        expoConfig: {}
      }
    },
    'expo-crypto': {
      randomUUID
    },
    '@react-native-async-storage/async-storage': {
      default: {
        getItem: async k => legacyStore.get(k) || null,
        setItem: async (k, v) => legacyStore.set(k, v),
        removeItem: async k => legacyStore.delete(k)
      }
    },
    'expo-secure-store': {
      getItemAsync: async k => tokenStore.get(k) || null,
      setItemAsync: async (k, v) => tokenStore.set(k, v),
      deleteItemAsync: async k => tokenStore.delete(k)
    }
  };
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    let module;
    if (mocks[file]) {
      const exports = mocks[file];
      module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
      }, {
        context
      });
    } else {
      module = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {
        context,
        identifier: file
      });
    }
    modules.set(file, module);
    await module.link(spec => load(mocks[spec] ? spec : path.resolve(path.dirname(file), spec.endsWith('.js') ? spec : spec + '.js')));
    return module;
  }
  const storage = await load(path.resolve(__dirname, '../src/utils/storage.js'));
  await storage.evaluate();
  app = storage.namespace;
  api = modules.get(path.resolve(__dirname, '../src/utils/apiClient.js'))?.namespace;
}
before(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: {
      version: '8.2.6'
    },
    replSet: {
      count: 1
    }
  });
  client = await new MongoClient(replica.getUri()).connect();
  db = client.db('fitlife_mobile_adapter_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  await seedCatalogs(db);
  server = createApp({
    db
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  await loadMobile();
}, {
  timeout: 240000
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  }
  if (client) await client.close();
  if (replica) await replica.stop();
});
async function register() {
  const result = await app.registerAccount('Mobile QA', randomUUID() + '@mobile.example', password, onboarding);
  assert.equal(result.success, true, result.message);
  return result.user;
}
test('registration uses backend onboarding and stores only a native session secret', async () => {
  const user = await register();
  assert.equal((await app.getAuthSession()).user.id, user.id);
  assert.equal(await db.collection('users').countDocuments({
    user_id: user.id
  }), 1);
  assert.equal([...tokenStore.values()].some(v => v.includes(password)), false);
  assert.equal(await app.getCoins(), 0);
});
test('mobile mutations persist in MongoDB and reward only server quests', async () => {
  const user = await register();
  await app.addWaterLog(250);
  await app.addWaterLog(500);
  assert.equal((await app.getWaterLogsToday()).reduce((s, l) => s + l.amount, 0), 750);
  assert.equal(await app.getCoins(), 10);
  await app.addMealLog({
    name: 'Cơm',
    calories: 400,
    protein: 20,
    carbs: 50,
    fat: 10,
    mealType: 'Trưa'
  });
  await app.addWorkoutLog({
    title: 'Tập QA',
    durationSec: 600,
    calories: 50
  });
  await app.saveSleepToday('7.5', 'Ngủ sâu 😴');
  await app.saveMoodToday('Vui', 'QA');
  const quests = await app.getDailyQuests();
  assert.equal(quests.filter(q => q.completed).length, 5);
  assert.equal((await app.getUserProfile()).streak, 1);
  assert.equal(await app.getCoins(), 50);
  assert.equal(await db.collection('water_logs').countDocuments({
    user_id: user.id
  }), 2);
  assert.equal((await app.getWeeklyStats()).water.at(-1).amount, 750);
});
test('profile, BMI and meal deletion use the existing backend contract', async () => {
  await register();
  const profile = await app.getUserProfile();
  await app.saveUserProfile({
    ...profile,
    name: 'Tên sửa',
    weight: 60,
    targetWater: 99999
  });
  assert.equal((await app.getUserProfile()).name, 'Tên sửa');
  assert.notEqual((await app.getUserProfile()).targetWater, 99999);
  assert.equal((await app.getBmiHistory())[0].weight, 60);
  const meal = await app.addMealLog({
    name: 'Phở',
    calories: 450
  });
  await app.updateMealLog(meal.id, {
    name: 'Phở sửa',
    calories: 500,
    mealType: 'Trưa'
  });
  assert.equal((await app.getMealLogsToday())[0].calories, 500);
  assert.equal((await app.getMealLogsToday())[0].name, 'Phở sửa');
  await app.deleteMealLog(meal.id);
  assert.equal((await app.getMealLogsToday()).length, 0);
  assert.equal(await app.getCoins(), 0);
});
test('coaching connects the member, displays assignments and revokes access when ended', async () => {
  const user = await register();
  const email = randomUUID() + '@trainer.example';
  const auth = require('../../backend/services/auth.service').createAuthService({
    db
  });
  const trainer = await auth.register({
    email,
    password,
    full_name: 'Trainer QA',
    ...onboarding
  });
  await db.collection('users').updateOne({
    email
  }, {
    $set: {
      role: 'trainer'
    }
  });
  const trainerLogin = await auth.login({
    email,
    password
  });
  const send = async (url, method = 'GET', body) => {
    const r = await fetch(base + url, {
      method,
      headers: {
        Authorization: 'Bearer ' + trainerLogin.token,
        'Content-Type': 'application/json'
      },
      ...(body ? {
        body: JSON.stringify(body)
      } : {})
    });
    assert.ok(r.ok, url + ' ' + r.status);
    return r.json();
  };
  const invite = (await send('/api/trainer/links', 'POST')).link;
  await app.acceptTrainer(invite.invite_code);
  const templateId = randomUUID();
  await send('/api/trainer/templates', 'POST', {
    template_id: templateId,
    title: 'Training QA',
    category: 'Strength',
    duration_seconds: 600,
    calories_est: 50,
    level: 'beginner',
    description: 'QA'
  });
  const id = randomUUID();
  await send('/api/trainer/assignments', 'POST', {
    id,
    user_id: user.id,
    template_id: templateId,
    note: 'Mobile QA'
  });
  const data = await app.getCoaching();
  assert.equal(data.assignments[0].id, id);
  await app.finishAssignment(id, 'complete');
  assert.equal((await app.getCoaching()).assignments[0].status, 'done');
  await app.leaveTrainer(invite.link_id);
  assert.equal((await app.getCoaching()).links.length, 0);
});
test('rewards, challenges and AI chat use server IDs and recover a retried message', async () => {
  await register();
  const shop = await app.getShop();
  const item = shop.items.find(i => i.cost_coins === 0);
  await app.buyItem(item.item_id);
  assert.ok((await app.getPurchases()).includes(item.item_id));
  const challenge = (await app.getChallenges())[0];
  await app.joinChallenge(challenge.challenge_id);
  await app.checkinChallenge(challenge.challenge_id);
  await assert.rejects(app.checkinChallenge(challenge.challenge_id), e => e.status === 409);
  const session = randomUUID(),
    message = randomUUID();
  const sent = await app.sendChat(session, 'Nước hôm nay?', message);
  const retry = await app.sendChat(session, 'Nước hôm nay?', message);
  assert.equal(retry.reply.message_id, sent.reply.message_id);
  assert.equal(retry.reward_coins, 0);
});
test('switching accounts cannot read previous health logs or balance', async () => {
  await register();
  await app.addWaterLog(250);
  await app.clearAuthSession();
  await register();
  assert.equal((await app.getWaterLogsToday()).length, 0);
  assert.equal(await app.getCoins(), 0);
});
test('a slow response from the previous session is rejected after changing accounts', async () => {
  await register();
  await app.addWaterLog(250);
  let ready, release;
  const reached = new Promise(r => {
      ready = r;
    }),
    gate = new Promise(r => {
      release = r;
    });
  pauseJson = {
    ready,
    gate
  };
  const stale = app.getWaterLogsToday();
  const checked = assert.rejects(stale, /Phiên đã thay đổi/);
  await reached;
  await register();
  release();
  await checked;
  assert.equal((await app.getWaterLogsToday()).length, 0);
});
test('invalid login and expired session cannot use legacy local authentication', async () => {
  await register();
  let notifications = 0;
  const off = api.onSessionExpired(() => notifications++);
  await db.collection('auth_sessions').updateMany({}, {
    $set: {
      expires_at: new Date(0)
    }
  });
  await assert.rejects(app.getWaterLogsToday(), e => e.status === 401);
  assert.equal(notifications, 1);
  assert.equal(tokenStore.size, 0);
  off();
  const failed = await app.loginAccount('missing@mobile.example', password);
  assert.equal(failed.success, false);
  assert.equal(await app.getAuthSession(), null);
});
test('mobile rejects trainer sessions and preserves HTTP errors for the UI', async () => {
  const user = await register();
  await db.collection('users').updateOne({
    user_id: user.id
  }, {
    $set: {
      role: 'trainer'
    }
  });
  await app.clearAuthSession();
  const login = await app.loginAccount(user.email, password);
  assert.equal(login.success, false);
  assert.match(login.message, /website/i);
  assert.equal(await app.getAuthSession(), null);
  await register();
  await assert.rejects(app.addWaterLog(-1), e => e.status === 400);
});
