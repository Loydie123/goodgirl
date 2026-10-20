import { test, expect } from "@playwright/test";

test.describe("GoodGirl E2E Smoke Suite", () => {
  test("homepage loads successfully and displays expected heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("GoodGirl QA Test Bench");
  });

  test("user interaction triggers button click and updates status message", async ({ page }) => {
    await page.goto("/");
    const status = page.locator("#status-message");
    await expect(status).toHaveText("Awaiting User Interaction");

    const actionButton = page.locator("#action-btn");
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await expect(status).toHaveText("Action completed successfully!");
  });
});
