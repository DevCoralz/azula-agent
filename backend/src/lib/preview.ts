import { spawn, type ChildProcess } from "node:child_process";
import { config } from "../config.js";
import { checkCommand } from "./policy.js";

interface Preview { port: number; child: ChildProcess; url: string; command: string }

const previews = new Map<number, Preview>(); // workspaceId -> preview
const usedPorts = new Set<number>();

function allocatePort(): number | null {
  for (let p = config.preview.portStart; p <= config.preview.portEnd; p++) {
    if (!usedPorts.has(p)) { usedPorts.add(p); return p; }
  }
  return null;
}

export function startPreview(workspaceId: number, root: string, command: string): { ok: boolean; url?: string; message: string } {
  const verdict = checkCommand(command);
  if (!verdict.allowed) return { ok: false, message: `Blocked by workspace policy: ${verdict.reason}` };

  stopPreview(workspaceId);
  const port = allocatePort();
  if (port === null) return { ok: false, message: "No preview ports available right now. Try again shortly." };

  const child = spawn("/bin/bash", ["-lc", command], {
    cwd: root,
    env: { ...process.env, HOME: root, PORT: String(port), CI: "1", FORCE_COLOR: "0" },
    detached: true,
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  child.on("close", () => { usedPorts.delete(port); previews.delete(workspaceId); });

  const url = config.preview.urlTemplate.replace("{port}", String(port));
  previews.set(workspaceId, { port, child, url, command });
  return { ok: true, url, message: `Preview started on port ${port}. It may take a few seconds to respond.` };
}

export function stopPreview(workspaceId: number): boolean {
  const p = previews.get(workspaceId);
  if (!p) return false;
  try { process.kill(-p.child.pid!, "SIGKILL"); } catch { try { p.child.kill("SIGKILL"); } catch { /* gone */ } }
  usedPorts.delete(p.port);
  previews.delete(workspaceId);
  return true;
}

export function getPreview(workspaceId: number) {
  const p = previews.get(workspaceId);
  return p ? { url: p.url, port: p.port, command: p.command } : null;
}

export function stopAllPreviews() {
  for (const id of [...previews.keys()]) stopPreview(id);
}
