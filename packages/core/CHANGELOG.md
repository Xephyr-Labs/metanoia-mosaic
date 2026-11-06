# @metanoia/chatbot

## 0.6.0

### Minor Changes

- feb27a7: Add `cards` and `actions` rich blocks. A button either sends its label as the user message with an opaque `tap` value in the request body (tools read it from `ctx.request`), or hands an action to the host page through the new `onAction` option. The widget instance gains `send(text)`; the React component exposes `send`, `open` and `close` through a `ref`. Any button can be marked `primary` for the one main action. The rich response guide describes both blocks.

## 0.5.0

### Minor Changes

- c67f624: The input guard now receives the images attached to a message (`images`: each one's `mime` and `bytes`, with `typed`), so a host can screen text or instructions inside a picture before the model reads it. A message refused under parallel guard timing now loses its images as well as its text, so a refused image never reaches a later turn, and earlier images stay out of the model's context while image input is off.

## 0.4.0

### Minor Changes

- ffa5713: File attachments: with `capabilities.documents`, people can attach PDF, Word, and text files. The host's `extract` turns each upload into text, which travels inside the message so the model keeps it on later turns; the widget shows it as a file chip, and picked files appear as removable chips before sending. Chats are named after their first message and can be renamed from History (`PATCH /conversations/:id`). A new Shared view lists the links, images, and files from every chat (`GET /shared`), each leading back to its chat; `linkGroups` gives host-recognized links their own tab. Image ids can no longer carry a file's text, and SQLite/PostgreSQL storage gains a media `name` column (schema 8). Sent images now show as thumbnails in the user's message (live and when a chat is reopened), file chips carry a type badge, History shows each chat's last activity and has a Cancel button for renaming, and the History, Shared, and Settings screens have headings.

## 0.3.1

No changes in this release.

## 0.3.0

### Minor Changes

- 2580369: Add `inputGuard`: screen every chat message, user-written memory and preference update before the model or storage sees it. A refused message is answered with the guard's reply (no model call, the text is not kept in history); a refused memory or preference update returns 422 `input_rejected`; a guard that throws fails closed with 503 `guard_unavailable`.
  
  Add `chatbot.deleteUserData(userId)` so a host can erase a user's conversations, memories, preferences and profile when it deletes the account.
  
  The profile from your `identity` resolver now takes precedence over a user preference with the same key (previously a user could override verified profile fields through `PUT /preferences`).
  
  `inputGuardTiming: "parallel"` runs the guard alongside the model request and releases nothing (no text, no tool calls) until it allows, hiding the guard's latency.
  
  `capabilities.suggestions.inline` has the model append follow-up suggestions to its answer, removing the separate suggestions request.

## 0.2.1

### Patch Changes

- 466d156: Add a README to each package.

## 0.2.0

### Minor Changes

- 69c44a4: Prepare the integration packages and starter CLI for their first public npm release.
- b976140: Rich replies: the widget renders GitHub tables, task lists, quotes, images, copyable code blocks, SVG charts, clickable choice buttons, Mermaid diagrams, model-written SVG, and KaTeX math. Mermaid and KaTeX load only when a reply needs them (`rich.mermaidUrl` / `rich.katexUrl` to self-host); model SVG and diagrams are displayed as images so they cannot run scripts. The server adds a short format guide to the system prompt, controlled by `capabilities.richResponses`.

### Patch Changes

- 98f51d4: Return 400 instead of 500 for malformed JSON or multipart bodies, always end the reply stream when user-data deletion or shutdown interrupts suggestion generation, keep the turn timeout from cancelling suggestions after a completed answer, accept lossy WebP uploads, apply the same limits to memory edits as to new memories, and send `max_completion_tokens` without `temperature` for `compatibility: "openai"` so OpenAI reasoning models (gpt-5, o-series) accept chat and maintenance requests. The widget now reports streams that end without a result, keeps the close control in History and Settings, resets the attachment count after sending, sends on Enter, fixes the voice recording filename and mic state, fixes Listen/Stop toggling, shows an error when chat is unavailable, replaces glyph icons with SVG, and renders assistant Markdown (lists, headings, bold, italic, code, links) as safe DOM nodes instead of raw asterisks. Send turns into Stop while a reply streams, failed sends restore the draft and offer Retry, Settings errors appear inline, focus moves into and back out of History and Settings and stays inside the phone-size sheet, default muted text, focus rings, and input borders meet WCAG AA, and with `theme: "system"` host colors no longer force a light panel in dark mode.
- eef08c4: Fix starter argument parsing and release dependency versions, custom-element upgrades and endpoint changes, conversation persistence, localized controls and statuses, widget placement, and shutdown with active SSE connections.
