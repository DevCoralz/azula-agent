import { config } from "../config.js";
import { checkPackage } from "../lib/policy.js";
import { getPreview, startPreview, stopPreview } from "../lib/preview.js";
import {
  deleteFileSafe, execInWorkspace, listTree, readFileSafe, searchFiles, writeFileSafe,
} from "../lib/workspace.js";
import type { ToolDef } from "./providers.js";

export const toolDefs: ToolDef[] = [
  {
    name: "list_dir",
    description: "List files and folders in the workspace. Use this first to understand the project layout.",
    parameters: { type: "object", properties: { path: { type: "string", description: "Relative directory, empty for root" } } },
  },
  {
    name: "read_file",
    description: "Read a file's full contents.",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with the full new contents. Always write complete files, never partial snippets.",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
  },
  {
    name: "delete_file",
    description: "Delete a file or directory inside the workspace.",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "search_files",
    description: "Search the workspace for a literal string and return matching file:line results.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "exec_cmd",
    description: "Run a shell command in the workspace root. Use for installing dependencies, running builds, tests and CLI tools.",
    parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
  {
    name: "install_tool",
    description: "Install a package or CLI tool into the workspace. manager is one of npm, pip, cargo, go, gem, composer, apt.",
    parameters: {
      type: "object",
      properties: { manager: { type: "string" }, name: { type: "string" } },
      required: ["manager", "name"],
    },
  },
  {
    name: "start_preview",
    description: "Start a long-running dev server and expose it in the live preview pane. The server must listen on $PORT.",
    parameters: { type: "object", properties: { command: { type: "string", description: "e.g. npm run dev -- --port $PORT --host" } }, required: ["command"] },
  },
  {
    name: "stop_preview",
    description: "Stop the running live preview server.",
    parameters: { type: "object", properties: {} },
  },
];

export interface ToolContext {
  root: string;
  workspaceId: number;
  timeoutSeconds: number;
  onFileChanged: (path: string) => void;
  onPreview: (url: string) => void;
}

export async function runTool(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext,
): Promise<{ ok: boolean; output: string }> {
  try {
    switch (name) {
      case "list_dir": {
        const entries = await listTree(ctx.root);
        const prefix = String(args.path ?? "").replace(/^\/+|\/+$/g, "");
        const filtered = prefix ? entries.filter((e) => e.path.startsWith(prefix + "/") || e.path === prefix) : entries;
        if (!filtered.length) return { ok: true, output: "(empty)" };
        return { ok: true, output: filtered.slice(0, 600).map((e) => `${e.type === "dir" ? "d" : "-"} ${e.path}`).join("\n") };
      }
      case "read_file":
        return { ok: true, output: await readFileSafe(ctx.root, String(args.path)) };
      case "write_file": {
        await writeFileSafe(ctx.root, String(args.path), String(args.content ?? ""));
        ctx.onFileChanged(String(args.path));
        return { ok: true, output: `Wrote ${args.path} (${String(args.content ?? "").length} bytes)` };
      }
      case "delete_file": {
        await deleteFileSafe(ctx.root, String(args.path));
        ctx.onFileChanged(String(args.path));
        return { ok: true, output: `Deleted ${args.path}` };
      }
      case "search_files": {
        const hits = await searchFiles(ctx.root, String(args.query));
        return { ok: true, output: hits.length ? hits.join("\n") : "No matches." };
      }
      case "exec_cmd": {
        const r = await execInWorkspace(ctx.root, String(args.command), ctx.timeoutSeconds);
        ctx.onFileChanged("");
        return { ok: r.ok, output: `$ ${args.command}\n${r.output}${r.code !== null ? `\n[exit ${r.code}]` : ""}` };
      }
      case "install_tool": {
        const pkg = String(args.name ?? "");
        const verdict = checkPackage(pkg);
        if (!verdict.allowed) return { ok: false, output: `Blocked: ${verdict.reason}` };
        const manager = String(args.manager ?? "npm");
        const cmds: Record<string, string> = {
          npm: `npm install ${pkg}`,
          pnpm: `pnpm add ${pkg}`,
          yarn: `yarn add ${pkg}`,
          bun: `bun add ${pkg}`,
          pip: `pip install --user ${pkg}`,
          cargo: `cargo add ${pkg}`,
          go: `go get ${pkg}`,
          gem: `gem install --user-install ${pkg}`,
          composer: `composer require ${pkg}`,
          apt: `apt-get download ${pkg} || echo "System packages are preinstalled in the sandbox image; ask an admin to add ${pkg}."`,
        };
        const cmd = cmds[manager];
        if (!cmd) return { ok: false, output: `Unknown package manager: ${manager}` };
        const r = await execInWorkspace(ctx.root, cmd, Math.max(ctx.timeoutSeconds, 300));
        return { ok: r.ok, output: `$ ${cmd}\n${r.output}` };
      }
      case "start_preview": {
        const r = startPreview(ctx.workspaceId, ctx.root, String(args.command));
        if (r.ok && r.url) ctx.onPreview(r.url);
        return { ok: r.ok, output: r.message + (r.url ? `\n${r.url}` : "") };
      }
      case "stop_preview":
        return { ok: true, output: stopPreview(ctx.workspaceId) ? "Preview stopped." : "No preview was running." };
      default:
        return { ok: false, output: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : "Tool failed" };
  }
}

export function systemPrompt(mode: "build" | "plan", tree: string, previewUrl: string | null): string {
  return [
    "You are Azula, an autonomous coding agent working inside an isolated Linux workspace owned by one user.",
    "",
    mode === "plan"
      ? "MODE: PLAN. Investigate with read-only tools (list_dir, read_file, search_files) and then reply with a concise, concrete plan. Do not write files or run commands that change state."
      : "MODE: BUILD. Finish the whole task. Create and edit files, install what you need, run the build or tests, and fix what you break before replying.",
    "",
    "Rules:",
    "- Call one tool at a time and read its output before the next step.",
    "- write_file always receives the complete file. Never write placeholders, ellipses or 'rest of code unchanged'.",
    "- Read a file before you edit it.",
    "- After a code change that can be verified, run the relevant build, lint or test command.",
    "- Dev servers must bind to $PORT and be started with start_preview, not exec_cmd.",
    "- Never attempt crypto mining, attacks on third parties, tunnels, or anything outside the workspace. Those commands are refused by policy.",
    "- When you are finished, reply in plain prose: what changed, how to run it, and anything the user must do. No emojis, no hype.",
    "",
    previewUrl ? `Live preview is running at ${previewUrl}.` : "No live preview is running.",
    "",
    "Current workspace tree:",
    tree || "(empty workspace)",
  ].join("\n");
}

export const maxSteps = config.agentMaxSteps;
