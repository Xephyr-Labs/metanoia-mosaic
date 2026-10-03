import { mount, type ConversationStore, type WidgetLabels, type WidgetOptions } from "./index.js";

const observed = ["endpoint", "name", "avatar-url", "greeting", "theme", "placement", "accent", "width", "height", "launcher", "locale", "dir", "credentials"];

class MetanoiaChatElement extends HTMLElement {
  static get observedAttributes() { return observed; }
  private instance?: ReturnType<typeof mount>;
  private authHeaders?: WidgetOptions["headers"];
  private store?: ConversationStore;
  private localizedLabels?: WidgetLabels;

  connectedCallback() {
    // Values assigned before a deferred script upgrades the element otherwise
    // shadow the prototype setters and never reach mount().
    const properties = this as unknown as Record<string, unknown>;
    for (const key of ["headers", "conversationStore", "labels"]) {
      if (!Object.hasOwn(this, key)) continue;
      const value = properties[key];
      delete properties[key];
      properties[key] = value;
    }
    if (this.instance) return;
    const endpoint = this.getAttribute("endpoint");
    if (!endpoint) return;
    this.instance = mount(this, this.options(endpoint));
  }

  disconnectedCallback() {
    this.instance?.destroy();
    this.instance = undefined;
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null) {
    if (previous === value) return;
    if (name === "endpoint") {
      this.instance?.destroy();
      this.instance = undefined;
    }
    if (!this.isConnected) return;
    if (!this.instance) {
      this.connectedCallback();
      return;
    }
    const endpoint = this.getAttribute("endpoint");
    if (this.instance && endpoint) this.instance.update(this.options(endpoint));
  }

  set headers(value: WidgetOptions["headers"]) {
    this.authHeaders = value;
    if (this.instance) this.instance.update({ headers: value });
  }

  set conversationStore(value: ConversationStore | undefined) {
    this.store = value;
    if (this.instance) this.instance.update({ conversationStore: value });
  }

  set labels(value: WidgetLabels | undefined) {
    this.localizedLabels = value;
    if (this.instance) this.instance.update({ labels: value });
  }

  private options(endpoint: string): WidgetOptions {
    const attr = (name: string) => this.getAttribute(name) ?? undefined;
    const number = (name: string) => {
      const value = attr(name);
      if (!value?.trim()) return undefined;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : undefined;
    };
    return {
      endpoint,
      name: attr("name"),
      avatarUrl: attr("avatar-url"),
      greeting: attr("greeting"),
      theme: attr("theme") as WidgetOptions["theme"],
      placement: attr("placement") as WidgetOptions["placement"],
      accent: attr("accent"),
      width: number("width"),
      height: number("height"),
      launcher: attr("launcher") as WidgetOptions["launcher"],
      locale: attr("locale"),
      dir: attr("dir") as WidgetOptions["dir"],
      headers: this.authHeaders,
      labels: this.localizedLabels,
      credentials: attr("credentials") as RequestCredentials | undefined,
      conversationStore: this.store,
    };
  }
}

if (!customElements.get("metanoia-chat")) customElements.define("metanoia-chat", MetanoiaChatElement);
