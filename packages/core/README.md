# @metanoialabs/chatbot

The server side of [Metanoia Mosaic](https://github.com/Xephyr-Labs/metanoia-mosaic), a self-hosted AI assistant you add to your own app. It streams replies from any OpenAI-compatible model, runs your server-side tools, and stores conversations, memories, and media in SQLite or PostgreSQL. Provider keys never reach the browser.

```sh
npm install @metanoialabs/chatbot
```

Requires Node.js 20 or newer.

## Usage

```js
import express from "express";
import { createChatbot, expressHandler } from "@metanoialabs/chatbot";

const chatbot = createChatbot({
  provider: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    compatibility: "openai", // or "openrouter" | "deepinfra"; omit for other compatible APIs
  },
  // Resolve the user from YOUR session. Never trust a user ID sent by the browser.
  identity: async request => {
    const user = await getSessionUser(request);
    return user ? { userId: user.id, profile: { name: user.name } } : null;
  },
  storage: { type: "sqlite", filename: "./data/chatbot.sqlite" },
  branding: { name: "Mira", greeting: "How can I help?", personality: "Be warm and concise." },
});

await chatbot.ready; // runs storage setup and migrations
const app = express();
app.use("/assistant", expressHandler(chatbot));
app.listen(3000);

// On shutdown: await chatbot.close();
```

### Other frameworks

Anything that speaks Web `Request`/`Response` (Next.js, Hono, Fastify) can use the Fetch handler:

```js
import { createChatbotFetchHandler } from "@metanoialabs/chatbot";

const handle = createChatbotFetchHandler(chatbot, { basePath: "/assistant" });
// export const GET = handle; export const POST = handle; ...
```

Recipes: [Next.js](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/frameworks/nextjs.md), [Hono](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/frameworks/hono.md), [Fastify](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/frameworks/fastify.md).

## Tools

Register server-side functions the model can call. Arguments are validated against your JSON Schema, and each call runs with the signed-in user's identity and a timeout.

```js
createChatbot({
  // ...
  tools: [{
    name: "lookup_order",
    displayName: "Order lookup",
    description: "Look up the signed-in user's order status by order number.",
    parameters: {
      type: "object",
      properties: { orderNumber: { type: "string", maxLength: 64 } },
      required: ["orderNumber"],
      additionalProperties: false,
    },
    execute: async ({ orderNumber }, { identity, signal }) =>
      orders.statusFor(identity.userId, orderNumber, { signal }),
  }],
});
```

## Input guard

Screen what users type before the model or storage sees it: moderation, topic limits, prompt-injection checks, or blocking abusive accounts. `inputGuard` runs on every chat message, every memory the user writes and every preference update.

```js
createChatbot({
  // ...
  inputGuard: async ({ identity, content, kind, conversationId }) => {
    const verdict = await moderation.check(identity.userId, content);
    return verdict.ok ? { allow: true } : { allow: false, reply: verdict.message };
  },
});
```

A refused message is answered with `reply` as a normal streamed answer, without calling the model; the history keeps a placeholder instead of the user's text, so it never re-enters the context. A refused memory or preference update gets `422 input_rejected`. If the guard throws, the request fails closed with `503 guard_unavailable`.

## Deleting a user's data

Call `await chatbot.deleteUserData(userId)` when your app deletes an account: it stops the user's active replies and removes their conversations, memories, preferences and stored profile. Users can also do this themselves with `DELETE /user-data`.

## Main options

| Option | Purpose |
| --- | --- |
| `provider` | `baseUrl`, `apiKey`, `model`, and `compatibility` for the chat model |
| `identity` | `async (request) => ({ userId, profile? }) \| null` from your own session |
| `storage` | `{ type: "sqlite", filename }` (one process) or `{ type: "postgres", connectionString }` |
| `branding` | Name, avatar, greeting, personality, suggested prompts, colors, theme |
| `capabilities` | Opt-ins: `suggestions`, `images`, `voiceInput`, `voiceOutput`, `webSearch` (OpenRouter) |
| `personalization` | `{ autoMemory: true }` to extract memories automatically (off by default) |
| `tools` | Server-side functions, limited by `maxToolCallsPerTurn` and `toolTimeoutMs` |
| `allowedOrigins` | Browser origins allowed cross-origin. Same-origin only when unset |
| `rateLimit` | Per-user request limit |
| `inputGuard` | Screens each message and memory before the model sees it (see above) |

## Clients

- [`@metanoialabs/widget`](https://www.npmjs.com/package/@metanoialabs/widget): drop-in chat widget for any web page
- [`@metanoialabs/react`](https://www.npmjs.com/package/@metanoialabs/react): React component
- [`@metanoialabs/client`](https://www.npmjs.com/package/@metanoialabs/client): headless client for custom UIs and React Native

## Documentation

- [Setup and integration](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/setup.md)
- [API routes, SSE events, storage](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/integration.md)
- [Providers, images, and voice](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/providers-and-media.md)
- [Personalization and privacy](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/personalization-and-privacy.md)

## License

MIT
