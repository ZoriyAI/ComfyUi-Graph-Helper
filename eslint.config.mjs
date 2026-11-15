// ESLint (flat config): `npm run lint`. Needs the devDependencies eslint, @eslint/js, typescript-eslint,
// eslint-plugin-react-hooks and globals.
//
// The rules are set so that the code as it is today passes: what is wrong but widespread is a warning (the backlog),
// so a new error stands out. Tighten a warning to an error once its count reaches zero. Layout is the formatter's job;
// nothing here is about spaces or line length.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Some comments name rules of eslint-plugin-react and eslint-plugin-jsx-a11y, which are not installed. These no-op
 * stand-ins keep those comments valid until the rules are either adopted or the comments removed.
 */
const noop = { create: () => ({}) };
const legacyRuleNames = {
  react: { rules: { 'no-array-index-key': noop } },
  'jsx-a11y': { rules: { 'no-autofocus': noop } },
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', 'test-results/**', 'coverage/**', 'tests/e2e/world-*/**', 'src/**/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: legacyRuleNames,
    languageOptions: { globals: { ...globals.node } },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      // The backlog, as warnings.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-useless-escape': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-loss-of-precision': 'warn',
      'no-regex-spaces': 'warn',
      // Deliberate: patterns that strip control characters from outside text.
      'no-control-regex': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.js', 'forge.config.js', 'tests/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // These run code in the app window through page.evaluate.
    files: ['scripts/capture-screens/**/*.js', 'scripts/smoke-installed-package.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests reach into the bridge and fake modules freely.
      '@typescript-eslint/no-explicit-any': 'off',
      'require-yield': 'off',
    },
  },
);
