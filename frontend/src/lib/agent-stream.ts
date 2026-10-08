import { API_BASE, getToken } from "./api";

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; ok: boolean; output: string }
  | { type: "file_changed"; path: string }
  | { type: "preview"; url: string }
  | { type: "error"; message: string }
  | { type: "done"; usage?: { input: number; output: number } };

/** POSTs a prompt and parses the Server-Sent Events stream from the backend. */
export async function streamAgent(
  body: { workspaceId: number; prompt: string; mode: "build" | "plan"; modelId?: number | undefined },
  onEvent: (e: AgentEvent) => void,
  signal: AbortSignal,
) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = `Agent request failed (${res.status})`;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? msg; } catch { /* plain text */ }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      try { onEvent(JSON.parse(data) as AgentEvent); } catch { /* ignore malformed frame */ }
    }
  }
}
