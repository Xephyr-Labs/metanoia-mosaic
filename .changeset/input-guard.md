---
"@metanoialabs/chatbot": minor
---

Add `inputGuard`: screen every chat message and user-written memory before the model or storage sees it. A refused message is answered with the guard's reply (no model call, the text is not kept in history); a refused memory returns 422 `input_rejected`; a guard that throws fails closed with 503 `guard_unavailable`.
