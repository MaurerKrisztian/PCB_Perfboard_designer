import {expect, test} from "@playwright/test";

// Catches module-load crashes and runtime errors on startup. Needs no edits when features change.
test("app starts without errors and renders the canvas", async ({page}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  await page.goto("/");
  const canvas = page.locator("#myCanvas");
  await expect(canvas).toBeVisible();

  // The grid is drawn on startup, so the canvas must not be blank.
  const drawn = await canvas.evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    return data.some((v, i) => i % 4 === 3 && v !== 0);
  });
  expect(drawn).toBe(true);
  expect(errors).toEqual([]);
});
