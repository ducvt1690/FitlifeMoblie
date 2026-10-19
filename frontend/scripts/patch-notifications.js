const fs = require('fs');
const path = require('path');

const targetFiles = [
  {
    filePath: path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'TopicSubscriptionModule.android.js'),
    content: `import { requireOptionalNativeModule } from 'expo-modules-core';

let nativeModule = null;
try {
  nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
} catch (e) {
  nativeModule = null;
}

const fallback = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

export default nativeModule || fallback;
`,
  },
  {
    filePath: path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'ServerRegistrationModule.native.js'),
    content: `import { requireOptionalNativeModule } from 'expo-modules-core';

let nativeModule = null;
try {
  nativeModule = requireOptionalNativeModule('NotificationsServerRegistrationModule');
} catch (e) {
  nativeModule = null;
}

const fallback = {
  addListener: () => {},
  removeListeners: () => {},
};

export default nativeModule || fallback;
`,
  },
  {
    filePath: path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'BackgroundNotificationTasksModule.native.js'),
    content: `import { requireOptionalNativeModule } from 'expo-modules-core';

let nativeModule = null;
try {
  nativeModule = requireOptionalNativeModule('ExpoBackgroundNotificationTasksModule');
} catch (e) {
  nativeModule = null;
}

const fallback = {
  async registerTaskAsync(taskName) {
    return null;
  },
  async unregisterTaskAsync(taskName) {
    return null;
  },
};

export default nativeModule || fallback;
`,
  },
];

targetFiles.forEach(({ filePath, content }) => {
  if (fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Successfully patched:', path.basename(filePath));
    } catch (err) {
      console.warn('Failed to patch:', filePath, err.message);
    }
  }
});
