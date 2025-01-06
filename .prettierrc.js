/**
 * @type {import('prettier').Config}
 */
module.exports = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  overrides: [
    {
      files: "*.{ts,tsx}",
      options: {
        parser: "typescript",
      },
    },
  ],
};
