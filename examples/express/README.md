# Northstar support demo

This small help-center app demonstrates the floating widget, assistant name/avatar and theme configuration, conversation-aware suggestion pills, the Express adapter, and persisted conversation history. Run the integration smoke check from the workspace root; it uses a mocked OpenAI-compatible stream and needs no API key or listening port:

```sh
npm run smoke --workspace @metanoia/example-express
```

To preview the site locally without provider credentials, start its mock-provider mode:

```sh
CHATBOT_DEMO_MODE=true CHATBOT_HOST=0.0.0.0 npm run start --workspace @metanoia/example-express
```

The mock returns clearly labeled synthetic replies while still exercising the widget, HTTP API, streaming path, and storage. By default, the server allows loopback plus the machine's detected IPv4 interface origins. Set `CHATBOT_ALLOWED_ORIGINS` to a comma-separated allowlist for a custom hostname. This demo uses anonymous sessions and is intended for a trusted local network only; do not expose it to the public internet.

To run it in a browser against a real OpenAI-compatible provider, copy `.env.example` to `.env`, set the provider URL, API key, and model, then start the example:

```sh
npm run build
npm run dev --workspace @metanoia/example-express
```

Open `http://localhost:3000`. Set `OPENAI_COMPATIBILITY` to `openai`, `deepinfra`, or `openrouter` when you want provider-specific request handling. SQLite is used by default; optionally set `CHATBOT_DATABASE_URL` to use PostgreSQL.

The example explicitly enables an anonymous browser session for local demonstration. For a real application, remove `anonymous: true` and provide `identity(request)` that reads the application's authenticated server session and returns its trusted user ID. Never accept a user ID from browser request JSON.

The `expressHandler` is mounted at `/api/chat`; it forwards the handler's standard Fetch API routes under that mount path. Do not expose this demo anonymously on a public network.
