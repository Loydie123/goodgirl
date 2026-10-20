import { test as baseTest, expect } from "@playwright/test";
import { HomePage } from "../pages/HomePage.js";

type GoodGirlFixtures = {
  homePage: HomePage;
};

/**
 * Extended Playwright test instance providing custom Page Object Model fixtures.
 */
export const test = baseTest.extend<GoodGirlFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },
});

export { expect };
