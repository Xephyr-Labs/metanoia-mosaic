# Fastify

Register chatbot routes in an encapsulated Fastify plugin. Its pass-through parser preserves JSON and multipart request streams while leaving the host application's parsers intact. The chatbot applies its own request and upload limits.

```ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest, FastifyReply } from "fastify";
import { createChatbot, createChatbotFetchHandler } from "@metanoia/chatbot";

const chatbot = createChatbot({
  provider: { baseUrl, apiKey, model },
  identity: async request => {
    const user = await getUserFromRequest(request);
    return user ? { userId: user.id } : null;
  },
});
await chatbot.ready;
const handler = createChatbotFetchHandler(chatbot, { basePath: "/assistant" });

fastify.register(async assistant => {
  assistant.removeAllContentTypeParsers();
  assistant.addContentTypeParser("*", (_request, payload, done) => done(null, payload));

  const forward = async (request: FastifyRequest, reply: FastifyReply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const method = request.method.toUpperCase();
    const body = method === "GET" || method === "HEAD"
      ? undefined
      : Readable.toWeb((request.body ?? request.raw) as Readable);
    const controller = new AbortController();
    request.raw.once("aborted", () => controller.abort());
    reply.raw.once("close", () => { if (!reply.raw.writableEnded) controller.abort(); });
    const webRequest = new Request(new URL(request.url, `http://${headers.get("host") ?? "localhost"}`), {
      method, headers, signal: controller.signal, ...(body ? { body, duplex: "half" } as RequestInit : {}),
    });
    const response = await handler(webRequest);
    reply.hijack();
    reply.raw.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), reply.raw);
    else reply.raw.end();
  };
  assistant.all("/assistant", forward);
  assistant.all("/assistant/*", forward);
});
```

Keep body-consuming hooks and multipart plugins scoped to the host application's other routes. Stop chatbot work with `await chatbot.close()` before awaiting `fastify.close()` so active SSE responses can finish during shutdown. The Express starter uses `expressHandler` exported from `@metanoia/chatbot`.
