import { test, expect } from '@playwright/test';

test('GET post - direct API test', async ({ request }) => {

  const response = await request.get(
    `${process.env.API_BASE_URL}/posts/1`
  );

  expect(response.status()).toBe(200);

  const responseBody = await response.json();

  expect(responseBody.id).toBe(1);
  expect(responseBody.userId).toBe(1);
  expect(responseBody.title).not.toBe('');
  expect(responseBody.body).not.toBe('');
});


test('POST post - direct API test', async ({ request }) => {

  const requestBody = {
    title: 'SDET Interview',
    body: 'API automation test',
    userId: 1
  };

  const response = await request.post(
    `${process.env.API_BASE_URL}/posts`,
    {
      data: requestBody
    }
  );

  expect(response.status()).toBe(201);

  const responseBody = await response.json();

  expect(responseBody.title).toBe('SDET Interview');
  expect(responseBody.body).toBe('API automation test');
  expect(responseBody.userId).toBe(1);
  expect(responseBody.id).toBeDefined();
});