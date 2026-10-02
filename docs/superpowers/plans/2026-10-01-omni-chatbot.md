# Omni Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted, customizable chatbot for Node.js applications with persistent user personalization, token-aware context, and independently optional image and voice features.

**Architecture:** A TypeScript npm workspace separates a server-only backend, a dependency-free browser widget, a React adapter, and an Express example. The backend owns identity resolution, provider calls, SQLite/PostgreSQL persistence, media, context assembly, and Fetch-compatible routes; browser configuration never contains provider secrets.

**Tech Stack:** Node.js 20+, TypeScript, npm workspaces, Fetch API, Express adapter, SQLite, PostgreSQL, Web Components/Shadow DOM, React peer dependency.

---

## File map

- `package.json`, `tsconfig.json`, `.gitignore`: workspace scripts, build settings, generated output exclusions.
- `packages/core`: public types, configuration validation, identity and origin guards, context budgeting, OpenAI-compatible chat/audio provider, Fetch router, SSE protocol, migrations, SQLite and PostgreSQL storage, media, personalization.
- `packages/widget`: imperative browser entry point, Shadow DOM UI, styles, network client, optional image and audio controls, accessible interaction and cleanup.
- `packages/react`: peer-dependent component mounting the widget with lifecycle cleanup.
- `examples/express`: executable example, environment configuration, static assets, and integration instructions.
- `docs`: installation, configuration, security, persistence, provider compatibility, customization, media, and limitations.

## Execution notes

- Preserve the package boundaries and security rules in `docs/superpowers/specs/2026-10-01-omni-chatbot-design.md`.
- Do not place provider credentials in browser bundles or responses. Every state lookup uses instance and resolved-user scope.
- Treat each delivery stage as usable before moving on: backend text, widget/example, personalization/budgets, PostgreSQL/media, then React/docs.
- The `.git` directory is read-only in this workspace, so commits and worktrees cannot be created here.

### Task 1: Establish the workspace and public package skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/widget/package.json`
- Create: `packages/react/package.json`
- Create: `examples/express/package.json`

- [ ] Define npm workspace packages and scripts for build, typecheck, example startup, and clean.
- [ ] Define package exports so importing core does not load browser or React modules.
- [ ] Set TypeScript targets for Node 20 and modern browsers, with declarations and strict checks.
- [ ] Declare only necessary runtime dependencies and React as a peer dependency.
- [ ] Run `npm install` and `npm run typecheck`; confirm the empty public entry points compile.

### Task 2: Define and validate backend configuration

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/errors.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Implement typed provider, storage, capability, branding, context-limit, and identity-resolver options matching the spec.
- [ ] Validate required chat credentials, URL shape, timeout and size limits, voice model configuration, and opt-in dependencies at initialization.
- [ ] Create stable public error codes and ensure serialization omits secrets and provider internals.
- [ ] Export `createChatbot` types without importing storage drivers until configured.
- [ ] Run `npm run typecheck` and `npm run build`.

### Task 3: Implement storage contracts and SQLite persistence

