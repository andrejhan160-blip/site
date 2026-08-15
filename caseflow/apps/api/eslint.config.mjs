// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Off by design: Nest resolves constructor dependencies from the emitted
      // decorator metadata, so provider classes must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
