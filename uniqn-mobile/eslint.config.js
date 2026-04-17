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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message: 'Use @/components/icons instead.',
            },
            {
              name: 'lucide-react-native',
              message: '아이콘은 @/components/icons 에서 import 하세요 (stroke·색 일관성).',
            },
          ],
          patterns: [
            {
              group: ['@expo/vector-icons/*'],
              message: 'Use @/components/icons instead.',
            },
          ],
        },
      ],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
    },
  },

  // 4b. T-B12: boardService direct sync 함수 외부 호출 차단
  // 모든 schedule_board sync는 jobManagementService.enqueueScheduleBoardSync 경유 필수.
  // boardService.ts 자체와 outbox Edge Function은 예외.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/boardService.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportSpecifier[imported.name=/^syncScheduleBoard(ForJobPosting|ByJobPostingId|ByApplicationId)$/]',
          message:
            'T-B12: outbox enqueue를 사용하세요. enqueueScheduleBoardSync from "@/services/jobs/jobManagementService"',
        },
      ],
    },
  },

  // 4c. 아이콘 래핑 레이어 — lucide-react-native 직접 import 허용 (유일한 경로)
  {
    files: ['src/components/icons/index.tsx'],
    rules: {
      'no-restricted-imports': 'off',
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
      'dist-build-check/',
      'dist-e2e/',
      'dist-e2e-emu/',
      'build/',
      '.expo/',
      'android/',
      'ios/',
      '*.d.ts',
      'coverage/',
      'playwright-report/',
      'functions/',
      'supabase/functions/',
      'scripts/',
      'e2e/',
    ],
  },
];
