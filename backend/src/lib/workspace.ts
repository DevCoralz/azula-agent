import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../config.js";
import { checkCommand } from "./policy.js";

const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "build", "target", "__pycache__", ".venv", "vendor", ".cache"]);

export function workspaceDir(userId: number, workspaceId: number): string {
  return path.join(config.workspacesRoot, `u${userId}`, `w${workspaceId}`);
}

export async function ensureWorkspace(userId: number, workspaceId: number): Promise<string> {
  const dir = workspaceDir(userId, workspaceId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Resolve a user-supplied relative path inside the workspace. Throws on escape. */
export function safeResolve(root: string, relative: string): string {
  const cleaned = relative.replace(/^[/\\]+/, "");
  const abs = path.resolve(root, cleaned);
  const rootResolved = path.resolve(root);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
    throw new Error("Path escapes the workspace");
  }
  return abs;
}

export interface Entry { path: string; name: string; type: "file" | "dir"; size?: number }

export async function listTree(root: string, max = 4000): Promise<Entry[]> {
  const out: Entry[] = [];
  async function walk(dir: string, rel: string, depth: number) {
    if (out.length >= max || depth > 12) return;
    let entries: fssync.Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env.example" && e.name !== ".gitignore") continue;
      if (IGNORED.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push({ path: r, name: e.name, type: "dir" });
        await walk(path.join(dir, e.name), r, depth + 1);
      } else if (e.isFile()) {
        let size = 0;
        try { size = (await fs.stat(path.join(dir, e.name))).size; } catch { /* ignore */ }
        out.push({ path: r, name: e.name, type: "file", size });
      }
    }
  }
  await walk(root, "", 0);
  return out;
}

export async function readFileSafe(root: string, rel: string, limit = 200_000): Promise<string> {
  const abs = safeResolve(root, rel);
  const stat = await fs.stat(abs);
  if (stat.size > limit) throw new Error(`File is too large to read (${stat.size} bytes)`);
  return fs.readFile(abs, "utf8");
}

export async function writeFileSafe(root: string, rel: string, content: string): Promise<void> {
  const abs = safeResolve(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

export async function deleteFileSafe(root: string, rel: string): Promise<void> {
  const abs = safeResolve(root, rel);
  if (path.resolve(abs) === path.resolve(root)) throw new Error("Refusing to delete the workspace root");
  await fs.rm(abs, { recursive: true, force: true });
}

export async function searchFiles(root: string, queryText: string, max = 60): Promise<string[]> {
  const results: string[] = [];
  const entries = await listTree(root);
  for (const e of entries) {
    if (e.type !== "file" || results.length >= max) continue;
    if ((e.size ?? 0) > 400_000) continue;
    try {
      const content = await fs.readFile(safeResolve(root, e.path), "utf8");
      content.split("\n").forEach((line, i) => {
        if (results.length < max && line.toLowerCase().includes(queryText.toLowerCase())) {
          results.push(`${e.path}:${i + 1}: ${line.trim().slice(0, 200)}`);
        }
      });
    } catch { /* binary or unreadable */ }
  }
  return results;
}

export interface ExecResult { ok: boolean; code: number | null; output: string; blocked?: string }

/** Run a shell command inside the workspace. Policy-checked, time-limited, output-capped. */
export function execInWorkspace(root: string, command: string, timeoutSeconds = config.execTimeoutSeconds): Promise<ExecResult> {
  const verdict = checkCommand(command);
  if (!verdict.allowed) {
    return Promise.resolve({ ok: false, code: null, output: `Blocked by workspace policy: ${verdict.reason}`, blocked: verdict.reason });
  }

  const docker = config.sandbox.mode === "docker";
  const file = docker ? "docker" : "/bin/bash";
  const args = docker
    ? ["run", "--rm", "-i", "--network", "bridge",
       "--memory", config.sandbox.memory, "--cpus", config.sandbox.cpus, "--pids-limit", config.sandbox.pids,
       "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
       "-v", `${root}:/workspace`, "-w", "/workspace", config.sandbox.image, "bash", "-lc", command]
    : ["-lc", command];

  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: docker ? undefined : root,
      env: { ...process.env, HOME: root, CI: "1", FORCE_COLOR: "0", npm_config_update_notifier: "false" },
    });

    let output = "";
    let killed = false;
    const append = (chunk: Buffer) => {
      if (output.length < config.execOutputLimit) output += chunk.toString();
      if (output.length >= config.execOutputLimit && !killed) {
        output += "\n[output truncated]";
        killed = true;
        child.kill("SIGKILL");
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
      output += `\n[timed out after ${timeoutSeconds}s]`;
    }, timeoutSeconds * 1000);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, output: `${output}\n${err.message}`.trim() });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !killed, code, output: output.trim() || "(no output)" });
    });
  });
}

export async function dirSizeMb(root: string): Promise<number> {
  let bytes = 0;
  const entries = await listTree(root, 20000);
  for (const e of entries) if (e.type === "file") bytes += e.size ?? 0;
  return Math.round(bytes / (1024 * 1024));
}
