# @metanoialabs/react

A React component for the [Metanoia Mosaic](https://github.com/Xephyr-Labs/metanoia-mosaic) chat widget. It's a thin wrapper around [`@metanoialabs/widget`](https://www.npmjs.com/package/@metanoialabs/widget) and connects to a [`@metanoialabs/chatbot`](https://www.npmjs.com/package/@metanoialabs/chatbot) backend on your server.

```sh
npm install @metanoialabs/react
```

Requires React 18 or newer.

## Usage

```jsx
import { OmniChatbot } from "@metanoialabs/react";

export function Assistant() {
  return (
    <OmniChatbot
      endpoint="/assistant"
      name="Mira"
      theme="system"
      colors={{ accent: "#2f5d62" }}
    />
  );
}
```

`OmniChatbot` takes every [widget option](https://www.npmjs.com/package/@metanoialabs/widget#options) as a prop, plus `className` and `style` for the host element.

Changing props updates the widget in place. Changing `endpoint` remounts it. Pass stable references (for example with `useMemo` or `useCallback`) for object and function props such as `colors`, `labels`, and `headers`, so the widget doesn't update on every render.

### Authenticated requests

```jsx
const headers = useCallback(async () => ({ authorization: `Bearer ${await getAccessToken()}` }), []);

<OmniChatbot endpoint="https://api.example.com/assistant" headers={headers} />
```

### Next.js

The widget needs the browser, so render it from a client component (`"use client"`). For the backend route, see the [Next.js recipe](https://github.com/Xephyr-Labs/metanoia-mosaic/blob/main/docs/frameworks/nextjs.md).

## License

MIT
