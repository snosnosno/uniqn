/**
 * UNIQN Mobile - ESLint Flat Config
 *
 * @description React Native + TypeScript + Expo 프로젝트용 ESLint 설정
 * @version 2.0.0 (flat config 마이그레이션)
 */

const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');

module.exports = [
  // 1. Expo 기본 설정 (TypeScript, React, React Hooks, import 포함)
  ...expoConfig,

  // 2. 프로젝트 TypeScript 규칙
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // 3. 프로젝트 React / React Native 규칙
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'off',
      'react-native/no-color-literals': 'off',
    },
  },

  // 4. 프로젝트 일반 규칙
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
    },
  },

  // 5. 테스트 파일 오버라이드
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 6. Prettier (마지막에 적용하여 충돌 규칙 비활성화)
  eslintConfigPrettier,

  // 7. 무시 패턴
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'android/',
      'ios/',
      '*.d.ts',
      'coverage/',
      'functions/',
      'scripts/',
    ],
  },
];
