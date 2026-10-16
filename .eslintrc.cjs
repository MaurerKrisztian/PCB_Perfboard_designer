module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    ecmaVersion: 2018,
    project: "./tsconfig.json",
    sourceType: "module",
  },
  env: {
    browser: true,
  },
  ignorePatterns: ["*.cjs"],
  rules: {
    // The MCP server (mcp/) builds on the editor's code, never the other way round.
    "no-restricted-imports": ["error", {patterns: [{group: ["**/mcp", "**/mcp/**"], message: "The editor must not depend on the MCP server (mcp/)."}]}],
  },
};
