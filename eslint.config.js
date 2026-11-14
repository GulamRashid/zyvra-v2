import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        URLSearchParams: 'readonly',
        queueMicrotask: 'readonly'
      }
    },
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
      'unused-imports': unusedImports
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'unused-imports/no-unused-imports': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-no-undef': 'error'
    }
  }
];
