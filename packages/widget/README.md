# @metanoialabs/widget

A drop-in chat widget for [Metanoia Mosaic](https://github.com/Xephyr-Labs/metanoia-mosaic). It needs no framework, renders inside Shadow DOM so your page styles don't leak in, and talks to a [`@metanoialabs/chatbot`](https://www.npmjs.com/package/@metanoialabs/chatbot) backend on your server.

Streaming Markdown replies, suggested follow-ups, history, image and voice input, light/dark themes, translatable labels, right-to-left layouts, and keyboard and screen-reader support.

## Plain HTML

```html
<script src="https://cdn.jsdelivr.net/npm/@metanoialabs/widget@0/dist/loader.js" defer></script>
<metanoia-chat endpoint="/assistant" name="Mira" theme="system"></metanoia-chat>
```

Attributes: `endpoint`, `name`, `avatar-url`, `greeting`, `theme`, `placement`, `accent`, `width`, `height`, `launcher`, `locale`, `dir`, `credentials`.

Set JavaScript properties (`headers`, `conversationStore`, `labels`, `rich`) before adding the element to the page:

```js
const assistant = document.createElement("metanoia-chat");
assistant.setAttribute("endpoint", "/assistant");
assistant.headers = async () => ({ authorization: `Bearer ${await getAccessToken()}` });
document.body.append(assistant);
```

## With a bundler

```sh
npm install @metanoialabs/widget
```

```js
import { mount } from "@metanoialabs/widget";

const assistant = mount(document.querySelector("#assistant"), {
  endpoint: "/assistant",
  name: "Mira",
  theme: "system",
  colors: { accent: "#2f5d62" },
});

await assistant.ready;
assistant.open();
```

`mount` returns `{ ready, open, close, update(options), destroy }`.

## Options

| Option | Purpose |
| --- | --- |
| `endpoint` | URL where the backend is mounted (required) |
| `headers`, `credentials`, `fetch` | Authentication and transport |
| `name`, `avatarUrl`, `greeting`, `suggestedPrompts` | Branding. Overrides the server's `branding` |
| `theme` | `"light"`, `"dark"`, or `"system"` |
| `colors`, `accent`, `font` | Palette: `accent`, `panel`, `text`, `muted`, `userMessage`, `assistantMessage`, `border` |
| `placement`, `width`, `height`, `launcher` | `"bottom-right"` / `"bottom-left"`, size, `"bubble"` / `"button"` |
| `labels`, `locale`, `dir` | Translate every label. `dir: "auto"` detects right-to-left locales |
| `conversationStore` | `{ load, save, clear }` to resume the last conversation after a reload |
| `rich` | Toggle rich replies: `tables`, `charts`, `choices`, `diagrams`, `math`, `svg`, `images` |

Keep a stored conversation ID scoped to the signed-in user, and clear it on sign-out.

See [widget customization](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/customization.md) for the full guide.

## Related

- [`@metanoialabs/react`](https://www.npmjs.com/package/@metanoialabs/react): this widget as a React component
- [`@metanoialabs/client`](https://www.npmjs.com/package/@metanoialabs/client): build your own UI instead

## License

MIT
