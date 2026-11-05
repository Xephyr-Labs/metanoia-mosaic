---
"@metanoialabs/chatbot": minor
"@metanoialabs/client": minor
"@metanoialabs/widget": minor
---

File attachments: with `capabilities.documents`, people can attach PDF, Word, and text files. The host's `extract` turns each upload into text, which travels inside the message so the model keeps it on later turns; the widget shows it as a file chip, and picked files appear as removable chips before sending. Chats are named after their first message and can be renamed from History (`PATCH /conversations/:id`). A new Shared view lists the links, images, and files from every chat (`GET /shared`), each leading back to its chat; `linkGroups` gives host-recognized links their own tab. Image ids can no longer carry a file's text, and SQLite/PostgreSQL storage gains a media `name` column (schema 8).
