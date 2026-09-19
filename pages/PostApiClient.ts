import {
  APIRequestContext,
  APIResponse,
  expect
} from '@playwright/test';

export class PostApiClient {

  readonly apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  async getPost(postId: number): Promise<APIResponse> {

    return await this.apiContext.get(`/posts/${postId}`);
  }

  async createPost(requestBody: {
    title: string;
    body: string;
    userId: number;
  }): Promise<APIResponse> {

    return await this.apiContext.post('/posts', {
      data: requestBody
    });
  }

  async verifyGetPost(response: APIResponse, postId: number) {

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    expect(responseBody.id).toBe(postId);
    expect(responseBody.userId).toBeDefined();
    expect(responseBody.title).not.toBe('');
    expect(responseBody.body).not.toBe('');
  }

  async verifyCreatedPost(
    response: APIResponse,
    requestBody: {
      title: string;
      body: string;
      userId: number;
    }
  ) {

    expect(response.status()).toBe(201);

    const responseBody = await response.json();

    expect(responseBody.title).toBe(requestBody.title);
    expect(responseBody.body).toBe(requestBody.body);
    expect(responseBody.userId).toBe(requestBody.userId);
    expect(responseBody.id).toBeDefined();
  }
}