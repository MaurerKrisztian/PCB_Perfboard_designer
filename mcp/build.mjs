// Bundles the server, the editor's shared project-file code and the MCP SDK into one file with no
// runtime dependencies, so `npx perfboard-designer-mcp` starts fast. The docs it serves as
// resources are read from the repo now and baked in.
import {build} from "esbuild";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const {version} = JSON.parse(read("./package.json"));

await build({
  absWorkingDir: new URL(".", import.meta.url).pathname,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // Bundled CommonJS dependencies may still `require` Node built-ins.
  banner: {js: '#!/usr/bin/env node\nimport {createRequire} from "node:module";\nconst require = createRequire(import.meta.url);'},
  define: {
    SHARE_LINKS_DOC: JSON.stringify(read("../docs/share-links.md")),
    PROJECT_FILE_SOURCE: JSON.stringify(read("../src/project-file/project-file.ts")),
    SERVER_VERSION: JSON.stringify(version),
  },
  logLevel: "info",
});
