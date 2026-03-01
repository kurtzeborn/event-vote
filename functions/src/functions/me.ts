import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getAuthUser, isVotekeeper } from '../auth.js';
import { MeResponse } from '../types.js';

async function me(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const user = getAuthUser(request);

  if (!user) {
    const response: MeResponse = {
      isAuthenticated: false,
      isVotekeeper: false,
    };
    return { jsonBody: response };
  }

  const isKeeper = await isVotekeeper(user.userDetails);

  const response: MeResponse = {
    isAuthenticated: true,
    isVotekeeper: isKeeper,
    user,
  };

  return { jsonBody: response };
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: me,
});
