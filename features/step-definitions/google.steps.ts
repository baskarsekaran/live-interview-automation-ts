import {
  Given,
  When,
  Then
} from '@cucumber/cucumber';

import { GooglePage } from '../../pages/GooglePage';

Given('I open the Google website', async function () {

  this.googlePage = new GooglePage(this.page);

  await this.googlePage.open();

  await this.googlePage.verifyGooglePage();
});

When('I search for {string}', async function (searchText: string) {

  await this.googlePage.search(searchText);
});

Then(
  'the search results page should contain {string}',
  async function (expectedText: string) {

    await this.googlePage.verifySearchResult(expectedText);
  }
);