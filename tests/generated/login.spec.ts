import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto(
    'https://www.saucedemo.com',
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  );
  await expect(
    page.locator('[data-test="username"]')
  ).toBeVisible({
    timeout: 15000
  });
});

test('TC001 - Successful login with valid username and password', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await Promise.all([
    page.waitForURL(
      '**/inventory.html',
      {
        timeout: 30000
      }
    ),
    page.click(
      '[data-test="login-button"]'
    )
  ]);
  await expect(
    page.locator('[data-test="title"]')
  ).toHaveText('Products');
});

test('TC002 - Login fails with invalid username and valid password', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('invalid_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toContainText(
    'Username and password do not match any user in this service'
  );
});

test('TC003 - Login fails with valid username and invalid password', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('invalid_password');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toContainText(
    'Username and password do not match any user in this service'
  );
});

test('TC004 - Login fails with invalid username and invalid password', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('invalid_user');
  await page.locator('[data-test="password"]').fill('invalid_password');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toContainText(
    'Username and password do not match any user in this service'
  );
});

test('TC005 - Login fails when both mandatory fields are empty', async ({ page }) => {
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toBeVisible();
});

test('TC006 - Login fails when username is empty and password is valid', async ({ page }) => {
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toBeVisible();
});

test('TC007 - Login fails when username is valid and password is empty', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toBeVisible();
});

test('TC008 - Login fails due to username case sensitivity', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('Standard_User');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toContainText(
    'Username and password do not match any user in this service'
  );
});

test('TC009 - Login fails due to password case sensitivity', async ({ page }) => {
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('Secret_Sauce');
  await page.locator('[data-test="login-button"]').click();
  await expect(
    page.locator('[data-test="error"]')
  ).toContainText(
    'Username and password do not match any user in this service'
  );
});