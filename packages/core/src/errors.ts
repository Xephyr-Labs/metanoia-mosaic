export class ChatbotError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "ChatbotError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ChatbotError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return Response.json({ error: { code: "internal_error", message: "The chatbot could not complete this request." } }, { status: 500 });
}
