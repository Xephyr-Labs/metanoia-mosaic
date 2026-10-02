import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createChatbot, expressHandler } from "@metanoia/chatbot";
import { createChatbotClient } from "@metanoia/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(tmpdir(), "metanoia-chat-smoke-"));
const originalFetch = globalThis.fetch;
const upstreamRequests = [];
let chatbot;
let disabledSuggestionsBot;

function expressFetch(handler) {
  return async (input, init = {}) => new Promise((resolve, reject) => {
    const target = new URL(String(input));
    const requestHeaders = Object.fromEntries(new Headers(init.headers));
    requestHeaders.host = target.host;
    const request = Readable.from(init.body ? [Buffer.from(String(init.body))] : []);
    Object.assign(request, {
      method: init.method ?? "GET",
      url: target.pathname.replace(/^\/assistant/, "") || "/",
      protocol: target.protocol.slice(0, -1),
      headers: requestHeaders,
    });
    let status = 200;
    const headers = new Headers();
    const chunks = [];
    const response = {
      status(code) { status = code; return this; },
      setHeader(name, value) { headers.set(name, value); },
      write(chunk) { chunks.push(Buffer.from(chunk)); return true; },
      on() { return this; },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        resolve(new Response(body.length ? body : null, { status, headers }));
      },
    };
    void handler(request, response, reject);
  });
}

try {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin !== "https://mock-provider.test") return originalFetch(input, init);
    const payload = JSON.parse(String(init.body));
    upstreamRequests.push(payload);
    if (payload.stream === false) {
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ suggestions: ["Compare the available plans", "Show me billing settings"] }) } }],
        usage: { prompt_tokens: 24, completion_tokens: 14 },
      });
    }
    const encoder = new TextEncoder();
    const chunks = [
      { choices: [{ delta: { content: "The demo assistant is connected." } }] },
      { choices: [{ delta: {} }], usage: { prompt_tokens: 18, completion_tokens: 7 } },
    ];
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream" } });
  };

  chatbot = createChatbot({
    instanceId: "smoke-test",
    provider: { baseUrl: "https://mock-provider.test/v1", apiKey: "smoke-key", model: "smoke-model", compatibility: "openai" },
    storage: { type: "sqlite", filename: path.join(temp, "chat.sqlite") },
    identity: () => ({ userId: "smoke-user" }),
    branding: { name: "Mira", avatarUrl: "/assistant.svg", greeting: "Hello from the smoke test." },
    capabilities: { suggestions: { enabled: true, count: 2 } },
  });
  await chatbot.ready;

  const client = createChatbotClient({
    endpoint: "http://localhost/assistant",
    credentials: "omit",
    fetch: expressFetch(expressHandler(chatbot)),
  });
  const config = await client.config();
  assert.equal(config.branding.name, "Mira");
  assert.equal(config.capabilities.suggestions, true);
  assert.equal(config.capabilities.suggestionCount, 2);
  const { conversation } = await client.createConversation();
  const received = [];
  for await (const event of client.sendMessage(conversation.id, { content: "Can you help?", requestId: "smoke-request-1" })) received.push(event);
  assert.equal(received.find(event => event.type === "delta")?.data.text, "The demo assistant is connected.");
  assert.ok(received.some(event => event.type === "status" && event.data.message.includes("next steps")));
  assert.deepEqual(received.find(event => event.type === "suggestions")?.data.prompts, ["Compare the available plans", "Show me billing settings"]);
  assert.ok(received.some(event => event.type === "done"), "the client should receive a completion event");
  const saved = await client.conversation(conversation.id);
  assert.equal(saved.messages.at(-1)?.content, "The demo assistant is connected.");
  assert.equal(upstreamRequests.length, 2, "enabled follow-up suggestions should make one bounded non-streaming request");
  assert.equal(upstreamRequests[0].model, "smoke-model");
  assert.equal(upstreamRequests[0].messages.at(-1).content, "Can you help?");
  assert.equal(upstreamRequests[1].stream, false);

  disabledSuggestionsBot = createChatbot({
    instanceId: "smoke-test-disabled-suggestions",
    provider: { baseUrl: "https://mock-provider.test/v1", apiKey: "smoke-key", model: "smoke-model", compatibility: "openai" },
    storage: { type: "sqlite", filename: path.join(temp, "chat-disabled.sqlite") },
    identity: () => ({ userId: "smoke-user" }),
  });
  await disabledSuggestionsBot.ready;
  const disabledClient = createChatbotClient({
    endpoint: "http://localhost/assistant",
    credentials: "omit",
    fetch: expressFetch(expressHandler(disabledSuggestionsBot)),
  });
  assert.equal((await disabledClient.config()).capabilities.suggestions, false);
  const { conversation: disabledConversation } = await disabledClient.createConversation();
  const disabledEvents = [];
  for await (const event of disabledClient.sendMessage(disabledConversation.id, { content: "A second turn without suggestions", requestId: "smoke-request-2" })) disabledEvents.push(event);
  assert.ok(!disabledEvents.some(event => event.type === "suggestions"), "suggestions should be off by default");
  assert.equal(upstreamRequests.length, 3, "disabled suggestions should not make an extra provider request");

  const html = await readFile(path.join(root, "public/index.html"), "utf8");
  const app = await readFile(path.join(root, "public/app.js"), "utf8");
  await readFile(path.resolve(root, "../../packages/widget/dist/index.js"));
  assert.match(html, /\/widget\/index\.js|\/app\.js/);
  assert.match(app, /from "\/widget\/index\.js"/);
  console.log("Smoke passed: client → Express adapter → chatbot → OpenAI-compatible stream → persisted conversation.");
} finally {
  globalThis.fetch = originalFetch;
  if (disabledSuggestionsBot) await disabledSuggestionsBot.close();
  if (chatbot) await chatbot.close();
  await rm(temp, { recursive: true, force: true });
}
