
import {
  Given,
  When,
  Then
} from '@cucumber/cucumber';

import { expect } from '@playwright/test';

Given('I open the Google website', async function () {
  await this.page.goto(process.env.UI_URL!);
  await expect(this.page).toHaveTitle(/Google/i);
});

When('I search for {string}', async function (searchText: string) {
  const searchBox = this.page.locator(
    'textarea[name="q"], input[name="q"]'
  ).first();

  await expect(searchBox).toBeVisible();

  await searchBox.fill(searchText);
  await searchBox.press('Enter');
});

Then(
  'the search results page should contain {string}',
  async function (expectedText: string) {
    await expect(this.page).toHaveTitle(
      new RegExp(expectedText, 'i')
    );
  }
);