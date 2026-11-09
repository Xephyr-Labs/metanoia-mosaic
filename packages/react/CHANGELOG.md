# @metanoia/react

## 0.7.0

### Minor Changes

- 6867264: `inline: true` renders the chat inside the host element, always open: no launcher, no close button, no floating panel, and the host sets the size. For a page that is itself the chat, such as an inbox's assistant conversation.

### Patch Changes

- Updated dependencies [c7b0c5e]
- Updated dependencies [6867264]
  - @metanoialabs/widget@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [eecc1bb]
  - @metanoialabs/widget@0.6.1

## 0.6.0

### Minor Changes

- feb27a7: Add `cards` and `actions` rich blocks. A button either sends its label as the user message with an opaque `tap` value in the request body (tools read it from `ctx.request`), or hands an action to the host page through the new `onAction` option. The widget instance gains `send(text)`; the React component exposes `send`, `open` and `close` through a `ref`. Any button can be marked `primary` for the one main action. The rich response guide describes both blocks.

### Patch Changes

- Updated dependencies [feb27a7]
  - @metanoialabs/widget@0.6.0

## 0.5.0

### Patch Changes

- @metanoialabs/widget@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [ffa5713]
  - @metanoialabs/widget@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [ca446a8]
  - @metanoialabs/widget@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [12d90e6]
  - @metanoialabs/widget@0.3.0

## 0.2.1

### Patch Changes

- 466d156: Add a README to each package.
- Updated dependencies [466d156]
  - @metanoialabs/widget@0.2.1

## 0.2.0

### Minor Changes

- 69c44a4: Prepare the integration packages and starter CLI for their first public npm release.

### Patch Changes

- Updated dependencies [69c44a4]
- Updated dependencies [98f51d4]
- Updated dependencies [b976140]
- Updated dependencies [eef08c4]
  - @metanoia/widget@0.2.0
