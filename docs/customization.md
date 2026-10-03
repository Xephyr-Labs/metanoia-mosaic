# Widget customization

`mount(element, options)` creates an independent widget in the target element's Shadow DOM and returns `ready`, `update`, `open`, `close`, and `destroy` controls.

Server branding controls assistant name, avatar URL, greeting, personality, locale, suggested prompts, theme, color map, font, placement, dimensions, and launcher presentation. Per-widget options can override the name, avatar, greeting, suggested prompts, theme, placement, dimensions, launcher style, font, and color palette. This lets one app mount differently branded assistants against separate endpoints or instances.

```ts
mount(document.querySelector("#assistant")!, {
  endpoint: "/assistant",
  name: "Mira",
  avatarUrl: "/assets/mira.png",
  launcher: "button",
  greeting: "Welcome back. What are you working on?",
  suggestedPrompts: ["Review my latest order", "Explain a feature"],
  colors: {
    accent: "#5b4bdb",
    panel: "#ffffff",
    text: "#20202a",
    muted: "#777786",
    userMessage: "#5b4bdb",
    assistantMessage: "#f3f2fa",
    border: "#e8e6f0",
  },
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
  width: 400,
  height: 680,
});
```

The launcher supports `bubble` and `button`. Colors accept CSS color values; unsupported values fall back to the theme defaults. The widget caps requested dimensions to keep it usable on small screens.

## Conversation-aware suggestion pills

`branding.suggestedPrompts` provides static prompts on the welcome screen. To show contextual follow-up pills after assistant replies, enable suggestions in the server configuration:

```ts
capabilities: {
  suggestions: { enabled: true, count: 3 },
}
```

This makes one additional short, non-streaming provider request after each completed answer. It is disabled by default to avoid extra token usage and latency. The widget renders suggestions as aligned pills; selecting one places it in the composer for the user to review and send. Custom clients receive them as `suggestions` SSE events. Suggestions are also saved on the assistant message as `suggestions: string[]` and restored when history is opened. Branding updates preserve drafts and active reply elements.

The widget uses text nodes for branding and messages. It exposes `part="launcher"` and `part="panel"` for targeted CSS and the `--omni-accent`, `--omni-width`, and `--omni-height` CSS properties. Each mount has its own requests and state. Call `destroy()` when removing it from the page.

The current widget supports history, new conversations, preference JSON editing, manually saved memories, image attachment when enabled, microphone transcription when enabled, and on-demand speech playback when enabled. Image previews and guided preference fields are not included yet.

## Localization and conversation persistence

Use `locale` to set the widget language metadata and automatic text direction, or set `dir` to `ltr` or `rtl`. Pass `labels` to translate visible controls, statuses, and accessibility names. App-provided `greeting` and suggested prompts remain independent.

`conversationStore` lets the host save and restore the active conversation ID across page loads. Scope its key to the authenticated user. On account changes, clear the old store and destroy/remount the widget (or remove/recreate the custom element) to discard in-memory drafts and messages. For refreshed bearer tokens, `headers` can be an async callback; `credentials` controls Fetch cookie behavior. The no-build `<metanoia-chat>` loader accepts `headers`, `conversationStore`, and `labels` as JavaScript properties, including values assigned before its deferred script loads; use the `credentials` attribute for cookie behavior. Changing its `endpoint` remounts the widget and reloads branding. For the direct `mount()` API, destroy and remount to change the endpoint.
