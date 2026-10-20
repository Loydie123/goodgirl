import { test, expect } from "@playwright/test";

test.describe("Sample Project - E2E User Journey", () => {
  test("homepage loads and displays main heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("GoodGirl QA Test Bench");
  });

  test("user triggers action and verifies success status", async ({ page }) => {
    await page.goto("/");
    const status = page.locator("#status-message");
    await expect(status).toHaveText("Awaiting User Interaction");

    const triggerBtn = page.locator("#action-btn");
    await triggerBtn.click();

    await expect(status).toHaveText("Action completed successfully!");
  });
});
