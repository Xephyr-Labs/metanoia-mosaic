---
"@metanoialabs/widget": patch
---

While a reply streams in, the chat follows it only if the reader is already at (or within 40px of) the bottom. Scrolling up to reread an earlier message now stays put instead of being pulled back down on every chunk. Sending a message still jumps to the bottom.
