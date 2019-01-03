module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
    "jest/globals": true
  },
  globals: {
    page: true,
    browser: true,
    jestPuppeteer: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    sourceType: "module",
    codeFrame: false,
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      jsx: true
    }
  },
  plugins: ["jest"],
  rules: {
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "*", next: "*" },
      {
        blankLine: "never",
        prev: ["const", "let"],
        next: ["const", "let"]
      }
    ],
    "no-console": 0,
    "no-unused-vars": 1,
    "prefer-const": "error",
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "never"],
    "require-await": 2,
    "no-return-await": 2
  }
}
