// The code is layered, each layer importing only the ones below it (ARCHITECTURE.md, "Map of the
// code"):
//   src/parts/         part definitions and geometry: imports nothing outside itself
//   src/project-file/  the file format, pins, nets: imports src/parts
//   src/board-render/  draws a board from a project file: imports both of the above
//   the editor, src/viewer-3d/ and mcp/ on top
// The bottom three are pure (no DOM, no editor state), since the MCP server and its Worker run
// them too. The rules below keep it that way.

const MCP = {group: ["**/mcp", "**/mcp/**"], message: "The editor must not depend on the MCP server (mcp/)."};
const RENDERER_INSIDES = {
  group: ["**/board-render/*"],
  message: "Import the board renderer from src/board-render (its index.ts), not its files.",
};
const EDITOR = {
  group: ["**/features/**", "**/state/**", "**/interfaces/**", "**/utils/**", "**/viewer-3d/**"],
  message: "Pure code (src/parts, src/project-file, src/board-render) must not import the editor or the 3D viewer.",
};
const RENDERER = {group: ["**/board-render", "**/board-render/**"], message: "Lower layers must not import the board renderer."};
const PROJECT_FILE = {group: ["**/project-file/**"], message: "src/parts is the bottom layer: it imports nothing outside itself."};

const imports = (...patterns) => ["error", {patterns: [MCP, RENDERER_INSIDES, ...patterns]}];

// The browser, which pure code can't count on (the MCP server runs it on Node and Workers).
const BROWSER_GLOBALS = [
  "document", "window", "navigator", "location", "localStorage", "sessionStorage", "Image", "Path2D",
  "requestAnimationFrame", "matchMedia", "getComputedStyle", "devicePixelRatio", "alert", "confirm", "prompt",
].map(name => ({name, message: "Pure code must not use the browser: keep it in the editor (e.g. src/features/board-canvas/)."}));

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
    "no-restricted-imports": imports(),
  },
  overrides: [
    {files: ["src/parts/**"], rules: {"no-restricted-imports": imports(EDITOR, RENDERER, PROJECT_FILE), "no-restricted-globals": ["error", ...BROWSER_GLOBALS]}},
    {files: ["src/project-file/**"], rules: {"no-restricted-imports": imports(EDITOR, RENDERER), "no-restricted-globals": ["error", ...BROWSER_GLOBALS]}},
    {files: ["src/board-render/**"], rules: {"no-restricted-imports": imports(EDITOR), "no-restricted-globals": ["error", ...BROWSER_GLOBALS]}},
    // The 3D viewer reads project files only, never the editor's state.
    {files: ["src/viewer-3d/**"], rules: {"no-restricted-imports": imports({...EDITOR, message: "The 3D viewer must not import the editor: it reads project files only."})}},
  ],
};
