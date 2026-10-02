# Omni chatbot design

## Approved direction

Build a self-hosted chatbot that integrates into Node.js applications. Ship a working browser widget, a React wrapper, and a backend SDK. Integrators bring an OpenAI-compatible provider. The chatbot owns conversation storage, preferences, and persistent personalization. Text is enabled by default; image attachments, voice input, and voice output are separately opt-in.

## Package boundaries

- `@metanoia/chatbot`: TypeScript Node.js backend, provider client, context management, storage, and a standard Fetch API request handler. Include an Express adapter.
- `@metanoia/widget`: framework-independent browser widget and bundled styles. An imperative `mount` returns update, open, close, and destroy controls. Shadow DOM isolates defaults from host CSS; CSS custom properties and named parts expose styling overrides.
- `@metanoia/react`: React lifecycle wrapper around the widget. React is a peer dependency.
- `examples/express`: runnable integration with configuration via environment variables and a local demonstration identity.

Use a workspace repository and publishable package exports. Importing the backend must not import browser or React dependencies. Importing the widget must not expose provider credentials.

## Integration contract

`createChatbot` accepts provider configuration, storage configuration, branding, capability settings, context limits, and an identity resolver. The server exposes `handle(request)` and `close()`. The host mounts its handler at a chosen path and the widget points to that path. Public widget configuration is served by the backend so capabilities stay consistent.

The resolver receives the host request and returns a trusted user ID plus optional profile. Production integrations use their existing authenticated session; never trust a user ID supplied in request JSON. An explicitly configured anonymous mode creates a server-generated opaque browser session. An Express example uses anonymous mode and documents authenticated integration. The same HTTP API supports web and native clients; a headless JavaScript client accepts injected authentication headers and a streaming-compatible Fetch implementation. Separate instance/database namespaces isolate applications.

Configuration includes assistant name, avatar URL, greeting, suggested prompts, personality instructions, locale, theme, colors, font, placement, dimensions, and launcher presentation. Defaults render an accessible floating chat immediately after mounting. Host-supplied profile fields seed missing preferences; they do not overwrite preferences edited by the user.

## Provider boundary

Use an OpenAI-compatible Chat Completions interface for streaming text, image messages, and function tools. Host applications register server-side tool schemas and executors that receive trusted identity and request context; tool arguments are validated and outputs bounded before returning them to the model. Web search is a host tool backed by an integrator-chosen service, not a bundled provider-specific feature. Configure base URL, secret API key, chat model, request timeout, and optional extra headers on the server. Normalize streaming deltas, tool status, terminal usage, errors, and cancellation behind a small provider interface. No automatic retry after response content begins, to avoid duplicate replies or charges.

Image input requires the integrator to opt in and select a model supporting image messages. Voice input uses an independently configured OpenAI-compatible audio transcription model; voice output uses a speech model and voice name. Audio endpoints can have their own base URL and key, inheriting chat credentials only when explicitly configured. Enabling voice validates required audio configuration. Compatibility with chat alone does not imply audio support.

## Persistence and personalization

SQLite is the automatic single-process default, stored in a configurable local data directory. A PostgreSQL backend implements the same storage interface for deployments sharing state. The package runs versioned schema migrations at initialization. Initialization fails clearly on unwritable storage or invalid database configuration.

Persist users, conversations, messages, structured preferences, user memories, conversation summaries, and usage records. Every query is scoped to the resolved user and instance. Do not persist provider secrets. Include durable timestamps, stable identifiers, pagination, deletion, and clean shutdown.

The widget includes history, a new-conversation action, preference editing, and a memory panel where users can inspect, edit, or remove remembered information. Explicit user preferences are authoritative. Automatic memory extracts small, relevant facts from completed conversations when enabled; model-generated memories are treated as untrusted data, never as system instructions. Avoid extracting credentials or highly sensitive information by default. Set a configurable memory count and size cap. Deleting a conversation also removes memories derived from it; deleting all user data removes history, summaries, preferences, memories, usage, and owned media.

## Request flow and API

1. Resolve identity, validate origin and request size, and load server capabilities.
2. Validate conversation ownership and inputs; persist the accepted user message.
3. Construct bounded context from assistant instructions, preferences, relevant memories, summary, and recent messages.
4. Stream the provider reply through server-sent events with typed `delta`, `usage`, `done`, and `error` events.
5. Persist the assistant reply and its completion status. Client disconnect aborts the upstream request; incomplete replies are marked interrupted and excluded from future context by default.
6. Update summary/memory when thresholds require it, recording their token usage independently.

