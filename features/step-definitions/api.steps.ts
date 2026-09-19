import {
  Given,
  When,
  Then
} from '@cucumber/cucumber';

import {
  request,
  APIRequestContext,
  APIResponse
} from '@playwright/test';

import { PostApiClient } from '../../pages/PostApiClient';

let apiContext: APIRequestContext;
let postApi: PostApiClient;
let response: APIResponse;

let requestBody: {
  title: string;
  body: string;
  userId: number;
};

Given('I have the JSONPlaceholder API', async function () {

  apiContext = await request.newContext({
    baseURL: process.env.API_BASE_URL
  });

  postApi = new PostApiClient(apiContext);
});

When('I send a GET request for post {int}', async function (postId: number) {

  response = await postApi.getPost(postId);
});

Then('the response status should be 200', async function () {

  const status = response.status();

  if (status !== 200) {
    throw new Error(`Expected status 200 but received ${status}`);
  }
});

Then(
  'the response should contain post {int}',
  async function (postId: number) {

    await postApi.verifyGetPost(
      response,
      postId
    );

    await apiContext.dispose();
  }
);

Given('I have a new post payload', async function () {

  apiContext = await request.newContext({
    baseURL: process.env.API_BASE_URL
  });

  postApi = new PostApiClient(apiContext);

  requestBody = {
    title: 'SDET Interview',
    body: 'API automation test',
    userId: 1
  };
});

When(
  'I send a POST request to the posts API',
  async function () {

    response = await postApi.createPost(
      requestBody
    );
  }
);

Then('the response status should be 201', async function () {

  const status = response.status();

  if (status !== 201) {
    throw new Error(`Expected status 201 but received ${status}`);
  }
});

Then(
  'the response should contain the created post',
  async function () {

    await postApi.verifyCreatedPost(
      response,
      requestBody
    );

    await apiContext.dispose();
  }
);