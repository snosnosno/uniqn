module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Allow unused variables that start with underscore
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    // Allow console logs in development
    'no-console': 'off',
    // Reduce strictness for hooks dependencies
    'react-hooks/exhaustive-deps': 'warn',
    // Allow anonymous default exports
    'import/no-anonymous-default-export': 'warn',
    // Allow direct node access in tests
    'testing-library/no-node-access': 'warn',
    // Allow self-assignment
    'no-self-assign': 'warn'
  }
}; 