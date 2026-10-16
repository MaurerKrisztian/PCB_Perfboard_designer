// Bundles the server (stdio, and the Cloudflare Worker), the editor's shared project-file code and the MCP SDK into one file each with
// no runtime dependencies, so `npx perfboard-designer-mcp` starts fast. The docs and example
// projects it serves as resources are read from the repo now and baked in.
import {build} from "esbuild";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const {version} = JSON.parse(read("./package.json"));
// The example projects it serves (src/server.ts describes them), by id.
const EXAMPLES = {
  "555-led-blinker": "perfboard-555-blinker.json",
  "555-led-blinker-stripboard": "stripboard-555-blinker.json",
};

const shared = {
  absWorkingDir: new URL(".", import.meta.url).pathname,
  bundle: true,
  format: "esm",
  define: {
    SHARE_LINKS_DOC: JSON.stringify(read("../docs/share-links.md")),
    PROJECT_FILE_SOURCE: JSON.stringify(read("../src/project-file/project-file.ts")),
    SERVER_VERSION: JSON.stringify(version),
    EXAMPLE_PROJECTS: JSON.stringify(Object.fromEntries(Object.entries(EXAMPLES).map(([id, file]) => [id, read(`../examples/${file}`)]))),
  },
  logLevel: "info",
};

// The stdio server, for `node dist/server.js` / npx.
await build({
  ...shared,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  platform: "node",
  target: "node22",
  // Bundled CommonJS dependencies may still `require` Node built-ins.
  banner: {js: '#!/usr/bin/env node\nimport {createRequire} from "node:module";\nconst require = createRequire(import.meta.url);'},
});

// The Cloudflare Worker (wrangler.toml uploads it as is).
await build({
  ...shared,
  entryPoints: ["src/worker.ts"],
  outfile: "dist/worker.js",
  platform: "neutral",
  target: "es2022",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "browser"],
  external: ["cloudflare:*"],
});
