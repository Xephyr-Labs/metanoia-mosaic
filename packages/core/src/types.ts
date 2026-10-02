export type UserIdentity = { userId: string; profile?: Record<string, unknown> };
export type IdentityResolver = (request: Request) => UserIdentity | null | Promise<UserIdentity | null>;
export type ChatbotToolContext = { request: Request; identity: UserIdentity; instanceId: string; conversationId: string; requestId?: string; signal: AbortSignal };
export type ChatbotTool = { name: string; description: string; parameters: Record<string, unknown>; displayName?: string; execute: (args: Record<string, unknown>, context: ChatbotToolContext) => unknown | Promise<unknown> };

export type Capabilities = {
  images?: { enabled: boolean; maxBytes?: number; maxCount?: number; maxDimension?: number };
  voiceInput?: { enabled: boolean; baseUrl?: string; apiKey?: string; model?: string; maxBytes?: number; maxSeconds?: number };
  voiceOutput?: { enabled: boolean; baseUrl?: string; apiKey?: string; model?: string; voice?: string };
  /** Opt-in contextual follow-up prompts. Generates one additional short provider completion per turn. */
  suggestions?: { enabled: boolean; count?: number };
  webSearch?: { enabled: boolean; engine?: "auto" | "native" | "exa" | "firecrawl" | "parallel" | "perplexity"; maxResults?: number; maxTotalResults?: number; maxUses?: number; allowedDomains?: string[]; excludedDomains?: string[] };
};

export type Branding = {
  name?: string; avatarUrl?: string; greeting?: string; suggestedPrompts?: string[];
  personality?: string; locale?: string; theme?: "light" | "dark" | "system";
  colors?: Record<string, string>; font?: string; placement?: "bottom-right" | "bottom-left";
  width?: number; height?: number; launcher?: "bubble" | "button";
};

export type ContextLimits = {
  inputTokens?: number; outputTokens?: number; recentMessages?: number;
  summaryAfterMessages?: number; memoryCount?: number; memoryChars?: number;
  imageTokenReserve?: number; personalizationTokens?: number; toolTokenReserve?: number;
};

export type PersonalizationOptions = { autoMemory?: boolean; memoryEveryMessages?: number };

export type ChatbotOptions = {
  instanceId?: string;
  provider: {
    baseUrl: string; apiKey: string; model: string; timeoutMs?: number;
    headers?: Record<string, string>;
    /** Request dialect for provider-specific OpenAI-compatible differences. */
    compatibility?: "openai" | "deepinfra" | "openrouter";
    /** Include streamed usage. Disable for compatible endpoints that reject stream_options. Defaults to true. */
    includeUsage?: boolean;
    /** @deprecated OpenAI-only extension; not sent to DeepInfra or OpenRouter. */
    promptCacheKey?: string;
  };
  storage?: { type?: "sqlite" | "postgres"; filename?: string; connectionString?: string };
  branding?: Branding;
  capabilities?: Capabilities;
  context?: ContextLimits;
  personalization?: PersonalizationOptions;
  tools?: ChatbotTool[];
  maxToolCallsPerTurn?: number;
  toolTimeoutMs?: number;
  identity?: IdentityResolver;
  anonymous?: boolean;
  allowedOrigins?: string[];
  rateLimit?: { requests: number; windowMs: number };
  onEvent?: (event: ChatbotEvent) => void | Promise<void>;
};

export type ChatbotEvent = { type: string; instanceId: string; userId?: string; at: string; data?: Record<string, unknown> };
export type WidgetConfig = { branding: Required<Pick<Branding, "name" | "greeting" | "theme" | "placement" | "width" | "height">> & Branding; capabilities: { images: boolean; voiceInput: boolean; voiceOutput: boolean; suggestions: boolean; suggestionCount?: number; voiceInputMaxSeconds?: number } };
export type Chatbot = { ready: Promise<void>; handle(request: Request): Promise<Response>; close(): Promise<void> };
