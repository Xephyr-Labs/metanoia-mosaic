export type ChatbotClientOptions = {
  endpoint: string;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
};

export type ConversationSummary = { id: string; title: string; created_at: string; updated_at: string };
export type ChatbotConfig = {
  branding: Record<string, unknown>;
  capabilities: { images: boolean; voiceInput: boolean; voiceOutput: boolean; suggestions: boolean; suggestionCount?: number; voiceInputMaxSeconds?: number };
};
export type ChatbotEvent =
  | { type: "delta"; data: { text: string } }
  | { type: "usage"; data: { input?: number; output?: number; cachedInput?: number } }
  | { type: "tool"; data: { name: string; label: string; status: "running" | "complete" | "failed" } }
  | { type: "citation"; data: { url: string; title: string } }
  | { type: "status"; data: { message: string } }
  | { type: "suggestions"; data: { prompts: string[] } }
  | { type: "done"; data: { messageId: string } }
  | { type: "error"; data: { code: string; message: string } };

export class ChatbotClientError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ChatbotClientError";
  }
}

export function createChatbotClient(options: ChatbotClientOptions) {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!endpoint) throw new TypeError("endpoint is required");
  if (typeof fetcher !== "function") throw new TypeError("A Fetch implementation is required");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const configured = typeof options.headers === "function" ? await options.headers() : options.headers;
    const headers = new Headers(configured);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (typeof init.body === "string" && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetcher(`${endpoint}${path}`, {
      ...init,
      headers,
      credentials: init.credentials ?? options.credentials ?? "include",
    });
    if (!response.ok) {
      let body: { error?: { code?: string; message?: string } } = {};
      try { body = await response.json() as typeof body; } catch { /* use a generic error */ }
      throw new ChatbotClientError(body.error?.message ?? `Chatbot request failed (${response.status}).`, response.status, body.error?.code);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async function* parseEvents(response: Response): AsyncGenerator<ChatbotEvent> {
    if (!response.body) throw new ChatbotClientError("Streaming response body is unavailable. Provide a streaming Fetch implementation.", response.status);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "message";
    let data: string[] = [];
    const dispatch = (): ChatbotEvent | undefined => {
      if (!data.length) { eventName = "message"; return; }
      const raw = data.join("\n");
      data = [];
      const name = eventName;
      eventName = "message";
      try { return { type: name, data: JSON.parse(raw) } as ChatbotEvent; }
      catch { return { type: "error", data: { code: "invalid_event", message: "The server sent an invalid streaming event." } }; }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "") { const event = dispatch(); if (event) yield event; }
          else if (!line.startsWith(":")) {
            const separator = line.indexOf(":");
            const field = separator < 0 ? line : line.slice(0, separator);
            const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
            if (field === "event") eventName = value;
            else if (field === "data") data.push(value);
          }
        }
        if (done) break;
      }
      if (buffer) {
        if (buffer.startsWith("data:")) data.push(buffer.slice(5).replace(/^ /, ""));
      }
      const last = dispatch();
      if (last) yield last;
    } finally {
      try { await reader.cancel(); } catch { /* the stream may already be closed */ }
      reader.releaseLock();
    }
  }

  return {
    async config() { return request<ChatbotConfig>("/config"); },
    async conversations() { return request<{ conversations: ConversationSummary[] }>("/conversations"); },
    async createConversation() { return request<{ conversation: ConversationSummary }>("/conversations", { method: "POST", body: "{}" }); },
    async conversation(id: string) { return request<{ conversation: ConversationSummary; messages: Array<Record<string, unknown>> }>(`/conversations/${encodeURIComponent(id)}`); },
    async deleteConversation(id: string) { return request<void>(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    async preferences() { return request<{ preferences: Record<string, unknown> }>("/preferences"); },
    async updatePreferences(preferences: Record<string, unknown>) { return request<{ preferences: Record<string, unknown> }>("/preferences", { method: "PUT", body: JSON.stringify({ preferences }) }); },
    async memories() { return request<{ memories: Array<{ id: string; content: string; created_at: string }> }>("/memories"); },
    async addMemory(content: string) { return request<{ memory: { id: string; content: string } }>("/memories", { method: "POST", body: JSON.stringify({ content }) }); },
    async updateMemory(id: string, content: string) { return request<{ ok: boolean }>(`/memories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ content }) }); },
    async deleteMemory(id: string) { return request<void>(`/memories/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    async deleteUserData() { return request<void>("/user-data", { method: "DELETE" }); },
    async uploadImage(conversationId: string, file: Blob, filename = "image") {
      const form = new FormData();
      form.append("conversationId", conversationId);
      form.append("file", file, filename);
      return request<{ mediaId: string; mime: string; width: number; height: number }>("/media", { method: "POST", body: form });
    },
    async transcribe(file: Blob, filename = "recording.webm") {
      const form = new FormData();
      form.append("file", file, filename);
      return request<{ text: string }>("/transcriptions", { method: "POST", body: form });
    },
    async speech(text: string, signal?: AbortSignal) {
      const configured = typeof options.headers === "function" ? await options.headers() : options.headers;
      const headers = new Headers(configured);
      headers.set("content-type", "application/json");
      const response = await fetcher(`${endpoint}/speech`, { method: "POST", headers, body: JSON.stringify({ text }), credentials: options.credentials ?? "include", signal });
      if (!response.ok) {
        let body: { error?: { code?: string; message?: string } } = {};
        try { body = await response.json() as typeof body; } catch { /* use a generic error */ }
        throw new ChatbotClientError(body.error?.message ?? `Chatbot request failed (${response.status}).`, response.status, body.error?.code);
      }
      return response.blob();
    },
    async *sendMessage(conversationId: string, input: { content: string; requestId?: string; mediaIds?: string[]; signal?: AbortSignal }): AsyncGenerator<ChatbotEvent> {
      const configured = typeof options.headers === "function" ? await options.headers() : options.headers;
      const headers = new Headers(configured);
      headers.set("content-type", "application/json");
      const response = await fetcher(`${endpoint}/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: input.content, requestId: input.requestId, mediaIds: input.mediaIds }),
        credentials: options.credentials ?? "include",
        signal: input.signal,
      });
      if (!response.ok) {
        let body: { error?: { code?: string; message?: string } } = {};
        try { body = await response.json() as typeof body; } catch { /* use a generic error */ }
        throw new ChatbotClientError(body.error?.message ?? `Chatbot request failed (${response.status}).`, response.status, body.error?.code);
      }
      yield* parseEvents(response);
    },
  };
}
