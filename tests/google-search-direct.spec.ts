import { test, expect } from '@playwright/test';

test('Google search test - direct', async ({ page }) => {

  await page.goto(process.env.UI_URL!);

  await expect(page).toHaveTitle(/Google/i);

  const searchBox = page.locator(
    'textarea[name="q"], input[name="q"]'
  ).first();

  await expect(searchBox).toBeVisible();

  await searchBox.fill('Selenium Java');

  await searchBox.press('Enter');

  await expect(page).toHaveTitle(/Selenium/i);
});