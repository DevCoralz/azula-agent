import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { exec, one } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { decrypt } from "../lib/crypto.js";
import { getPreview } from "../lib/preview.js";
import { ensureWorkspace, listTree } from "../lib/workspace.js";
import { baseUrlFor, complete, safeParse, type ChatMessage } from "../agent/providers.js";
import { maxSteps, runTool, systemPrompt, toolDefs } from "../agent/tools.js";

export const chatRouter = Router();

const bodySchema = z.object({
  workspaceId: z.number().int().positive(),
  prompt: z.string().min(1).max(20000),
  mode: z.enum(["build", "plan"]).default("build"),
  modelId: z.number().int().positive().optional(),
});

chatRouter.post("/v1/chat", requireAuth, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });
  const { workspaceId, prompt, mode, modelId } = parsed.data;
  const userId = (req as AuthedRequest).userId;

  const ws = await one<{ id: number; name: string }>(
    "SELECT id, name FROM workspaces WHERE id = ? AND user_id = ?", [workspaceId, userId],
  );
  if (!ws) return res.status(404).json({ error: "Workspace not found" });

  const model = modelId
    ? await one<any>("SELECT * FROM models WHERE id = ? AND enabled = 1", [modelId])
    : await one<any>("SELECT * FROM models WHERE enabled = 1 ORDER BY sort LIMIT 1");
  if (!model) return res.status(400).json({ error: "No model available. Ask an admin to enable one." });

  const keyRow = await one<any>(
    "SELECT * FROM api_keys WHERE user_id = ? AND provider = ? ORDER BY id DESC LIMIT 1", [userId, model.provider],
  );
  if (!keyRow) {
    return res.status(400).json({ error: `Add a ${model.provider} API key in Settings before running the agent.` });
  }

  // ---- SSE ----
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (e: unknown) => { res.write(`data: ${JSON.stringify(e)}\n\n`); };
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);

  const ctrl = new AbortController();
  req.on("close", () => ctrl.abort());

  const run = await exec(
    "INSERT INTO runs (workspace_id, user_id, model, mode) VALUES (?, ?, ?, ?)",
    [workspaceId, userId, `${model.provider}/${model.model_id}`, mode],
  );

  let steps = 0;
  let usage = { input: 0, output: 0 };
  let finalText = "";

  try {
    const root = await ensureWorkspace(userId, workspaceId);
    const tree = (await listTree(root)).slice(0, 400).map((e) => `${e.type === "dir" ? "d" : "-"} ${e.path}`).join("\n");
    const preview = getPreview(workspaceId);

    await exec("INSERT INTO messages (workspace_id, role, content) VALUES (?, 'user', ?)", [workspaceId, prompt]);


    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(mode, tree, preview?.url ?? null) },
      { role: "user", content: prompt },
    ];

    const apiKey = decrypt(keyRow.key_cipher);
    const baseUrl = baseUrlFor(model.provider, keyRow.base_url);

    send({ type: "status", message: `${model.label} · ${mode} mode` });

    while (steps < maxSteps) {
      if (ctrl.signal.aborted) throw new Error("aborted");
      steps++;

      const result = await complete({
        provider: model.provider, baseUrl, apiKey, model: model.model_id,
        messages, tools: mode === "plan" ? toolDefs.filter((t) => ["list_dir", "read_file", "search_files"].includes(t.name)) : toolDefs,
        signal: ctrl.signal,
      });
      usage = { input: usage.input + result.usage.input, output: usage.output + result.usage.output };

      if (result.text) { send({ type: "text", text: result.text }); finalText = result.text; }

      if (!result.toolCalls.length) break;

      messages.push({ role: "assistant", content: result.text, tool_calls: result.toolCalls });

      for (const call of result.toolCalls) {
        const args = safeParse(call.arguments);
        send({ type: "tool_call", id: call.id, name: call.name, args });
        const out = await runTool(call.name, args, {
          root, workspaceId,
          timeoutSeconds: config.execTimeoutSeconds,
          onFileChanged: (p) => send({ type: "file_changed", path: p }),
          onPreview: (url) => send({ type: "preview", url }),
        });
        send({ type: "tool_result", id: call.id, name: call.name, ok: out.ok, output: out.output.slice(0, config.execOutputLimit) });
        messages.push({ role: "tool", tool_call_id: call.id, content: out.output.slice(0, config.execOutputLimit) });
      }
    }

    if (steps >= maxSteps) send({ type: "status", message: `Stopped after ${maxSteps} steps. Send another prompt to continue.` });

    if (finalText) {
      await exec("INSERT INTO messages (workspace_id, role, content) VALUES (?, 'assistant', ?)", [workspaceId, finalText]);
    }
    await exec(
      "UPDATE runs SET status = 'done', steps = ?, tokens_in = ?, tokens_out = ?, finished_at = NOW() WHERE id = ?",
      [steps, usage.input, usage.output, run.insertId],
    );
    send({ type: "done", usage });
  } catch (e) {
    const aborted = ctrl.signal.aborted;
    const message = aborted ? "Stopped." : e instanceof Error ? e.message : "Agent run failed";
    await exec(
      "UPDATE runs SET status = ?, steps = ?, error = ?, finished_at = NOW() WHERE id = ?",
      [aborted ? "stopped" : "error", steps, message.slice(0, 1000), run.insertId],
    ).catch(() => {});
    if (!aborted) send({ type: "error", message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});
