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
  await expect(page.getByText("15 模型")).toBeVisible();
  await expect(page.getByRole("slider").nth(0)).toHaveValue("90");
  await expect(page.getByRole("slider").nth(1)).toHaveValue("95");
  await expectNonBlankChart(page);

  const openCodeChannel = page.getByRole("button", { name: "高亮 OpenCode 渠道" });
  const commandCodeChannel = page.getByRole("button", { name: "高亮 Command Code 渠道" });
  const openAiChannel = page.getByRole("button", { name: "高亮 OpenAI 渠道" });
  await expect(openCodeChannel).toBeVisible();
  await expect(commandCodeChannel).toBeVisible();
  await openCodeChannel.hover();
  await expect(openCodeChannel).toHaveClass(/is-active/);
  await expect(openAiChannel).toHaveClass(/is-dimmed/);
  await openCodeChannel.click();
  await page.mouse.move(1300, 820);
  await expect(openCodeChannel).toHaveAttribute("aria-pressed", "true");
  await expect(openCodeChannel).toHaveClass(/is-active/);

  await page.getByRole("button", { name: "CNY" }).click();
  await expect(page.getByRole("button", { name: "CNY" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("订阅按月度 API 等值自动折算")).toBeVisible();
  await expect(page.locator("td.cost-cell").filter({ hasText: "¥" }).first()).toBeVisible();

  await page.getByRole("spinbutton", { name: "最低 Intelligence Index" }).fill("0");
  await expect(page.getByText("16 模型")).toBeVisible();
  await expect(page.getByText("38 方案")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "GPT-5.6 Terra" })).toHaveCount(1);
});

test("mobile drawer and responsive chart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNonBlankChart(page);
  await expect(page.getByRole("group", { name: "渠道高亮" })).toBeVisible();
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
