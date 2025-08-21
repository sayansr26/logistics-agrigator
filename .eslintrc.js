module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // Basic code quality rules
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off", // Allow console.log in Node.js projects
    "prefer-const": "warn",
    "no-var": "error",

    // Style rules (will be handled by Prettier)
    semi: ["error", "always"],
    quotes: ["error", "double", { allowTemplateLiterals: true }],
    "comma-dangle": ["error", "always-multiline"],

    // Best practices
    eqeqeq: ["error", "always"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
  },
  overrides: [
    {
      // Backend services configuration
      files: ["backend/**/*.js"],
      env: {
        node: true,
        commonjs: true,
      },
      rules: {
        // Backend-specific rules
        "no-process-exit": "off", // Allow process.exit in backend
      },
    },
    {
      // Shared library configuration
      files: ["shared/**/*.js"],
      env: {
        node: true,
        commonjs: true,
      },
    },
    {
      // Frontend configuration
      files: ["frontend/**/*.{js,jsx,ts,tsx}"],
      env: {
        browser: true,
        es6: true,
      },
      extends: ["eslint:recommended"],
      rules: {
        // Frontend-specific rules
        "no-undef": "off", // React/Next.js globals handled separately
      },
    },
  ],
};
