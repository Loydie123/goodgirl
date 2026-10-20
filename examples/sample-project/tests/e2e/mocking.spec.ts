import { test, expect } from "../fixtures/test.js";

test.describe("Sample Project - Network Route Mocking & API Interception", () => {
  test("intercepts /api/users and returns mocked payload", async ({ page, homePage }) => {
    // Intercept browser network requests to /api/users with custom mock data
    await page.route("**/api/users", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 42, name: "Mocked Test Specialist", role: "Lead QA Automation Engineer" },
        ]),
      });
    });

    await homePage.goto();

    // Verify response from browser-initiated fetch intercepted by route
    const users = await page.evaluate(async () => {
      const res = await fetch("/api/users");
      return (await res.json()) as Array<{ id: number; name: string; role: string }>;
    });

    expect(users).toHaveLength(1);
    const firstUser = users[0];
    expect(firstUser).toBeDefined();
    expect(firstUser?.name).toBe("Mocked Test Specialist");
    expect(firstUser?.role).toBe("Lead QA Automation Engineer");
  });

  test("simulates API error condition via route abort", async ({ page, homePage }) => {
    await homePage.goto();

    // Intercept and abort API calls to simulate browser network failures
    await page.route("**/api/failing-endpoint", async (route) => {
      await route.abort("failed");
    });

    const errorCaught = await page.evaluate(async () => {
      try {
        await fetch("/api/failing-endpoint");
        return false;
      } catch {
        return true;
      }
    });

    expect(errorCaught).toBe(true);
  });
});
