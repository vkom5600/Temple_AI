import Anthropic from "@anthropic-ai/sdk";

// Temple AI (Claude). Everything here is optional: with no ANTHROPIC_API_KEY in
// .env the app keeps working with its rule-based answers and planner.
// The SDK reads ANTHROPIC_API_KEY from the environment itself.

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
let client = null;

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const aiModel = () => MODEL;

const getClient = () => (client ??= new Anthropic());

const textOf = (response) =>
    response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

// Returns { ok: true, response } or { ok: false, reason } and never throws,
// so callers can fall back to the rule-based answer.
const call = async (params) => {
    if (!aiEnabled()) return { ok: false, reason: "not_configured" };
    try {
        const response = await getClient().messages.create({ model: MODEL, ...params });
        if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
        if (response.stop_reason === "max_tokens") return { ok: false, reason: "too_long" };
        return { ok: true, response };
    } catch (error) {
        const reason = error instanceof Anthropic.RateLimitError ? "rate_limited"
            : error instanceof Anthropic.AuthenticationError ? "bad_key"
            : "error";
        console.error(`Claude call failed (${reason}):`, error.message);
        return { ok: false, reason };
    }
};

// A plain-text answer, e.g. Ask AI.
export const askText = async ({ system, messages, maxTokens = 2000 }) => {
    const r = await call({ max_tokens: maxTokens, output_config: { effort: "medium" }, system, messages });
    return r.ok ? { ok: true, text: textOf(r.response) } : r;
};

// An answer that must match a JSON schema, e.g. reading an event idea.
export const askJson = async ({ system, messages, schema, maxTokens = 1500 }) => {
    const r = await call({
        max_tokens: maxTokens,
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system,
        messages,
    });
    if (!r.ok) return r;
    try {
        return { ok: true, data: JSON.parse(textOf(r.response)) };
    } catch {
        return { ok: false, reason: "bad_json" };
    }
};
