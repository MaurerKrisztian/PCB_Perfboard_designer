import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // One snapshot per test regardless of OS, so devs on Windows/Mac/Linux share baselines.
  // Fonts can differ slightly across OSes, hence the pixel tolerance in the test.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  use: {baseURL: "http://localhost:3000"},
  projects: [{name: "chromium", use: {...devices["Desktop Chrome"], viewport: {width: 1400, height: 900}}}],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
