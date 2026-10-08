import {expect, test} from "@playwright/test";
import path from "path";

// Loads a saved project through the real "Load" file input and compares the canvas to a baseline
// image. When rendering changes on purpose, re-baseline with `npm run e2e:update` and review the
// image diff in git - no test code changes needed.
test("sample board renders as expected", async ({page}) => {
  await page.goto("/");
  await page.setInputFiles("#loadProjectBtn", path.join(__dirname, "fixtures", "sample-board.json"));

  const canvas = page.locator("#myCanvas");
  await expect(canvas).toHaveJSProperty("width", 400);

  await expect(canvas).toHaveScreenshot("sample-board.png", {maxDiffPixelRatio: 0.01});
});
