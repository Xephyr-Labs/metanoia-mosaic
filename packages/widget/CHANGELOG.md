# @metanoia/widget

## 0.2.0

### Minor Changes

- 69c44a4: Prepare the integration packages and starter CLI for their first public npm release.

### Patch Changes

- 98f51d4: Return 400 instead of 500 for malformed JSON or multipart bodies, always end the reply stream when user-data deletion or shutdown interrupts suggestion generation, keep the turn timeout from cancelling suggestions after a completed answer, accept lossy WebP uploads, apply the same limits to memory edits as to new memories, and send `max_completion_tokens` without `temperature` for `compatibility: "openai"` so OpenAI reasoning models (gpt-5, o-series) accept chat and maintenance requests. The widget now reports streams that end without a result, keeps the close control in History and Settings, resets the attachment count after sending, sends on Enter, fixes the voice recording filename and mic state, fixes Listen/Stop toggling, shows an error when chat is unavailable, replaces glyph icons with SVG, and renders assistant Markdown (lists, headings, bold, italic, code, links) as safe DOM nodes instead of raw asterisks.
- eef08c4: Fix starter argument parsing and release dependency versions, custom-element upgrades and endpoint changes, conversation persistence, localized controls and statuses, widget placement, and shutdown with active SSE connections.
