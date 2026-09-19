import { Page, Locator, expect } from '@playwright/test';

export class GooglePage {

  readonly page: Page;
  readonly searchBox: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchBox = page.locator(
      'textarea[name="q"], input[name="q"]'
    ).first();
  }

  async open() {
    await this.page.goto(process.env.UI_URL!);
  }

  async verifyGooglePage() {
    await expect(this.page).toHaveTitle(/Google/i);
  }

  async search(searchText: string) {
    await expect(this.searchBox).toBeVisible();

    await this.searchBox.fill(searchText);
    await this.searchBox.press('Enter');
  }

  async verifySearchResult(expectedText: string) {
    await expect(this.page).toHaveTitle(
      new RegExp(expectedText, 'i')
    );
  }
}