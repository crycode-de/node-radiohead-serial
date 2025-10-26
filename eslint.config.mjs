import { defineConfig } from 'eslint/config';

import crycode from '@crycode/eslint-config';

export default defineConfig(
  ...crycode.configs.ts,
  ...crycode.configs.stylistic,

  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
    ],
  },

  {
    files: [
      'src/**/*',
    ],
    ignores: [
      'examples/**/*',
    ],

    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: [
          './tsconfig.json',
        ],
      },
    },

  },

  {
    files: [
      'examples/**/*',
    ],

    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: [
          './examples/tsconfig.json',
        ],
      },
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
      },
    },

    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-console': 'off',
    },
  },
);
