module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Allow unused variables that start with underscore
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    // Enforce logger usage instead of console (allow warn and error for utils)
    'no-console': ['error', {
      allow: ['warn', 'error']
    }],
    // Prohibit alert() usage (but allow in specific utility files)
    'no-alert': 'error',
    // Prohibit debugger statements
    'no-debugger': 'error',
    // Reduce strictness for hooks dependencies
    'react-hooks/exhaustive-deps': 'warn',
    // Allow anonymous default exports
    'import/no-anonymous-default-export': 'warn',
    // Allow direct node access in tests
    'testing-library/no-node-access': 'warn',
    // Allow self-assignment
    'no-self-assign': 'warn'
  },
  overrides: [
    {
      // Allow console in logger utility and development debugging
      files: [
        'src/utils/logger.ts',
        'src/types/**/*.ts',
        'src/utils/imagePreloader.ts',
        'src/utils/fontOptimizer.ts',
        'src/pages/LandingPage/utils/*.ts'
      ],
      rules: {
        'no-console': 'off'
      }
    },
    {
      // Allow prompt in ParticipantsPage (CSV import functionality)
      files: ['src/pages/ParticipantsPage.tsx'],
      rules: {
        'no-alert': 'warn'
      }
    },
    {
      // Relax rules for test files
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*'],
      rules: {
        'testing-library/no-container': 'warn',  // CSS 클래스 검증 시 필요
        'jest/no-conditional-expect': 'warn',    // 일부 동적 테스트에서 필요
        'testing-library/no-wait-for-multiple-assertions': 'warn',
        'testing-library/no-render-in-setup': 'warn'
      }
    },
    {
      // Allow console in benchmark and performance test files
      files: ['**/*.benchmark.test.ts', '**/*.performance.test.ts'],
      rules: {
        'no-console': 'off'  // 성능 측정 결과 출력용
      }
    }
  ]
}; 