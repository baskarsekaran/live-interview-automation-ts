
import dotenv from 'dotenv';

dotenv.config({
  path: `config/${process.env.ENV || 'test'}.env`
});

import {
  Before,
  After,
  setDefaultTimeout
} from '@cucumber/cucumber';

import { chromium, Browser, Page } from '@playwright/test';

setDefaultTimeout(30000);

let browser: Browser;

Before(async function () {
  browser = await chromium.launch({
    headless: true
  });

  this.browser = browser;
  this.page = await browser.newPage();
});

After(async function () {
  await browser?.close();
});