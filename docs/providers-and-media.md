# Providers, images, and voice

## Chat provider

Configure `provider.baseUrl`, `provider.apiKey`, and `provider.model` on the server. The backend appends `/chat/completions` to the base URL, streams responses, and normalizes content deltas and usage. Keep the API key server-side. Optional headers and a request timeout can be configured.

For OpenAI-compatible deployments, set `provider.compatibility` to the provider you use so the SDK sends only its documented request extensions:

```js
// DeepInfra
provider: {
  baseUrl: "https://api.deepinfra.com/v1/openai",
  apiKey: process.env.DEEPINFRA_API_KEY,
  model: process.env.DEEPINFRA_MODEL,
  compatibility: "deepinfra",
}

// OpenRouter
provider: {
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "openai/gpt-4o-mini",
  compatibility: "openrouter",
  headers: {
    "HTTP-Referer": "https://your-app.example",
    "X-OpenRouter-Title": "Your App",
  },
}
```

OpenRouter requests use `max_completion_tokens` and the conversation ID as `session_id` so turns in one chat can benefit from provider sticky routing and prompt caching. Its request-level response cache is intentionally not enabled automatically: it replays entire identical responses (including tool calls), and cached usage is zero. Enable it explicitly with `headers: { "X-OpenRouter-Cache": "true" }` only if replaying exact duplicate requests is appropriate for your product. OpenRouter attribution headers are optional for API calls; they identify the integrating application in OpenRouter rankings.

`stream_options.include_usage` is sent by default. Set `provider.includeUsage: false` for a compatible endpoint/model that rejects it; actual provider token usage then won’t be available, and the SDK records its local input estimate instead. Cached input token counts are emitted and persisted when the provider includes them. Stable system instructions and tool definitions are kept early in the prompt to improve provider prompt-cache reuse. `promptCacheKey` is only sent with `compatibility: "openai"`; it is not assumed to be a universal OpenAI-compatible field.

Web search is opt-in. With OpenRouter, set `capabilities.webSearch.enabled: true`; configure `engine`, result limits, and domain filters as needed. The OpenRouter server tool runs search provider-side and the SDK forwards its citation annotations as `citation` SSE/client events; the bundled widget displays safe external source links. Search may incur separate provider charges. For DeepInfra or other providers, register a host-side `tools` function backed by the integrating platform’s search API; this keeps credentials, permissions, and result limits under host control.

Host functions use OpenAI-compatible Chat Completions function tools; each integration supplies the server-side executor. For any provider without built-in search support, register a server-side `web_search` function backed by a service you choose. The core never performs an implicit third-party search or exposes search credentials to clients.

## Images

Image input is off by default. Enable it with `capabilities.images.enabled` and use an image-capable chat model. The upload route accepts JPEG, PNG, and WebP, checks file signatures and dimensions, applies byte/count limits, and serves stored content only to its owner. Uploaded bytes stay in the local SQLite database. The model's image token cost varies, so configure `context.imageTokenReserve` conservatively.

## Voice

Voice input and output are independent opt-ins. Each requires its own OpenAI-compatible base URL, API key, and model; output also requires a voice name. Input records in the browser, sends audio for transcription, and places the returned text in the editable composer. It is not sent until the user presses Send. Output audio is generated only when the user chooses Listen and can be stopped.

The chat API being OpenAI-compatible does not guarantee compatible transcription or speech endpoints. Configure voice only when the provider implements `/audio/transcriptions` and `/audio/speech`. Audio files are size-limited and processed without being retained by the chatbot. Browser recording has a configurable duration cap; the server enforces the audio byte limit.
