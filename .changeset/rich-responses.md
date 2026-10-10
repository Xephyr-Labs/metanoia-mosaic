---
"@metanoia/chatbot": minor
"@metanoia/widget": minor
---

Rich replies: the widget renders GitHub tables, task lists, quotes, images, copyable code blocks, SVG charts, clickable choice buttons, Mermaid diagrams, model-written SVG, and KaTeX math. Mermaid and KaTeX load only when a reply needs them (`rich.mermaidUrl` / `rich.katexUrl` to self-host); model SVG and diagrams are displayed as images so they cannot run scripts. The server adds a short format guide to the system prompt, controlled by `capabilities.richResponses`.
