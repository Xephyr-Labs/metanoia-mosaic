# Hono

The Hono adapter uses its standard Fetch request and response objects with Node adapters such as `@hono/node-server`. The chatbot package requires Node.js, including its built-in storage dependencies.

```ts
import { Hono } from "hono";
import { createChatbot, createChatbotFetchHandler } from "@metanoia/chatbot";

const chatbot = createChatbot({
  provider: { baseUrl, apiKey, model },
  identity: async request => {
    const user = await getUserFromRequest(request);
    return user ? { userId: user.id } : null;
  },
});
const handler = createChatbotFetchHandler(chatbot, { basePath: "/assistant" });
const app = new Hono();
app.all("/assistant", context => handler(context.req.raw));
app.all("/assistant/*", context => handler(context.req.raw));
export default app;
```

Create the chatbot once at module scope and await `chatbot.ready` in your server startup path. Use a database adapter supported by your deployment runtime; the built-in SQLite/PostgreSQL stores target Node.js.
