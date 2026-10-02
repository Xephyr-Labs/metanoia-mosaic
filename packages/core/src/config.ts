import { ChatbotError } from "./errors.js";
import type { ChatbotOptions } from "./types.js";

export function validateOptions(options: ChatbotOptions): void {
  if (!options.provider?.baseUrl || !options.provider.apiKey || !options.provider.model) throw new ChatbotError("invalid_config", "provider.baseUrl, provider.apiKey, and provider.model are required.", 500);
  try { new URL(options.provider.baseUrl); } catch { throw new ChatbotError("invalid_config", "provider.baseUrl must be a valid URL.", 500); }
  if(options.provider.compatibility!==undefined&&!["openai","deepinfra","openrouter"].includes(options.provider.compatibility))throw new ChatbotError("invalid_config","provider.compatibility must be openai, deepinfra, or openrouter.",500);
  if (!options.identity && !options.anonymous) throw new ChatbotError("invalid_config", "Configure an identity resolver or explicitly enable anonymous mode.", 500);
  if (options.provider.timeoutMs !== undefined && (!Number.isFinite(options.provider.timeoutMs) || options.provider.timeoutMs < 1 || options.provider.timeoutMs >= 14 * 60_000)) throw new ChatbotError("invalid_config", "provider.timeoutMs must be between 1 millisecond and 14 minutes.",500);
  if(options.provider.promptCacheKey!==undefined&&(typeof options.provider.promptCacheKey!=="string"||!options.provider.promptCacheKey.trim()||options.provider.promptCacheKey.length>200))throw new ChatbotError("invalid_config","provider.promptCacheKey must be a non-empty string under 200 characters.",500);
  if(options.maxToolCallsPerTurn!==undefined&&(!Number.isInteger(options.maxToolCallsPerTurn)||options.maxToolCallsPerTurn<1||options.maxToolCallsPerTurn>12))throw new ChatbotError("invalid_config","maxToolCallsPerTurn must be a whole number from 1 to 12.",500);
  if(options.toolTimeoutMs!==undefined&&(!Number.isFinite(options.toolTimeoutMs)||options.toolTimeoutMs<1||options.toolTimeoutMs>120_000))throw new ChatbotError("invalid_config","toolTimeoutMs must be from 1 millisecond to 2 minutes.",500);
  if(options.tools!==undefined&&!Array.isArray(options.tools))throw new ChatbotError("invalid_config","tools must be an array.",500);
  const toolNames=new Set<string>();
  for(const tool of options.tools??[]){
    if(!tool||typeof tool.name!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)||toolNames.has(tool.name)||typeof tool.description!=="string"||!tool.description.trim()||tool.description.length>1000||!tool.parameters||typeof tool.parameters!=="object"||tool.parameters.type!=="object"||typeof tool.execute!=="function")throw new ChatbotError("invalid_config","Tools need unique valid names, descriptions, an object parameter schema, and an execute function.",500);
    toolNames.add(tool.name);
  }
  if (options.capabilities?.voiceInput?.enabled && (!options.capabilities.voiceInput.model || !options.capabilities.voiceInput.baseUrl || !options.capabilities.voiceInput.apiKey)) throw new ChatbotError("invalid_config", "Voice input requires its own base URL, API key, and transcription model.", 500);
  if (options.capabilities?.voiceOutput?.enabled && (!options.capabilities.voiceOutput.model || !options.capabilities.voiceOutput.voice || !options.capabilities.voiceOutput.baseUrl || !options.capabilities.voiceOutput.apiKey)) throw new ChatbotError("invalid_config", "Voice output requires its own base URL, API key, speech model, and voice.", 500);
  const suggestions=options.capabilities?.suggestions;
  if(suggestions&&typeof suggestions.enabled!=="boolean")throw new ChatbotError("invalid_config","capabilities.suggestions.enabled must be a boolean.",500);
  if(suggestions?.count!==undefined&&(!Number.isInteger(suggestions.count)||suggestions.count<1||suggestions.count>5))throw new ChatbotError("invalid_config","capabilities.suggestions.count must be a whole number from 1 to 5.",500);
  const search=options.capabilities?.webSearch;
  if(search?.enabled&&options.provider.compatibility!=="openrouter")throw new ChatbotError("invalid_config","Built-in web search currently requires provider.compatibility='openrouter'. Use a host-registered tool for other providers.",500);
  if(search?.maxResults!==undefined&&(!Number.isInteger(search.maxResults)||search.maxResults<1||search.maxResults>25)||search?.maxTotalResults!==undefined&&(!Number.isInteger(search.maxTotalResults)||search.maxTotalResults<1||search.maxTotalResults>100))throw new ChatbotError("invalid_config","Web search result limits must be positive whole numbers (maxResults ≤ 25, maxTotalResults ≤ 100).",500);
  if(search?.maxUses!==undefined&&(!Number.isInteger(search.maxUses)||search.maxUses<1||search.maxUses>10))throw new ChatbotError("invalid_config","Web search maxUses must be a whole number from 1 to 10.",500);
  if(search?.engine!==undefined&&!["auto","native","exa","firecrawl","parallel","perplexity"].includes(search.engine))throw new ChatbotError("invalid_config","Unsupported web search engine.",500);
  if(search?.allowedDomains?.some(domain=>typeof domain!=="string"||!domain.trim()||domain.length>253)||search?.excludedDomains?.some(domain=>typeof domain!=="string"||!domain.trim()||domain.length>253))throw new ChatbotError("invalid_config","Web search domains must be non-empty host names under 254 characters.",500);
  const limits = options.context;
  if (limits && Object.values(limits).some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new ChatbotError("invalid_config", "Context limits must be non-negative finite numbers.", 500);
  if(limits?.inputTokens!==undefined&&limits.inputTokens<1||limits?.outputTokens!==undefined&&limits.outputTokens<1)throw new ChatbotError("invalid_config","Input and output token limits must be positive.",500);
  if(limits?.recentMessages!==undefined&&(!Number.isInteger(limits.recentMessages)||limits.recentMessages<1)||limits?.summaryAfterMessages!==undefined&&(!Number.isInteger(limits.summaryAfterMessages)||limits.summaryAfterMessages<1))throw new ChatbotError("invalid_config","Message thresholds must be positive whole numbers.",500);
  if(options.rateLimit&&(!Number.isInteger(options.rateLimit.requests)||options.rateLimit.requests<1||!Number.isFinite(options.rateLimit.windowMs)||options.rateLimit.windowMs<1))throw new ChatbotError("invalid_config","Rate limits require a positive request count and window.",500);
}
