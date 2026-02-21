/**
 * UNIQN Functions - ESLint Flat Config
 *
 * @description Firebase Cloud Functions용 ESLint 설정
 * @version 2.0.0 (flat config 마이그레이션, eslint-config-google 수동 대체)
 */

const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  // 1. TypeScript 설정
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['tsconfig.json', 'tsconfig.dev.json'],
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
      },
    },
    rules: {
      // === eslint:recommended 동등 규칙 ===
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-unused-expressions': 'error',
      'no-constant-condition': 'warn',

      // === 코드 스타일 ===
      // indent는 기존 코드 혼합으로 인해 warn 처리 (추후 --fix로 정리)
      indent: ['warn', 2, { SwitchCase: 1 }],

      // === TypeScript ===
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      // === Import ===
      'import/no-unresolved': 0,
    },
  },

  // 2. CJS 설정 파일 (require 허용)
  {
    files: ['*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // 3. 무시 패턴
  {
    ignores: [
      'lib/**/*',
      'generated/**/*',
      'node_modules/**/*',
    ],
  },
];
