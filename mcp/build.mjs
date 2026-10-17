// Bundles the server (stdio, and the Cloudflare Worker), the editor's shared project-file code and the MCP SDK into one file each with
// no runtime dependencies, so `npx perfboard-designer-mcp` starts fast. The docs and example
// projects it serves as resources, and the part icons and fonts its board pictures embed, are read
// from the repo now and baked in. resvg's WebAssembly, which draws the PNG pictures, is copied next
// to them as dist/resvg.wasm.
import {build} from "esbuild";
import {copyFileSync, readdirSync, readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const {version} = JSON.parse(read("./package.json"));
// The example projects it serves (src/server.ts describes them), by id.
const EXAMPLES = {
  "555-led-blinker": "perfboard-555-blinker.json",
  "555-led-blinker-stripboard": "stripboard-555-blinker.json",
};

// The part icons, by file name, minus their <metadata> (provenance manifests no renderer reads,
// about half of their size).
const ICON_DIR = "../assets/icons/components/";
const COMPONENT_ICONS = Object.fromEntries(readdirSync(new URL(ICON_DIR, import.meta.url))
  .filter(file => file.endsWith(".svg"))
  .map(file => [file, read(ICON_DIR + file).replace(/<metadata>[\s\S]*?<\/metadata>/g, "")]));

// The fonts PNG pictures draw text with (fonts/README.md), base64.
const FONT_DIR = "./fonts/";
const PNG_FONTS = readdirSync(new URL(FONT_DIR, import.meta.url))
  .filter(file => file.endsWith(".ttf"))
  .sort()
  .map(file => readFileSync(new URL(FONT_DIR + file, import.meta.url)).toString("base64"));

const shared = {
  absWorkingDir: new URL(".", import.meta.url).pathname,
  bundle: true,
  format: "esm",
  define: {
    SHARE_LINKS_DOC: JSON.stringify(read("../docs/share-links.md")),
    PROJECT_FILE_SOURCE: JSON.stringify(read("../src/project-file/project-file.ts")),
    SERVER_VERSION: JSON.stringify(version),
    EXAMPLE_PROJECTS: JSON.stringify(Object.fromEntries(Object.entries(EXAMPLES).map(([id, file]) => [id, read(`../examples/${file}`)]))),
    COMPONENT_ICONS: JSON.stringify(COMPONENT_ICONS),
    PNG_FONTS: JSON.stringify(PNG_FONTS),
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
  // resvg.wasm is uploaded beside it (wrangler.toml's rules).
  external: ["cloudflare:*", "*.wasm"],
});

copyFileSync(new URL("./node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url), new URL("./dist/resvg.wasm", import.meta.url));
