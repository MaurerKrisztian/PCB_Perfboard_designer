import type { UserConfig } from "vite";

const config: UserConfig = {
  base: "",
  publicDir: 'assets',
  server: {
    port: 3000,
  },
  define: {
    // Where short links' projects are stored (src/features/project/project-storage.ts): the public
    // service unless PERFBOARD_PROJECTS_URL is set when the editor is built or run, e.g.
    // `PERFBOARD_PROJECTS_URL=http://localhost:8787 npm run start` with a local Worker
    // (`cd mcp && npm run worker:dev`), or `off` for an editor without short links.
    __PERFBOARD_PROJECTS_URL__: JSON.stringify(process.env.PERFBOARD_PROJECTS_URL ?? ""),
  },
  build: {
    rollupOptions: {
      // Multi-page build: the landing page at the root, the designer at /app/ and the
      // standalone user guide (/guide/), contributors (/contributors/) and MCP server
      // (/mcp-server/) pages.
      input: {
        main: "index.html",
        app: "app/index.html",
        guide: "guide/index.html",
        contributors: "contributors/index.html",
        mcpServer: "mcp-server/index.html",
      },
    },
  },
};

export default config;
