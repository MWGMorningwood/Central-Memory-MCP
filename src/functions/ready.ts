import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function readyHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: 'ready',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

// Register the readiness function
app.http('ready', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ready',
  handler: readyHandler
});
