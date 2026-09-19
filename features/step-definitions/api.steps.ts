import { Given, When, Then } from '@cucumber/cucumber';
import { expect, request, APIRequestContext, APIResponse } from '@playwright/test';

let apiContext: APIRequestContext;
let response: APIResponse;

let requestBody: {
  title: string;
  body: string;
  userId: number;
};

Given('I have a new post payload', async function () {

  apiContext = await request.newContext({
    baseURL: process.env.API_BASE_URL
  });

  requestBody = {
    title: 'SDET Interview',
    body: 'API automation test',
    userId: 1
  };
});

When('I send a POST request to the posts API', async function () {

  response = await apiContext.post('/posts', {
    data: requestBody
  });
});

Then('the response status should be 201', async function () {

  expect(response.status()).toBe(201);
});

Then('the response should contain the created post', async function () {

  const responseBody = await response.json();

  expect(responseBody.title).toBe('SDET Interview');
  expect(responseBody.body).toBe('API automation test');
  expect(responseBody.userId).toBe(1);
  expect(responseBody.id).toBeDefined();

  await apiContext.dispose();
});