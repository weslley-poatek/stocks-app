const preset = require('jest-expo/jest-preset');

// msw 3 and its dependencies ship ESM (including .mjs files), so they go through babel-jest.
const esmPackages = [
  'msw', '@msw', '@mswjs', 'rettime', 'until-async', 'outvariant', 'headers-polyfill',
  'is-node-process', '@open-draft', 'strict-event-emitter', 'cookie', 'tough-cookie', 'psl', 'tldts', 'tldts-core', 'type-fest', '@inquirer',
].join('|');

module.exports = {
  ...preset,
  testEnvironment: '<rootDir>/jest.environment.js',
  setupFilesAfterEnv: [...(preset.setupFilesAfterEnv ?? []), '<rootDir>/jest.setup.js'],
  transform: { ...preset.transform, '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
  transformIgnorePatterns: [
    `/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|@shopify/flash-list|native-base|standard-navigation|${esmPackages}))`,
    ...preset.transformIgnorePatterns.slice(1),
  ],
};
