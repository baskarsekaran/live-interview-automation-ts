import { test } from '@playwright/test';
import { GooglePage } from '../pages/GooglePage';

test('Google search test', async ({ page }) => {

  const googlePage = new GooglePage(page);

  await googlePage.open();

  await googlePage.verifyGooglePage();

  await googlePage.search('Selenium Java');

  await googlePage.verifySearchResult('Selenium');
});