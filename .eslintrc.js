module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
  ],
  plugins: [
    '@typescript-eslint',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for legacy code
    'no-unused-vars': 'off',
    'no-case-declarations': 'off',
    'no-useless-escape': 'off',
    'no-undef': 'off', // TypeScript handles this
  },
  overrides: [
    {
      files: ['src/webview/**/*.ts'],
      env: {
        browser: true,
        node: false,
      },
    },
  ],
  ignorePatterns: ['out', 'dist', 'node_modules', '**/*.d.ts'],
};