// The Supabase Edge Runtime provides Deno.serve; this local type also keeps
// the function source checkable by the app's TypeScript configuration.
const edgeRuntime = globalThis as typeof globalThis & {
  Deno: {
    serve(handler: (request: Request) => Response | Promise<Response>): void;
  };
};

edgeRuntime.Deno.serve(() =>
  new Response('Hello from Supabase Edge Functions.', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  }),
);
