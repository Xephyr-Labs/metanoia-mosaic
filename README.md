<div align="center">

# Metanoia Mosaic

### A customizable, self-hosted assistant for every application.

Bring your own OpenAI-compatible provider. Keep identity, memory, tools, and data in your stack.

[Capabilities](#capabilities) · [Packages](#packages) · [Setup](docs/setup.md) · [Documentation](#documentation)

</div>

```sh
npm create metanoia-mosaic
```

Public packages are awaiting their first release. Until then, use the [workspace setup](docs/setup.md#get-the-workspace) and local starter generator.

## Capabilities

- **Provider choice:** connect OpenAI-compatible chat APIs, including OpenRouter and DeepInfra. Provider credentials stay on your server.
- **Personalized context:** inject trusted host profile data, user preferences, relevant memories, and compact conversation summaries within a token budget.
- **Tools and search:** connect server-side application functions; optionally use OpenRouter web search with citations.
- **Multimodal by choice:** independently enable image input, voice transcription, and spoken replies.
- **A configurable assistant UI:** set its name, avatar, greeting, theme, colors, placement, and dimensions. Optional suggestion pills, custom labels, locale, and RTL direction adapt it to your product.
- **App-owned identity and storage:** resolve users through your application; persist conversations in SQLite or PostgreSQL.
- **Flexible integration:** use the floating web widget, optional React wrapper, typed headless client, or transport-neutral HTTP handler.

## Packages

| Package | Purpose |
| --- | --- |
| `@metanoia/chatbot` | Node.js backend, OpenAI-compatible streaming, tools, persistence, and Express adapter |
| `@metanoia/widget` | Framework-independent Shadow DOM chat widget |
| `@metanoia/react` | Optional React component |
| `@metanoia/client` | Typed client for custom web and mobile interfaces |
| `create-metanoia-mosaic` | Express starter generator |

## Documentation

- [Detailed setup and integration](docs/setup.md)
- [Next.js, Hono, and Fastify recipes](docs/frameworks/)
- [React Native / Expo starter](examples/react-native/README.md)
- [Provider, image, and voice configuration](docs/providers-and-media.md)
- [Personalization and privacy](docs/personalization-and-privacy.md)
- [Widget customization](docs/customization.md)
- [API and host integration](docs/integration.md)
- [Runnable Express example](examples/express/README.md)

## License

[MIT](LICENSE) · © 2026 Xephyr Labs
