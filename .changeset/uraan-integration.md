---
"@metanoia/chatbot": patch
---

Load the SQLite driver lazily (better-sqlite3 is now an optional dependency) so PostgreSQL and bundled/serverless hosts never load the native module, and accept a predicate for `allowedOrigins`.
