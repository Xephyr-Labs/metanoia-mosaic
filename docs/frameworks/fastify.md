# Fastify

For Fastify, keep the chatbot instance at module scope and bridge Fastify's raw request and reply streams to the Fetch API. This preserves multipart image uploads and incremental SSE responses.

```ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createChatbot, createChatbotFetchHandler } from "@metanoia/chatbot";

const chatbot = createChatbot({
  provider: { baseUrl, apiKey, model },
  identity: async request => {
    const user = await getUserFromRequest(request);
    return user ? { userId: user.id } : null;
  },
});
const handler = createChatbotFetchHandler(chatbot, { basePath: "/assistant" });

fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
fastify.all("/assistant/*", async (request, reply) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : Buffer.isBuffer(request.body) ? request.body : Readable.toWeb(request.raw);
  const controller = new AbortController();
  reply.raw.once("close", () => { if (!reply.raw.writableEnded) controller.abort(); });
  const webRequest = new Request(new URL(request.url, `http://${headers.get("host") ?? "localhost"}`), {
    method, headers, signal: controller.signal, ...(body ? { body, duplex: "half" } as RequestInit : {}),
  });
  const response = await handler(webRequest);
  reply.hijack();
  reply.raw.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) await pipeline(Readable.fromWeb(response.body), reply.raw);
  else reply.raw.end();
});
```

Fastify parser configuration varies with installed plugins. Keep the chatbot routes before multipart/body-consumer hooks, and confirm the route's raw request body remains available for multipart uploads. The `@metanoia/chatbot/express` adapter is simpler when using Express.
