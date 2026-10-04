# Setup and integration

Metanoia Mosaic is a Node.js workspace containing a server package and optional web clients. Node.js 20 or newer is required. The packages are prepared for public npm releases. Until the first release is published, use the workspace and local examples.

## Get the workspace

```sh
git clone https://github.com/Xephyr-Labs/metanoia-mosaic.git
cd metanoia-mosaic
npm ci
npm run build
npm run typecheck
```

The build generates the `dist/` files consumed by the packages. Run the local generator with `npm run create -- --name my-assistant --yes`. Its generated dependencies require published packages or local tarballs; the Express workspace example runs directly from this checkout. When published, scaffold an Express starter with `npm create metanoia-mosaic`. `npm run dev:example` starts the Express demo after its `.env` is configured. To preview it without a provider key, use mock mode:

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
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    try {
      const stopped = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await chatbot.close();
      server.closeAllConnections();
      await stopped;
      process.exit(0);
    } catch (error) { console.error(error); process.exit(1); }
  });
}
```

Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in the server environment. For OpenRouter or DeepInfra, use the provider's OpenAI-compatible base URL and set `AI_COMPATIBILITY` to `openrouter` or `deepinfra`. Never expose provider keys to the browser.

The Express adapter receives requests below `/assistant` and serves routes such as `/config` and `/conversations` relative to that mount. For another Node.js framework, pass the incoming `Request` to `chatbot.handle(request)` and return its `Response`. Await `chatbot.ready` before accepting requests, and call `chatbot.close()` during shutdown.

## Add the widget without a framework

After the first npm release, a plain HTML page can load the bundled custom element directly:

```html
<script src="https://cdn.jsdelivr.net/npm/@metanoia/widget@0/dist/loader.js" defer></script>
<metanoia-chat endpoint="/assistant" name="Mira" avatar-url="/assistant.svg" theme="system"></metanoia-chat>
```

For bearer authentication or persisted thread state, set properties before attaching the element:

```js
const assistant = document.createElement("metanoia-chat");
assistant.setAttribute("endpoint", "/assistant");
assistant.headers = async () => ({ authorization: `Bearer ${await getFreshAccessToken()}` });
const key = "assistant-thread:" + currentUser.stableId; // scope per signed-in user
assistant.conversationStore = {
  load: () => localStorage.getItem(key) ?? undefined,
  save: id => localStorage.setItem(key, id),
  clear: () => localStorage.removeItem(key),
};
document.querySelector("#assistant-root").append(assistant);
```

The custom element accepts `credentials`, `locale`, and `dir` attributes, plus a localized `labels` JavaScript property. Keep persisted conversation IDs namespaced to the authenticated user. On sign-out or account changes, clear the old store and remove/recreate the element so drafts and in-memory messages are discarded too.

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

Pass branding and style through `mount` or the server's `branding` configuration. `WidgetOptions.labels` replaces built-in UI text; `locale` sets the assistant element language and `dir` supports left-to-right, right-to-left, or locale-detected direction. The widget supports accessible names, keyboard focus, escape-to-close, and live response announcements. The widget uses Shadow DOM so its styles stay isolated from the host page. See [customization](customization.md) for all options and suggestion-pill behavior.

For framework-specific server examples, see the [Next.js](frameworks/nextjs.md), [Hono](frameworks/hono.md), and [Fastify](frameworks/fastify.md) recipes. For native UI, start with the [React Native / Expo example](../examples/react-native/README.md). For React web UI, use `@metanoia/react`. For a custom web or mobile interface, use `@metanoia/client` to call the same HTTP API and consume its streamed events. Mobile clients must provide authenticated headers and a Fetch implementation that supports readable streaming for incremental SSE.

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

## Publish packages

The GitHub release workflow uses Changesets 3 and `changesets/action@v2`. Add a changeset with `npm run changeset`, merge the generated version pull request, and the workflow publishes the changed packages. Configure the repository `NPM_TOKEN` secret with publish access to the `@metanoia` scope and `create-metanoia-mosaic`; the workflow passes it to npm as `NODE_AUTH_TOKEN`. Enable GitHub Actions to create release commits and pull requests. The CLI build takes backend/widget versions from the workspace, so generated starters always target the versions being published.
