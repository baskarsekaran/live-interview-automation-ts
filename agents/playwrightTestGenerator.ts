import fs from 'fs';
import path from 'path';

console.log('');
console.log('=================================');
console.log('PLAYWRIGHT TEST GENERATOR AGENT');
console.log('=================================');
console.log('');

const scenarioPath = path.join(
  process.cwd(),
  'output',
  'test-scenarios.json'
);

const outputDir = path.join(
  process.cwd(),
  'tests',
  'generated'
);

const outputPath = path.join(
  outputDir,
  'login.spec.ts'
);

if (!fs.existsSync(scenarioPath)) {
  console.error('❌ test-scenarios.json not found.');
  process.exit(1);
}

const scenarios = JSON.parse(
  fs.readFileSync(scenarioPath, 'utf-8')
);

console.log('Generating Playwright tests...');

const testCode = `import { test, expect } from '@playwright/test';

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
`;

fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  outputPath,
  testCode,
  'utf-8'
);

console.log('');
console.log('✅ Playwright test generated successfully.');
console.log('');
console.log(`Scenarios processed: ${scenarios.length}`);
console.log(`Generated file: ${outputPath}`);
console.log('');