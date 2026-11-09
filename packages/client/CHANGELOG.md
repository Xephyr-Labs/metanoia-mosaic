# @metanoia/client

## 0.7.0

No changes in this release.

## 0.6.1

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.0

### Minor Changes

- ffa5713: File attachments: with `capabilities.documents`, people can attach PDF, Word, and text files. The host's `extract` turns each upload into text, which travels inside the message so the model keeps it on later turns; the widget shows it as a file chip, and picked files appear as removable chips before sending. Chats are named after their first message and can be renamed from History (`PATCH /conversations/:id`). A new Shared view lists the links, images, and files from every chat (`GET /shared`), each leading back to its chat; `linkGroups` gives host-recognized links their own tab. Image ids can no longer carry a file's text, and SQLite/PostgreSQL storage gains a media `name` column (schema 8). Sent images now show as thumbnails in the user's message (live and when a chat is reopened), file chips carry a type badge, History shows each chat's last activity and has a Cancel button for renaming, and the History, Shared, and Settings screens have headings.

## 0.3.1

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.1

### Patch Changes

- 466d156: Add a README to each package.

## 0.2.0

### Minor Changes

- 69c44a4: Prepare the integration packages and starter CLI for their first public npm release.

### Patch Changes

- eef08c4: Fix starter argument parsing and release dependency versions, custom-element upgrades and endpoint changes, conversation persistence, localized controls and statuses, widget placement, and shutdown with active SSE connections.
