# Next.js App Router

Install `@metanoia/chatbot`, then create one server-side instance in a Node runtime module. Keep credentials in server environment variables and resolve the user through your auth library.

```ts
// app/api/assistant/[...path]/route.ts
import { createChatbot, createChatbotFetchHandler } from "@metanoia/chatbot";

export const runtime = "nodejs";

const chatbot = createChatbot({
  provider: {
    baseUrl: process.env.AI_BASE_URL!,
    apiKey: process.env.AI_API_KEY!,
    model: process.env.AI_MODEL!,
  },
  identity: async request => {
    const user = await getUserFromRequest(request); // your auth library
    return user ? { userId: user.id, profile: { name: user.name } } : null;
  },
});
const handle = createChatbotFetchHandler(chatbot, { basePath: "/api/assistant" });
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS };
```

Use a shared module for chatbot construction if your app has several route files. The widget endpoint is `/api/assistant`; mount the browser widget in a client component. Do not create a new database connection pool for every request.
