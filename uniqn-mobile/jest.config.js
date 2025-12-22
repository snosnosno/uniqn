/**
 * UNIQN Mobile - Jest Configuration
 *
 * @description Jest configuration for Expo/React Native testing
 * @version 1.0.0
 */

/** @type {import('jest').Config} */
module.exports = {
  // Expo Jest preset for React Native
  preset: 'jest-expo',

  // Test environment
  testEnvironment: 'node',

  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module path aliases (matching tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@expo/vector-icons$': '<rootDir>/src/__tests__/mocks/expoVectorIcons.js',
  },

  // Transform configuration
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase/.*|nativewind|react-native-reanimated)',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.stories.{ts,tsx}',
  ],

  // Coverage thresholds
  // MVP 단계: 현실적 임계값 설정 (점진적으로 올릴 예정)
  // 현재 수준: global ~14%, utils ~17%, services ~43%
  // TODO [출시 전]: global 60%, utils 80%, services 70% 달성
  coverageThreshold: {
    global: {
      branches: 7,
      functions: 9,
      lines: 14,
      statements: 13,
    },
    './src/utils/': {
      branches: 14,
      functions: 14,
      lines: 15,
      statements: 15,
    },
    './src/services/': {
      branches: 30,
      functions: 30,
      lines: 40,
      statements: 40,
    },
  },

  // Coverage report formats
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Maximum test workers
  maxWorkers: '50%',

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Test timeout
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Globals for TypeScript
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};
