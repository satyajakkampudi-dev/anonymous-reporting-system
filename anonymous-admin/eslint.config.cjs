const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "no-useless-escape": "warn",
      "no-unused-vars": "warn",
      "no-console": "error",
      camelcase: "warn",
      eqeqeq: "warn",
      "require-await": "warn",
      quotes: ["off", "single"],
      semi: ["warn", "always"],
      "no-unsafe-optional-chaining": "error",
      "no-prototype-builtins": "error",
      "no-undefined": "error",
    },
  },
];
