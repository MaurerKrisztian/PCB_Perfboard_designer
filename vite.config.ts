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
      // standalone contributors page at /contributors/.
      input: {
        main: "index.html",
        app: "app/index.html",
        contributors: "contributors/index.html",
      },
    },
  },
};

export default config;
