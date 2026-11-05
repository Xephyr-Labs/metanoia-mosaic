---
"@metanoialabs/chatbot": minor
---

The input guard now receives the images attached to a message (`images`: each one's `mime` and `bytes`, with `typed`), so a host can screen text or instructions inside a picture before the model reads it. A message refused under parallel guard timing now loses its images as well as its text, so a refused image never reaches a later turn, and earlier images stay out of the model's context while image input is off.
