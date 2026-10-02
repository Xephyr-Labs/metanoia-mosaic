import express from "express";
import { createRequire } from "node:module";
import { createChatbot, expressHandler } from "@metanoia/chatbot";
import { getAuthenticatedUser } from "./auth.js";

const app = express();
const require = createRequire(import.meta.url);
const widgetLoader = require.resolve("@metanoia/widget/loader");
const chatbot = createChatbot({
  provider: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    compatibility: process.env.AI_COMPATIBILITY ?? "openai",
  },
  identity: async request => {
    const user = await getAuthenticatedUser(request);
    return user ? { userId: user.id, profile: user.profile } : null;
  },
  storage: { type: "sqlite", filename: "./data/chatbot.sqlite" },
  branding: { name: "Mosaic Assistant", greeting: "How can I help?" },
});

await chatbot.ready;
app.use("/assistant", expressHandler(chatbot));
app.get("/metanoia-chat.js", (_request, response) => response.sendFile(widgetLoader));
app.get("/", (_request, response) => response.type("html").send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mosaic Assistant</title><body><metanoia-chat endpoint="/assistant" name="Mosaic Assistant"></metanoia-chat><script src="/metanoia-chat.js" defer></script></body></html>`));
const server = app.listen(Number(process.env.PORT ?? 3000));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(async () => { await chatbot.close(); process.exit(0); }));