Endpoints under the host mount path cover public configuration, conversation list/create/read/delete, streaming message submission, preference read/update, memory list/edit/delete, user-data deletion, optional media upload, transcription, and speech. All stateful endpoints resolve the same identity. Reject unknown conversation IDs without revealing whether another user owns them. Serialize message generation per conversation, reject conflicting requests, and provide a client request identifier to prevent duplicate message submission.

## Token efficiency

Configure input budget, output token maximum, recent-history limit, summary threshold, memory limit, and attachment limits. Use a provider-neutral conservative text estimator with a pluggable accurate tokenizer; report estimates separately from provider-reported usage. Allow a configurable image token reserve because image accounting varies by model. Do not claim exact pre-request token enforcement for arbitrary compatible providers.

Select memories using bounded lexical relevance and explicit preference priority; vector infrastructure is not required in the first version. Summarize only when history exceeds its threshold. Bound summary output and include its usage in totals. If summarization fails, retain a bounded recent history and surface the maintenance failure in server events. Preserve the current user message; reject it if it alone exceeds the configured input allowance. Keep original stored history intact when trimming model context.

## Images and voice

Images accept a bounded number of JPEG, PNG, or WebP uploads. Verify file signatures, byte size, and dimensions rather than trusting extensions or declared MIME. Store local assets for SQLite deployments; PostgreSQL deployments configure shared durable media storage or use the included database-backed media adapter. Serve media only through authenticated ownership checks. Never fetch arbitrary user-supplied image URLs on the server. Convert accepted images into the provider's supported multimodal request format.

Voice input records through browser MediaRecorder with microphone permission, duration/size limits, and feature detection. Unsupported browsers show a clear unavailable state. Transcription inserts editable text into the composer; the user sends it explicitly. Voice output generates audio only on user action and supports stop/play. Hide controls when disabled, and independently reject disabled backend endpoints. Retain recordings only for processing by default; delete temporary audio after success or failure.

## Widget behavior and styling

Provide launcher, conversation panel, history drawer, profile/memory settings, message composer, streaming state, attachment previews, and optional microphone/playback controls. Support light, dark, and system themes, keyboard navigation, focus restoration, Escape-to-close, labels, reduced motion, and a polite live region for response status. Avoid announcing every streaming token. Render messages as text by default; any Markdown renderer must sanitize output and reject unsafe link protocols. Host-configured branding cannot inject HTML.

Update styling and branding without losing conversation state. Destroy removes DOM, listeners, active recordings, and requests. Multiple widgets can coexist without shared mutable globals. The React wrapper mounts and destroys correctly under Strict Mode.

## Operational behavior

Keep secrets and detailed provider errors out of browser responses. Provide stable error codes for invalid configuration, authentication, disabled capabilities, ownership, oversized input, conflicts, provider failures, and storage failures. Expose optional server event hooks for diagnostics and usage. Configure allowed origins, request limits, and per-user rate limits. Default same-origin operation; document proxy configuration for cross-origin use. Cookie-backed mutations require origin validation and CSRF protection appropriate to the handler's anonymous/authenticated mode.

## Verification and acceptance

- An Express example launches a usable floating widget using provider environment variables and automatic SQLite initialization.
- Conversations and personalization survive process restart; user A cannot access user B's data or media.
- PostgreSQL passes the same storage behavior suite, including migration and deletion semantics.
- A local fake compatible provider verifies streaming, cancellation, usage, timeout, interrupted replies, and bounded context without paid API calls.
- Disabled image/voice capabilities remove controls and reject requests. Enabled capabilities pass multipart validation and fake-provider audio/image flows.
- Widget browser checks cover sending, history, settings, keyboard interaction, theme updates, unmount cleanup, and React mounting.
- Build and type checks verify package exports and browser/server separation. Documentation includes install, minimal integration, authentication, persistence, customization, provider compatibility, and limitations.

## Delivery sequence

Implement backend/provider and SQLite first, then the text widget and Express example; complete persistent personalization and context budgets; add PostgreSQL, images, and voice; finish React and headless client integration, browser/mobile verification, and package documentation. All parts above remain required for the approved first version. No channels such as WhatsApp or Slack, hosted billing service, vector database, bundled web-search provider, or prebuilt business actions are included.
