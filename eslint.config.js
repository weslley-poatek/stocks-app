const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['jest.*.js', '**/*.test.{ts,tsx}', '**/__tests__/**', 'src/test-utils/**'],
    languageOptions: { globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', beforeAll: 'readonly', beforeEach: 'readonly', afterAll: 'readonly', afterEach: 'readonly' } },
  },
  { ignores: ['dist/*', 'ios/*', 'android/*'] },
]);
