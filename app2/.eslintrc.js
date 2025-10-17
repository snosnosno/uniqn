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
    }
  ]
}; 