**Files:**
- Create: `packages/core/src/storage/types.ts`
- Create: `packages/core/src/storage/sqlite.ts`
- Create: `packages/core/src/storage/migrations.ts`
- Create: `packages/core/src/storage/ids.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Define async storage operations for users, conversations, messages, preferences, memories, summaries, usage, and media.
- [ ] Add versioned SQLite migrations, foreign keys, indexes, timestamps, and instance/user scoped queries.
- [ ] Initialize SQLite in a configurable local directory; fail startup with actionable errors on invalid or unwritable storage.
- [ ] Implement pagination, conversation deletion with derived-memory cleanup, full user-data deletion, and graceful close.
- [ ] Run `npm run typecheck` and `npm run build`; start and stop the example database initializer to confirm migrations can run.

### Task 4: Add identity, origin, request validation, and handler lifecycle

**Files:**
- Create: `packages/core/src/identity.ts`
- Create: `packages/core/src/http/router.ts`
- Create: `packages/core/src/http/validation.ts`
- Create: `packages/core/src/http/express.ts`
- Create: `packages/core/src/index.ts`

- [ ] Implement `createChatbot({ ... })`, `handle(request)`, and idempotent `close()` around configured storage and provider.
- [ ] Resolve every request through the configured trusted identity resolver; support server-issued opaque anonymous sessions only when explicitly enabled.
- [ ] Enforce allowed origins, body limits, CSRF/origin protections for cookie-backed mutations, and stable error responses.
- [ ] Add configurable per-user rate limits for stateful and generation routes, keyed only by resolved identity and instance.
- [ ] Implement public widget configuration and conversation list/create/read/delete, preference, memory, and user-data deletion routes.
- [ ] Return indistinguishable not-found responses for nonexistent and other-user conversation IDs.
- [ ] Add an Express adapter that forwards requests to the standard Fetch handler.
- [ ] Run `npm run typecheck` and `npm run build`.

### Task 5: Implement OpenAI-compatible text streaming and context budgets

**Files:**
- Create: `packages/core/src/provider/types.ts`
- Create: `packages/core/src/provider/openai-compatible.ts`
- Create: `packages/core/src/context/budget.ts`
- Create: `packages/core/src/context/build.ts`
- Create: `packages/core/src/http/sse.ts`
- Modify: `packages/core/src/http/router.ts`

- [ ] Implement a configurable Chat Completions-compatible streaming client using server-only credentials, abort signals, timeout, extra headers, and normalized provider errors.
- [ ] Parse stream deltas, terminal usage, finish reasons, and malformed/error responses; do not retry after content begins.
- [ ] Assemble system instructions, explicit preferences, relevant bounded memories, summary, recent completed turns, and current message under configured budgets.
- [ ] Estimate text tokens conservatively, reserve configurable image tokens, preserve the current message, and reject it when it alone exceeds the allowance.
- [ ] Serialize generation per conversation and enforce client request-id idempotency.
- [ ] Persist accepted user input and completed/interrupted assistant output; disconnect aborts upstream work and interrupted text is excluded from later context.
- [ ] Emit typed `delta`, `usage`, `done`, and `error` SSE events while keeping detailed provider errors server-side.
- [ ] Expose optional server event hooks for request diagnostics, provider usage, storage failures, and context-maintenance outcomes; isolate hook failures from chat requests.
- [ ] Run `npm run typecheck` and `npm run build`; launch the example against a local fake OpenAI-compatible stream and inspect the emitted event sequence.

### Task 6: Add persistent preferences, memory, summaries, and usage accounting

**Files:**
- Create: `packages/core/src/personalization/preferences.ts`
- Create: `packages/core/src/personalization/memory.ts`
- Create: `packages/core/src/context/summarize.ts`
- Create: `packages/core/src/usage/record.ts`
- Modify: `packages/core/src/http/router.ts`

- [ ] Seed missing user preferences from host profile fields without overwriting user edits.
- [ ] Add user-scoped preference and memory read/update/delete operations with explicit preferences taking precedence.
- [ ] Extract bounded candidate memories only from completed turns when enabled; reject likely credentials and sensitive facts, cap count/size, and mark provenance.
- [ ] Summarize only after configured thresholds; bound summary output and record summary usage separately.
- [ ] On summary failure, retain bounded recent history and emit a maintenance event without failing the user response.
- [ ] Track estimated and provider-reported usage separately with per-conversation and per-user totals.
- [ ] Invoke the optional diagnostic and usage hooks with redacted, stable event payloads at request, provider, persistence, and maintenance boundaries.
- [ ] Run `npm run typecheck` and `npm run build`.

### Task 7: Build the default browser widget for text conversations

**Files:**
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/src/index.ts`
- Create: `packages/widget/src/client.ts`
- Create: `packages/widget/src/elements.ts`
- Create: `packages/widget/src/styles.ts`
- Modify: `packages/widget/package.json`

- [ ] Implement `mount(element, options)` returning `update`, `open`, `close`, and `destroy` controls.
- [ ] Render the default launcher and chat panel in a Shadow DOM with configurable name, avatar, greeting, prompts, locale, theme, colors, font, placement, dimensions, and launcher style.
- [ ] Implement message sending and SSE rendering, conversation history, new conversation, preferences, memory inspection/edit/delete, and loading/error states.
- [ ] Support CSS custom properties and named parts while treating all branding and message content as text.
- [ ] Implement keyboard navigation, focus restoration, Escape-to-close, screen-reader status announcements, reduced motion, and no shared globals across mounts.
- [ ] Ensure updates retain state and destruction removes DOM, listeners, recordings, and active requests.
- [ ] Run `npm run typecheck` and `npm run build`; load a minimal host page and exercise the text conversation against the local example provider.

### Task 8: Deliver the runnable Express integration example

**Files:**
- Create: `examples/express/src/server.ts`
- Create: `examples/express/public/index.html`
- Create: `examples/express/public/app.ts`
- Create: `examples/express/.env.example`
- Create: `examples/express/README.md`
- Modify: root `package.json`

- [ ] Configure the example using provider URL/key/model environment variables, SQLite default storage, and explicitly enabled anonymous demo identity.
- [ ] Serve the widget bundle and mount the Express adapter at a documented route.
- [ ] Show authenticated identity resolver integration alongside the local anonymous demo setup.
- [ ] Document install, configure, run, and the expected result in the browser.
- [ ] Run the documented startup command and verify the page loads and sends a text prompt to a local compatible provider.

### Task 9: Add PostgreSQL storage

