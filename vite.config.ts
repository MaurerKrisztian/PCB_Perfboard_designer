import type { UserConfig } from "vite";

const config: UserConfig = {
  base: "",
  publicDir: 'assets',
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      // Multi-page build: the landing page at the root, the designer at /app/ and the
      // standalone contributors (/contributors/) and MCP server (/mcp-server/) pages.
      input: {
        main: "index.html",
        app: "app/index.html",
        contributors: "contributors/index.html",
        mcpServer: "mcp-server/index.html",
      },
    },
  },
};

export default config;
