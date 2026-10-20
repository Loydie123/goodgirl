import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model representing the GoodGirl QA Test Bench main page.
 */
export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly statusMessage: Locator;
  readonly actionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1");
    this.statusMessage = page.locator("#status-message");
    this.actionButton = page.locator("#action-btn");
  }

  /**
   * Navigate to the home page.
   */
  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  /**
   * Click the primary trigger action button.
   */
  async triggerAction(): Promise<void> {
    await this.actionButton.click();
  }

  /**
   * Retrieve the current status message text.
   */
  async getStatusText(): Promise<string> {
    return (await this.statusMessage.textContent()) ?? "";
  }
}
