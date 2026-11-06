---
"@metanoialabs/widget": minor
"@metanoialabs/react": minor
"@metanoialabs/chatbot": minor
---

Add `cards` and `actions` rich blocks. A button either sends its label as the user message with an opaque `tap` value in the request body (tools read it from `ctx.request`), or hands an action to the host page through the new `onAction` option. The widget instance gains `send(text)`; the React component exposes `send`, `open` and `close` through a `ref`. The rich response guide describes both blocks.
