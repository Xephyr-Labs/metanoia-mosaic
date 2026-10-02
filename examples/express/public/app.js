import { mount } from "/widget/index.js";

const host = document.createElement("div");
document.body.append(host);
const assistant = mount(host, {
  endpoint: "/api/chat",
  name: "Mira",
  avatarUrl: "/assistant.svg",
  theme: "system",
  colors: {
    accent: "#536d62",
    panel: "#ffffff",
    text: "#1c2024",
    muted: "#727a80",
    userMessage: "#536d62",
    assistantMessage: "#f1f4f2",
    border: "#e3e7e9",
  },
  font: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
});

for (const button of document.querySelectorAll("#open-assistant, #contact-assistant, .topic-link")) {
  button.addEventListener("click", () => assistant.open());
}

await assistant.ready;
