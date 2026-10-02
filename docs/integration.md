# Integration

## Trusted identity

Use the host application's authenticated server session and return a stable user ID. The backend ignores identity fields in browser JSON. A supplied `profile` is refreshed from the trusted resolver and bounded to 20 KB; user-edited preferences take precedence in model context. Return only a small set of fields that are consistently useful for personalization.

```ts
const chatbot = createChatbot({
  provider: { baseUrl, apiKey, model },
  identity: async (request) => {
    const session = await sessions.fromRequest(request);
    return session ? { userId: session.user.id, profile: session.user.profile } : null;
  },
});
```

For a Fetch host, pass requests to `chatbot.handle(request)` and return its `Response`. For Express, mount `expressHandler(chatbot)` at a path. Await `chatbot.ready` before accepting traffic; this completes SQLite setup or PostgreSQL migrations and surfaces configuration/storage failures during startup. The handler serves routes such as `/config`, `/conversations`, `/preferences`, `/memories`, `/media`, `/transcriptions`, and `/speech` below its mount point. Call `await chatbot.close()` on shutdown.

For a local demo only, `anonymous: true` issues an opaque HTTP-only browser cookie. It keeps a stable local identity across process restarts. Do not expose an anonymous instance to the public internet.

## Web and mobile clients

The backend is a transport-neutral HTTP API; the bundled Shadow DOM and React packages are web UIs only. For a custom web UI, React Native, or another mobile application, use `@metanoia/client` for typed conversation, preferences, memory, media, voice, and streaming methods:

```ts
import { createChatbotClient } from "@metanoia/client";

const chatbot = createChatbotClient({
  endpoint: "https://api.example.com/assistant",
  headers: () => ({ authorization: `Bearer ${accessToken}` }),
  fetch: appFetch, // inject a streaming-compatible Fetch implementation when needed
});

const { conversation } = await chatbot.createConversation();
for await (const event of chatbot.sendMessage(conversation.id, { content: "Where is my order?" })) {
  if (event.type === "delta") renderText(event.data.text);
  if (event.type === "tool") showToolStatus(event.data);
}
```

The client has no browser DOM dependency. Your mobile app supplies authentication headers and a Fetch implementation whose response body supports `ReadableStream.getReader()` for incremental SSE. If a platform's default Fetch buffers SSE, inject its streaming adapter. On the server, the integration must authenticate the same user identity; never trust a user ID supplied by the client. Cookie-authenticated browser calls should use HTTPS and a restrictive `allowedOrigins` list for cross-origin deployments.

## Storage and isolation

The default SQLite database is `./data/chatbot.sqlite`; configure a different path with `storage.filename`. Each instance gets an instance ID namespace and each query is scoped to it and the resolved user. Keep one SQLite instance on one process. For shared state, use `storage: { type: "postgres", connectionString }`. PostgreSQL migrations run during initialization, and media is stored in the database by default.

## API behavior

Messages are submitted as JSON to `POST /conversations/:id/messages`:

```json
{"content":"Help me compare these options","requestId":"stable-client-request-id"}
```

The response is Server-Sent Events with `delta`, `usage`, `status`, `done`, and `error` events; enabled conversation-aware prompts arrive in a `suggestions` event. A request ID cannot be accepted twice. Concurrent generation for one conversation returns a conflict. The bundled widget disables its send button while a submission is in flight. Provider credentials and detailed provider errors stay server-side. Media, transcription, speech, preferences, memories, and user-data deletion use the same resolved identity. When image input is enabled, uploaded images stay linked to their user message and are included in relevant follow-up context, bounded by the configured image count and token reserve.

Set `allowedOrigins` for browser origins. Allowed cross-origin requests get CORS headers and preflight handling; with no list, the server accepts same-origin requests only. Native clients without an `Origin` header use the same authenticated API. Configure `rateLimit` per instance to cap requests per user and window. Run the endpoint behind HTTPS when deployed.

Set `personalization: { autoMemory: true }` to enable bounded memory extraction. It is off by default because extraction makes additional provider requests and uses tokens. `context.summaryAfterMessages` controls when old turns are summarized; summary and memory usage are recorded separately. `onEvent` can receive redacted request, usage, and maintenance events for server-side diagnostics.

## Web search

With OpenRouter compatibility enabled, you can turn on its hosted web-search tool without registering a host callback. Results are streamed as citation events and rendered by the bundled widget:

```ts
const chatbot = createChatbot({
  provider: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "your-selected-model",
    compatibility: "openrouter",
  },
  capabilities: {
    webSearch: {
      enabled: true,
      engine: "auto",
      maxResults: 5,
      maxUses: 3,
      allowedDomains: ["docs.example.com"],
    },
  },
  identity: resolveIdentity,
});
```

Hosted search is provider-specific and may add provider charges. It currently requires `compatibility: "openrouter"`. For OpenAI-compatible providers such as DeepInfra, register a host-side `web_search` tool backed by your chosen search service; the callback receives the authenticated user identity so it can apply the host application's access rules. The headless client emits `citation` events too, so custom web and mobile UIs can render sources.

## Host application tools

Register server-side functions to retrieve current application data or actions. Tool calls run only on the server and receive the resolved `identity`, original `request`, `conversationId`, abort signal, and a request `requestId`. Arguments are checked against a practical JSON Schema subset (object shape, required keys, types, enums, nested values, and common bounds) before execution. Keep tools narrowly scoped and enforce authorization and business validation inside each callback; chatbot validation is defense in depth. Make side-effecting tools idempotent and implement any user confirmation flow in the host app. Limit tool calls and execution time with `maxToolCallsPerTurn` and `toolTimeoutMs`.

Tool results share a bounded context reserve (`context.toolTokenReserve`, default 800 estimated tokens when tools are configured); results beyond it are omitted. Increase it only when your model context and cost budget allow.

```ts
tools: [{
  name: "get_order_status",
  description: "Look up the signed-in user's order status by order number.",
  parameters: {
    type: "object",
    properties: { orderNumber: { type: "string", maxLength: 64 } },
    required: ["orderNumber"],
    additionalProperties: false,
  },
  execute: async ({ orderNumber }, { identity, signal }) =>
    orders.getForUser(identity.userId, String(orderNumber), { signal }),
}],
```

The model may choose a registered function, the chatbot executes it, and then the model resumes; the final answer continues over SSE. `tool` events indicate running, completed, or failed calls.
