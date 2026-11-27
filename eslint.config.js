import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/|zod$)',
              message: 'Core may import only its own modules and zod.',
            },
            {
              regex: '(?:^|/)client(?:/|$)',
              message: 'Core must not import client modules.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'indexedDB',
          'performance',
          'setTimeout',
          'setInterval',
          'Date',
        ].map((name) => ({
          name,
          message:
            'Core must be deterministic and independent of browser APIs.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the PRNG streams in world state.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Pass time through simulation state.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Core must not construct dates.',
        },
      ],
    },
  },
  {
    files: ['packages/client/src/worker/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:phaser(?:/|$)|preact(?:/|$)|@preact/)',
              message: 'The worker must not import Phaser or Preact.',
            },
            {
              regex: '(?:^|/)(?:ui|render)(?:/|$)',
              message: 'The worker must not import UI or render modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/client/src/render/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)ui(?:/|$)',
              message: 'Render modules must not import UI modules.',
            },
            {
              regex: '(?:^|/)core(?:/|$)',
              importNames: ['step', '*'],
              message: 'Render modules must not import step or the core namespace.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/client/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)render(?:/|$)',
              message: 'UI modules must not import render modules.',
            },
            {
              regex: '(?:^|/)core(?:/|$)',
              importNames: ['step', '*'],
              message: 'UI modules must not import step or the core namespace.',
            },
          ],
        },
      ],
    },
  },
];
