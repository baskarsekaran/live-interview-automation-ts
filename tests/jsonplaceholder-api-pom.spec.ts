import {
  test,
  request
} from '@playwright/test';

import { PostApiClient } from '../pages/PostApiClient';

test('GET post - validate response', async () => {

  const apiContext = await request.newContext({
    baseURL: process.env.API_BASE_URL
  });

  const postApi = new PostApiClient(apiContext);

  const response = await postApi.getPost(1);

  await postApi.verifyGetPost(response, 1);

  await apiContext.dispose();
});

test('POST post - validate response', async () => {

  const apiContext = await request.newContext({
    baseURL: process.env.API_BASE_URL
  });

  const postApi = new PostApiClient(apiContext);

  const requestBody = {
    title: 'SDET Interview',
    body: 'API automation test',
    userId: 1
  };

  const response = await postApi.createPost(requestBody);

  await postApi.verifyCreatedPost(
    response,
    requestBody
  );

  await apiContext.dispose();
});