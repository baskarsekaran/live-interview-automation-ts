
import { test, expect } from '@playwright/test';

test('Google search test', async ({ page }) => {

  // 1. Open Google
  //await page.goto('https://www.google.com');
  await page.goto(process.env.UI_URL!);

  // 2. Validate the page title
  await expect(page).toHaveTitle(/Google/i);

  // 3. Find the search box
  const searchBox = page.locator(
    'textarea[name="q"], input[name="q"]'
  ).first();

  await expect(searchBox).toBeVisible();

  // 4. Enter search text
  await searchBox.fill('Selenium Java');

  // 5. Submit the search
  await searchBox.press('Enter');

  // 6. Validate the search result page
  await expect(page).toHaveTitle(/Selenium/i);
});