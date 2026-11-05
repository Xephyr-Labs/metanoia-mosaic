---
"@metanoialabs/chatbot": minor
---

The input guard now receives the images attached to a message (`images`: each one's `mime` and `bytes`, with `typed`), so a host can screen text or instructions inside a picture before the model reads it.
