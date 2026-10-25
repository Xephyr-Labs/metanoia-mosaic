/**
 * Inline follow-up suggestions: the model ends its streamed answer with a ```suggestions fenced
 * block, which is cut from the stream and the stored answer instead of costing a second call.
 */
export const SUGGESTIONS_FENCE = "```suggestions";

export const inlineSuggestionGuide = (count: number) =>
  `Finally, after your answer, add a fenced code block tagged suggestions (opened with ${SUGGESTIONS_FENCE}) containing a JSON array of ${count} short follow-up questions the user could ask you next, each specific to this exchange and under 72 characters. Write nothing after that block. The user never sees it as text; it appears as suggestion buttons, so do not also end your answer with a choices block that offers next steps. Use choices only when the user must pick between options to answer your question.`;

/** Normalise model-written suggestions the same way as the separate-call path. */
export function cleanSuggestions(candidates: unknown, count: number): string[] {
  const list = Array.isArray(candidates)
    ? candidates
    : candidates && typeof candidates === "object" && "suggestions" in candidates
      ? (candidates as { suggestions?: unknown }).suggestions
      : undefined;
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((v): v is string => typeof v === "string").map(v => v.replace(/\s+/g, " ").trim()).filter(v => v.length > 0 && v.length <= 120))].slice(0, count);
}

/**
 * Streaming filter. push() returns the text that is safe to show now: it holds back a tail that
 * could still turn into the fence, and swallows everything from the fence on. flush() releases the
 * held tail when the stream ends without a fence.
 */
export function createSuggestionFilter() {
  let pending = "";
  let captured: string | null = null;
  return {
    push(text: string): string {
      if (captured !== null) { captured += text; return ""; }
      pending += text;
      const at = pending.indexOf(SUGGESTIONS_FENCE);
      if (at >= 0) {
        const shown = pending.slice(0, at);
        captured = pending.slice(at + SUGGESTIONS_FENCE.length);
        pending = "";
        return shown;
      }
      let keep = 0;
      for (let k = Math.min(SUGGESTIONS_FENCE.length - 1, pending.length); k > 0; k--) {
        if (SUGGESTIONS_FENCE.startsWith(pending.slice(-k))) { keep = k; break; }
      }
      const shown = pending.slice(0, pending.length - keep);
      pending = pending.slice(pending.length - keep);
      return shown;
    },
    flush(): string { const rest = pending; pending = ""; return rest; },
    suggestions(count: number): string[] {
      if (captured === null) return [];
      const body = captured.split("```")[0]!.trim();
      try { return cleanSuggestions(JSON.parse(body), count); } catch { return []; }
    },
  };
}
