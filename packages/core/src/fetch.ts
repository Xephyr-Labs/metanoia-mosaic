import type { Chatbot } from "./types.js";
import { ChatbotError, errorResponse } from "./errors.js";

export type FetchHandlerOptions = { basePath?: string };

/** Adapt a mounted chatbot to frameworks that route Web Request/Response handlers. */
export function createChatbotFetchHandler(chatbot: Chatbot, options: FetchHandlerOptions = {}) {
  const basePath = options.basePath?.replace(/\/+$/, "") ?? "";
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (basePath) {
      if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
        return errorResponse(new ChatbotError("not_found", "Route not found.", 404));
      }
      url.pathname = url.pathname.slice(basePath.length) || "/";
    }
    const init: RequestInit = { method: request.method, headers: request.headers, signal: request.signal };
    if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
      init.body = request.body;
      Object.assign(init, { duplex: "half" });
    }
    return chatbot.handle(new Request(url, init));
  };
}
