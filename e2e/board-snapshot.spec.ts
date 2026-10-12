import {expect, test} from "@playwright/test";
import fs from "fs";
import path from "path";

// One fixture per component system (see CLAUDE.md "Two parallel component systems" + IC chips).
// Each fixture is a saved project, loaded through the real "Load" file input and compared to a
// baseline image. Dropping a new .json into e2e/fixtures/ automatically adds a test. When rendering
// changes on purpose, re-baseline with `npm run e2e:update` and review the image diff in git.
const fixturesDir = path.join(__dirname, "fixtures");
const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

for (const file of fixtures) {
  const name = path.basename(file, ".json");

  test(`${name} board renders as expected`, async ({page}) => {
    const project = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), "utf-8"));

    await page.goto("/app/");
    await page.setInputFiles("#loadProjectBtn", path.join(fixturesDir, file));

    const canvas = page.locator("#myCanvas");
    await expect(canvas).toHaveJSProperty("width", project.canvas.width);
    // Component icons are fetched lazily the first time they're drawn; wait for them so the
    // snapshot shows the artwork rather than the fallback text label.
    await page.waitForLoadState("networkidle");

    await expect(canvas).toHaveScreenshot(`${name}.png`, {maxDiffPixelRatio: 0.001});
  });
}
