import { expect, test, type Page } from "@playwright/test";

async function expectNonBlankChart(page: Page) {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((node) => {
        const context = node.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, node.width, node.height).data;
        let colored = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (Math.max(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0) -
              Math.min(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0) > 20) {
            colored += 1;
          }
        }
        return colored;
      }),
    )
    .toBeGreaterThan(1_000);
}

test("desktop comparison workflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "模型价格图谱" })).toBeVisible();
  await expect(page.getByText("10 模型")).toBeVisible();
  await expect(page.getByRole("slider").nth(0)).toHaveValue("90");
  await expect(page.getByRole("slider").nth(1)).toHaveValue("95");
  await expectNonBlankChart(page);

  await page.getByRole("button", { name: "CNY" }).click();
  await expect(page.getByRole("button", { name: "CNY" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("订阅按月度 API 等值自动折算")).toBeVisible();
  await expect(page.locator("td.cost-cell").filter({ hasText: "¥" }).first()).toBeVisible();

  await page.getByRole("checkbox", { name: "显示 Luna 门槛以下" }).check();
  await expect(page.getByText("11 模型")).toBeVisible();
  await expect(page.getByText("37 方案")).toBeVisible();
});

test("mobile drawer and responsive chart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNonBlankChart(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "参数" }).click();
  const dialog = page.getByRole("dialog", { name: "比较参数" });
  await expect(dialog).toBeVisible();
  const targetRow = page.getByRole("row").filter({ hasText: "DeepSeek V4.1 FlashGOAT Plan" });
  const costBefore = await targetRow.locator("td.cost-cell").textContent();
  await dialog.getByRole("slider").nth(1).fill("70");
  await dialog.locator(".close-controls").click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => targetRow.locator("td.cost-cell").textContent()).not.toBe(costBefore);
});
