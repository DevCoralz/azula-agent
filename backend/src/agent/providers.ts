/**
 * Provider adapters. Everything is normalised to an OpenAI-style
 * tool-calling message loop so the agent code stays provider-agnostic.
 */

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; name: string; arguments: string }[];
  tool_call_id?: string;
}

export interface CompletionResult {
  text: string;
  toolCalls: { id: string; name: string; arguments: string }[];
  usage: { input: number; output: number };
}

export function baseUrlFor(provider: string, custom?: string | null): string {
  if (custom) return custom.replace(/\/$/, "");
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "openrouter": return "https://openrouter.ai/api/v1";
    case "groq": return "https://api.groq.com/openai/v1";
    case "deepseek": return "https://api.deepseek.com/v1";
    case "google": return "https://generativelanguage.googleapis.com/v1beta/openai";
    case "anthropic": return "https://api.anthropic.com/v1";
    default: return "https://api.openai.com/v1";
  }
}

export async function complete(opts: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  signal: AbortSignal;
}): Promise<CompletionResult> {
  return opts.provider === "anthropic" ? anthropic(opts) : openaiCompatible(opts);
}

async function openaiCompatible(o: Parameters<typeof complete>[0]): Promise<CompletionResult> {
  const res = await fetch(`${o.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.apiKey}` },
    signal: o.signal,
    body: JSON.stringify({
      model: o.model,
      messages: o.messages.map((m) => {
        if (m.role === "tool") return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
        if (m.role === "assistant" && m.tool_calls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.tool_calls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: t.arguments } })),
          };
        }
        return { role: m.role, content: m.content };
      }),
      tools: o.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(await providerError(res));
  const data = (await res.json()) as any;
  const choice = data.choices?.[0]?.message ?? {};
  return {
    text: choice.content ?? "",
    toolCalls: (choice.tool_calls ?? []).map((t: any) => ({ id: t.id, name: t.function.name, arguments: t.function.arguments ?? "{}" })),
    usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
  };
}

async function anthropic(o: Parameters<typeof complete>[0]): Promise<CompletionResult> {
  const system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const msgs: any[] = [];
  for (const m of o.messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] });
    } else if (m.role === "assistant") {
      const content: any[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const t of m.tool_calls ?? []) {
        content.push({ type: "tool_use", id: t.id, name: t.name, input: safeParse(t.arguments) });
      }
      msgs.push({ role: "assistant", content });
    } else {
      msgs.push({ role: "user", content: m.content });
    }
  }

  const res = await fetch(`${o.baseUrl}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": o.apiKey, "anthropic-version": "2023-06-01" },
    signal: o.signal,
    body: JSON.stringify({
      model: o.model,
      max_tokens: 8000,
      system,
      messages: msgs,
      tools: o.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    }),
  });

  if (!res.ok) throw new Error(await providerError(res));
  const data = (await res.json()) as any;
  const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const toolCalls = (data.content ?? []).filter((c: any) => c.type === "tool_use")
    .map((c: any) => ({ id: c.id, name: c.name, arguments: JSON.stringify(c.input ?? {}) }));
  return { text, toolCalls, usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 } };
}

async function providerError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 400);
  try { detail = JSON.parse(body)?.error?.message ?? detail; } catch { /* plain text */ }
  if (res.status === 401) return "Your API key was rejected by the provider. Check it in Settings.";
  if (res.status === 429) return "The provider is rate limiting your key. Wait a moment and retry.";
  if (res.status === 402) return "Your provider account has no credit left.";
  return `Provider error (${res.status}): ${detail}`;
}

export function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s || "{}") as Record<string, unknown>; } catch { return {}; }
}

/** Lightweight key validation used by the Test button in Settings. */
export async function testKey(provider: string, baseUrl: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (provider === "anthropic") {
      const r = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
      return r.ok || r.status === 400
        ? { ok: true, message: "Key accepted by Anthropic" }
        : { ok: false, message: await providerError(r) };
    }
    const r = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    return r.ok ? { ok: true, message: "Key accepted by provider" } : { ok: false, message: await providerError(r) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not reach the provider" };
  }
}
