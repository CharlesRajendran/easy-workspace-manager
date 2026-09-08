module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'import/prefer-default-export': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'import/no-unresolved': 'off',
  },
};
