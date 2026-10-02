# Setup and integration

Metanoia Mosaic is a Node.js workspace containing a server package and optional web clients. Node.js 20 or newer is required. The packages are currently maintained in this repository; install them from the workspace or build package archives for local application testing.

## Get the workspace

```sh
git clone https://github.com/Xephyr-Labs/metanoia-mosaic.git
cd metanoia-mosaic
npm ci
npm run build
npm run typecheck
```

The build generates the `dist/` files consumed by the packages. `npm run dev:example` starts the Express demo after its `.env` is configured. To preview it without a provider key, use mock mode:

```sh
CHATBOT_DEMO_MODE=true npm run start --workspace @metanoia/example-express
```

Mock replies are synthetic. The demo enables anonymous identity and is intended for local development only.

## Connect a Node.js application

Create the chatbot on your server and resolve identity from the application's authenticated session. Do not accept user IDs from browser request bodies.

```js
import express from "express";
import { createChatbot, expressHandler } from "@metanoia/chatbot";

const app = express();
const chatbot = createChatbot({
  provider: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    compatibility: process.env.AI_COMPATIBILITY ?? "openai",
  },
  storage: { type: "sqlite", filename: "./data/chatbot.sqlite" },
  identity: async request => {
    const session = await readYourApplicationSession(request);
    return session ? { userId: session.user.id, profile: session.user.profile } : null;
  },
  allowedOrigins: ["https://app.example.com"],
  branding: {
    name: "Mira",
    avatarUrl: "/assistant.svg",
    greeting: "How can I help?",
    personality: "Be warm, direct, and concise.",
  },
  capabilities: {
    suggestions: { enabled: true, count: 3 },
    images: { enabled: false },
    voiceInput: { enabled: false },
    voiceOutput: { enabled: false },
  },
});

await chatbot.ready;
app.use("/assistant", expressHandler(chatbot));

const server = app.listen(3000);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(async () => {
    await chatbot.close();
    process.exit(0);
  }));
}
```

Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in the server environment. For OpenRouter or DeepInfra, use the provider's OpenAI-compatible base URL and set `AI_COMPATIBILITY` to `openrouter` or `deepinfra`. Never expose provider keys to the browser.

The Express adapter receives requests below `/assistant` and serves routes such as `/config` and `/conversations` relative to that mount. For another Node.js framework, pass the incoming `Request` to `chatbot.handle(request)` and return its `Response`. Await `chatbot.ready` before accepting requests, and call `chatbot.close()` during shutdown.

## Add the web widget

Install or link `@metanoia/widget` into the frontend build, then mount it once on a page:

```js
import { mount } from "@metanoia/widget";

const assistant = mount(document.querySelector("#assistant"), {
  endpoint: "/assistant",
  name: "Mira",
  avatarUrl: "/assistant.svg",
  theme: "system",
  colors: { accent: "#536d62" },
});

await assistant.ready;
```

Pass branding and style through `mount` or the server's `branding` configuration. The widget uses Shadow DOM so its styles stay isolated from the host page. See [customization](customization.md) for all options and suggestion-pill behavior.

For React, use `@metanoia/react`. For a custom web or mobile interface, use `@metanoia/client` to call the same HTTP API and consume its streamed events. Mobile clients must provide authenticated headers and a Fetch implementation that supports readable streaming for incremental SSE.

## Choose storage and capabilities

SQLite is the default and is intended for one Node.js process. For shared deployments, configure PostgreSQL:

```js
storage: { type: "postgres", connectionString: process.env.DATABASE_URL }
```

Use the trusted identity resolver to provide a stable user ID and a small profile containing only information useful for personalization. User preferences and saved memories are scoped to that identity. Automatic memory extraction is off by default; enable it with `personalization: { autoMemory: true }` when appropriate.

Image input, voice input, and voice output are separate opt-ins under `capabilities`. Each media provider needs its own compatible URL, key, and model. Conversation-aware suggestion pills also make an extra short completion per reply, so enable them only when their added latency and token use fit your product. See [provider and media setup](providers-and-media.md) and [personalization and privacy](personalization-and-privacy.md).

## Verify and run the example

```sh
npm run build
npm run typecheck
npm run smoke --workspace @metanoia/example-express
```

The Express example includes a configured demo UI and a mocked provider mode. For a real provider, copy `examples/express/.env.example` to `.env`, fill in provider settings, and run:

```sh
npm run dev --workspace @metanoia/example-express
```

Open `http://localhost:3000`. See [the example guide](../examples/express/README.md) for network access and deployment notes.
