import dotenv from 'dotenv';

dotenv.config({
  path: `config/${process.env.ENV || 'test'}.env`
});

import {
  Before,
  After,
  setDefaultTimeout
} from '@cucumber/cucumber';

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import fs from 'fs';

setDefaultTimeout(30000);

let browser: Browser;
let context: BrowserContext;

Before(async function () {

  browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  context = await browser.newContext({
    recordVideo: {
      dir: 'reports/videos'
    }
  });

  this.context = context;
  this.page = await context.newPage();
});

After(async function (scenario) {

  // Take screenshot if scenario fails
  if (scenario.result?.status === 'FAILED') {

    const screenshot = await this.page.screenshot();

    await this.attach(
      screenshot,
      'image/png'
    );
  }

  // Get video reference before closing
  const video = this.page.video();

  // Close context so Playwright finishes the video
  await context?.close();

  // Attach video to Cucumber report
  if (video) {

    const videoPath = await video.path();

    if (videoPath && fs.existsSync(videoPath)) {

      const videoBuffer = fs.readFileSync(videoPath);

      await this.attach(
        videoBuffer,
        'video/webm'
      );
    }
  }

  await browser?.close();
});