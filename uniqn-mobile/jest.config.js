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
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/utils/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
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
