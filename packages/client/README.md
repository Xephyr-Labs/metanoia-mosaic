# @metanoialabs/client

A typed, headless client for [Metanoia Mosaic](https://github.com/Xephyr-Labs/metanoia-mosaic). Use it to build your own chat UI on the web, React Native, or Expo, against a [`@metanoialabs/chatbot`](https://www.npmjs.com/package/@metanoialabs/chatbot) backend. It has no DOM dependency and no runtime dependencies.

```sh
npm install @metanoialabs/client
```

## Usage

```js
import { createChatbotClient } from "@metanoialabs/client";

const bot = createChatbotClient({
  endpoint: "https://api.example.com/assistant",
  headers: async () => ({ authorization: `Bearer ${await getAccessToken()}` }),
});

const { conversation } = await bot.createConversation();

for await (const event of bot.sendMessage(conversation.id, { content: "Where is my order?" })) {
  if (event.type === "delta") appendText(event.data.text);
  if (event.type === "tool") showToolStatus(event.data.label, event.data.status);
  if (event.type === "suggestions") showSuggestions(event.data.prompts);
  if (event.type === "error") showError(event.data.message);
}
```

Pass `signal` in `sendMessage` to stop a reply, and `requestId` to make retries safe from duplicate submits.

## Options

| Option | Purpose |
| --- | --- |
| `endpoint` | URL where the backend is mounted (required) |
| `headers` | Object or `async () => headers`, called on every request |
| `fetch` | Custom Fetch implementation. It must support streaming response bodies |
| `credentials` | Defaults to `"include"` for cookie sessions |

## Methods

| Area | Methods |
| --- | --- |
| Setup | `config()` |
| Conversations | `conversations()`, `createConversation()`, `conversation(id)`, `deleteConversation(id)` |
| Messages | `sendMessage(conversationId, { content, requestId?, mediaIds?, signal? })`: async iterator of events |
| Preferences | `preferences()`, `updatePreferences(preferences)` |
| Memories | `memories()`, `addMemory(content)`, `updateMemory(id, content)`, `deleteMemory(id)` |
| Media | `uploadImage(conversationId, file)`, `transcribe(file)`, `speech(text)` |
| Privacy | `deleteUserData()` |

Every method takes an optional `AbortSignal` as its last argument. Failed requests throw `ChatbotClientError`, which includes `status` and `code`.

Stream event types: `delta`, `tool`, `citation`, `status`, `suggestions`, `usage`, `done`, `error`.

## React Native and Expo

Files can be a `Blob` or `{ uri, name, type }`. Streaming replies need a Fetch whose response body supports `getReader()`. If your platform's default Fetch buffers the whole response, pass a streaming one via `fetch`. See the [React Native / Expo example](https://github.com/Xephyr-Labs/metanoia-mosaic/tree/main/examples/react-native).

The server decides who the user is. Send your app's auth headers and never send a user ID.

## License

MIT
