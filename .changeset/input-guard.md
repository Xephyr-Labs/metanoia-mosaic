---
"@metanoialabs/chatbot": minor
---

Add `inputGuard`: screen every chat message, user-written memory and preference update before the model or storage sees it. A refused message is answered with the guard's reply (no model call, the text is not kept in history); a refused memory or preference update returns 422 `input_rejected`; a guard that throws fails closed with 503 `guard_unavailable`.

Add `chatbot.deleteUserData(userId)` so a host can erase a user's conversations, memories, preferences and profile when it deletes the account.

The profile from your `identity` resolver now takes precedence over a user preference with the same key (previously a user could override verified profile fields through `PUT /preferences`).
