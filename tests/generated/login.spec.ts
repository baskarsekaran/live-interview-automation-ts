import { test, expect } from '@playwright/test';

const LOGIN_URL = 'https://www.saucedemo.com';

test.describe('AI Generated Login Tests', () => {

  test('TC001 - Login with valid username and password', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');

    await page.locator('[data-test="login-button"]').click();

    await expect(page).toHaveURL(/inventory.html/);

    await expect(
      page.locator('[data-test="title"]')
    ).toHaveText('Products');
  });


  test('TC002 - Login with invalid username', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="username"]').fill('invalid_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');

    await page.locator('[data-test="login-button"]').click();

    await expect(
      page.locator('[data-test="error"]')
    ).toBeVisible();
  });


  test('TC003 - Login with invalid password', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('invalid_password');

    await page.locator('[data-test="login-button"]').click();

    await expect(
      page.locator('[data-test="error"]')
    ).toBeVisible();
  });


  test('TC004 - Login with empty username', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="password"]').fill('secret_sauce');

    await page.locator('[data-test="login-button"]').click();

    await expect(
      page.locator('[data-test="error"]')
    ).toBeVisible();
  });


  test('TC005 - Login with empty password', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="username"]').fill('standard_user');

    await page.locator('[data-test="login-button"]').click();

    await expect(
      page.locator('[data-test="error"]')
    ).toBeVisible();
  });


  test('TC006 - Login with both username and password empty', async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator('[data-test="login-button"]').click();

    await expect(
      page.locator('[data-test="error"]')
    ).toBeVisible();
  });

});
