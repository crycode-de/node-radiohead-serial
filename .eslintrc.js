module.exports = {
  extends: [
    '@crycode/eslint-config'
  ],
  parserOptions: {
    project: [
      './tsconfig.json',
      './examples/tsconfig.json',
    ],
    parserOptions: {
      ecmaVersion: 2020,
    },
  },
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/promise-function-async': 'off',
    'no-undef-init': 'off',
  },
};
