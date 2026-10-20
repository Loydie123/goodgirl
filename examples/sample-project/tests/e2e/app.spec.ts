import { test, expect } from "../fixtures/test.js";

test.describe("Sample Project - E2E User Journey (Page Object Model)", () => {
  test("homepage loads and displays main heading via POM", async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.heading).toBeVisible();
    await expect(homePage.heading).toHaveText("GoodGirl QA Test Bench");
  });

  test("user triggers action and verifies success status via POM", async ({ homePage }) => {
    await homePage.goto();
    const initialStatus = await homePage.getStatusText();
    expect(initialStatus).toBe("Awaiting User Interaction");

    await homePage.triggerAction();

    await expect(homePage.statusMessage).toHaveText("Action completed successfully!");
  });
});