**Files:**
- Create: `packages/core/src/storage/postgres.ts`
- Create: `packages/core/src/storage/postgres-migrations.ts`
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/package.json`

- [ ] Implement PostgreSQL migrations and the same storage contract, including ownership scoping, pagination, and deletion semantics.
- [ ] Use transactions for message acceptance/completion and user-data deletion.
- [ ] Support configured connection pooling and clean shutdown without importing PostgreSQL when SQLite is selected.
- [ ] Document shared deployment and migration configuration.
- [ ] Run `npm run typecheck` and `npm run build`; start against a local PostgreSQL service when available and exercise initialization and shutdown.

### Task 10: Add optional image attachments and protected media

**Files:**
- Create: `packages/core/src/media/validate.ts`
- Create: `packages/core/src/media/store.ts`
- Create: `packages/core/src/http/media.ts`
- Modify: `packages/core/src/http/router.ts`
- Modify: `packages/core/src/context/build.ts`
- Modify: `packages/widget/src/elements.ts`
- Modify: `packages/widget/src/client.ts`

- [ ] Add image upload route only when image capability is configured; verify JPEG, PNG, and WebP signatures, count, decoded dimensions, and byte size.
- [ ] Store SQLite assets locally and allow a configured durable store or the PostgreSQL database media adapter.
- [ ] Serve media through authenticated user/instance ownership checks; do not fetch arbitrary URLs.
- [ ] Build provider-compatible image messages and reserve configured image token budget.
- [ ] Add optional widget attachment selection, preview, removal, and upload progress; hide controls and reject endpoints when disabled.
- [ ] Remove owned media during conversation/user deletion and temporary upload failures.
- [ ] Run `npm run typecheck` and `npm run build`; verify disabled capability behavior and an enabled image exchange with a local compatible provider.

### Task 11: Add optional voice input and output

**Files:**
- Create: `packages/core/src/provider/audio.ts`
- Create: `packages/core/src/http/audio.ts`
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/http/router.ts`
- Modify: `packages/widget/src/client.ts`
- Modify: `packages/widget/src/elements.ts`

- [ ] Add independently configured transcription and speech endpoints/models, with explicit credential inheritance rules.
- [ ] Add duration, MIME, and byte limits and delete temporary audio after success or failure.
- [ ] Implement transcription that returns editable composer text; do not auto-submit it.
- [ ] Implement speech generation on explicit play action with stop control.
- [ ] Gate input and output independently in public configuration, browser controls, and backend routes.
- [ ] Detect MediaRecorder/audio playback support and show a clear unavailable state when missing.
- [ ] Run `npm run typecheck` and `npm run build`; verify disabled endpoints reject calls and enabled voice routes against a local compatible audio provider.

### Task 12: Add React wrapper and publishable package metadata

**Files:**
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/src/index.ts`
- Create: `packages/react/src/OmniChatbot.tsx`
- Modify: `packages/react/package.json`
- Modify: `packages/widget/package.json`
- Modify: root `package.json`

- [ ] Implement a React component that mounts the imperative widget and updates options without losing state.
- [ ] Ensure effect cleanup destroys the widget and behaves correctly under React Strict Mode.
- [ ] Keep React as a peer dependency and avoid importing React from core or widget entry points.
- [ ] Define package exports, types, side-effect declarations, and publish files for all packages.
- [ ] Run `npm run typecheck` and `npm run build`; inspect package output to verify browser/server/React boundaries.

### Task 13: Complete integration and operations documentation

**Files:**
- Create: `README.md`
- Create: `docs/integration.md`
- Create: `docs/customization.md`
- Create: `docs/personalization-and-privacy.md`
- Create: `docs/providers-and-media.md`
- Modify: `examples/express/README.md`

- [ ] Document the minimal Node integration, Fetch and Express mounting, trusted identity resolver, and anonymous demo limitations.
- [ ] Document all branding/style/widget controls, capability flags, OpenAI-compatible chat/audio setup, and compatibility limits.
- [ ] Document SQLite and PostgreSQL persistence, data deletion, summaries/memories, context-budget estimates, request limits, origins, and CSRF responsibilities.
- [ ] Document stable API errors, SSE events, shutdown, proxy use, and troubleshooting.
- [ ] Run the complete workspace build/typecheck and the documented example startup; inspect generated package exports and confirm no secret is exposed in browser configuration.

### Task 14: Verify end-to-end acceptance behavior

**Files:**
- Modify as needed: `examples/express/README.md`
- Modify as needed: `docs/integration.md`

- [ ] Restart the Express example and confirm conversations, preferences, memories, and usage remain available from SQLite.
- [ ] Use two distinct resolved user identities and confirm conversation, memory, and media reads/deletes cannot cross user boundaries.
- [ ] Point the example at a local fake OpenAI-compatible server and confirm stream deltas, usage, timeout, cancellation on disconnect, and interrupted replies excluded from later context.
- [ ] Confirm request-id resubmission does not create duplicate messages and concurrent generation for one conversation returns a conflict.
- [ ] Exercise widget sending, conversation history, preference and memory editing, keyboard navigation, theme updates, and destroy/remount behavior in a browser.
- [ ] Mount the React wrapper in a small React Strict Mode page and confirm mount, option updates, and cleanup.
- [ ] When PostgreSQL and audio/image-compatible test endpoints are available, repeat storage lifecycle checks and confirm independently disabled capabilities hide controls and reject backend requests.
