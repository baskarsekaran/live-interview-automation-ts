import { test, expect } from '@playwright/test';

test('GET post - validate response', async ({ request }) => {

//   const response = await request.get(
//     'https://jsonplaceholder.typicode.com/posts/1'
//   );

const response = await request.get(
  `${process.env.API_BASE_URL}/posts/1`
);

  // Validate status code
  expect(response.status()).toBe(200);

  // Get response body
  const responseBody = await response.json();

  // Validate response fields
  expect(responseBody.id).toBe(1);
  expect(responseBody.userId).toBe(1);
  expect(responseBody.title).not.toBe('');
  expect(responseBody.body).not.toBe('');
});


test('POST post - validate response', async ({ request }) => {

  const requestBody = {
    title: 'SDET Interview',
    body: 'API automation test',
    userId: 1
  };

//   const response = await request.post(
//     'https://jsonplaceholder.typicode.com/posts',
//     {
//       data: requestBody
//     }
//   );

  const response = await request.post(
  `${process.env.API_BASE_URL}/posts`,
  {
    data: requestBody
  }
);

  // Validate status code
  expect(response.status()).toBe(201);

  // Get response body
  const responseBody = await response.json();

  // Validate response
  expect(responseBody.title).toBe('SDET Interview');
  expect(responseBody.body).toBe('API automation test');
  expect(responseBody.userId).toBe(1);
  expect(responseBody.id).toBeDefined();
});