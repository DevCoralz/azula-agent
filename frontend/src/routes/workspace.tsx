import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, ChevronRight, Copy, File, Folder, FolderOpen, Loader2, MonitorPlay,
  Plus, RefreshCw, Send, Settings, Square, Terminal, Trash2, CheckCircle2, XCircle, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/components/azula/AppShell";
import { LogoMark } from "@/components/azula/Logo";
import { api, API_BASE, type ModelRecord, type WorkspaceFile } from "@/lib/api";
import { streamAgent, type AgentEvent } from "@/lib/agent-stream";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Azula Code" },
      { name: "description", content: "Your isolated agent workspace: prompt, run log, files and live preview." },
      { property: "og:title", content: "Workspace — Azula Code" },
      { property: "og:description", content: "Prompt the agent and watch it build." },
    ],
  }),
  component: () => <RequireAuth><Workspace /></RequireAuth>,
});

interface Ws { id: number; name: string; created_at: string }
interface LogItem { id: string; event: AgentEvent; prompt?: string | undefined }

function Workspace() {
  const [workspaces, setWorkspaces] = useState<Ws[]>([]);
  const [active, setActive] = useState<Ws | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; content: string } | null>(null);
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [mode, setMode] = useState<"build" | "plan">("build");
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<LogItem[]>([]);
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; ms: number } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const ping = useCallback(async () => {
    const t = performance.now();
    try { await api("/health"); setHealth({ ok: true, ms: Math.round(performance.now() - t) }); }
    catch { setHealth({ ok: false, ms: 0 }); }
  }, []);

  useEffect(() => {
    void ping();
    const i = setInterval(() => void ping(), 15000);
    return () => clearInterval(i);
  }, [ping]);

  useEffect(() => {
    api<{ workspaces: Ws[] }>("/api/workspaces").then((d) => {
      setWorkspaces(d.workspaces);
      if (d.workspaces[0]) setActive(d.workspaces[0]);
    }).catch(() => {});
    api<{ models: ModelRecord[] }>("/api/models").then((d) => {
      setModels(d.models);
      if (d.models[0]) setModelId(String(d.models[0].id));
    }).catch(() => {});
  }, []);

  const loadFiles = useCallback(async (ws: Ws) => {
    try {
      const d = await api<{ files: WorkspaceFile[] }>(`/api/workspaces/${ws.id}/files`);
      setFiles(d.files);
    } catch { setFiles([]); }
  }, []);

  useEffect(() => {
    if (!active) return;
    setOpenFile(null); setLog([]); setPreviewUrl(null);
    void loadFiles(active);
    api<{ messages: { id: number; role: string; content: string }[] }>(`/api/workspaces/${active.id}/history`)
      .then((d) => setLog(d.messages.map((m) => ({
        id: `h${m.id}`, prompt: m.role === "user" ? m.content : undefined,
        event: { type: "text", text: m.role === "user" ? "" : m.content },
      })))).catch(() => {});
  }, [active, loadFiles]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  async function open(path: string) {
    if (!active) return;
    try {
      const d = await api<{ content: string }>(`/api/workspaces/${active.id}/file?path=${encodeURIComponent(path)}`);
      setOpenFile({ path, content: d.content }); setTab("code");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open file"); }
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    try {
      const d = await api<{ workspace: Ws }>("/api/workspaces", { method: "POST", body: { name: newName.trim() } });
      setWorkspaces((w) => [d.workspace, ...w]); setActive(d.workspace); setNewOpen(false); setNewName("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create workspace"); }
  }

  async function run() {
    if (!active || !prompt.trim() || running) return;
    const text = prompt.trim();
    setPrompt(""); setRunning(true);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLog((l) => [...l, { id: crypto.randomUUID(), prompt: text, event: { type: "status", message: "" } }]);
    try {
      await streamAgent({ workspaceId: active.id, prompt: text, mode, modelId: modelId ? Number(modelId) : undefined }, (ev) => {
        if (ev.type === "file_changed") void loadFiles(active);
        if (ev.type === "preview") { setPreviewUrl(ev.url); setTab("preview"); }
        setLog((l) => {
          const last = l[l.length - 1];
          if ((ev.type === "text" || ev.type === "thinking") && last && last.event.type === ev.type && !last.prompt) {
            return [...l.slice(0, -1), { ...last, event: { ...ev, text: (last.event as { text: string }).text + ev.text } }];
          }
          return [...l, { id: crypto.randomUUID(), event: ev }];
        });
      }, ctrl.signal);
    } catch (e) {
      if (!ctrl.signal.aborted) setLog((l) => [...l, { id: crypto.randomUUID(), event: { type: "error", message: e instanceof Error ? e.message : "Agent failed" } }]);
      else setLog((l) => [...l, { id: crypto.randomUUID(), event: { type: "error", message: "Stopped by user" } }]);
    } finally { setRunning(false); abortRef.current = null; void loadFiles(active); }
  }

  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-3">
        <Link to="/" aria-label="Home"><LogoMark className="h-6 w-6" /></Link>
        <Select value={active ? String(active.id) : ""} onValueChange={(v) => setActive(workspaces.find((w) => String(w.id) === v) ?? null)}>
          <SelectTrigger className="h-8 w-48 border-none bg-transparent text-sm font-medium"><SelectValue placeholder="No workspace" /></SelectTrigger>
          <SelectContent>{workspaces.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNewOpen(true)} aria-label="New workspace"><Plus className="h-4 w-4" /></Button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void ping()} className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", health?.ok ? "bg-success animate-pulse" : "bg-destructive")} />
            {health?.ok ? `${health.ms}ms` : "offline"}
            <span className="hidden sm:inline">· {API_BASE.replace(/^https?:\/\//, "")}</span>
          </button>
          <Button asChild size="icon" variant="ghost" className="h-8 w-8"><Link to="/settings" aria-label="Settings"><Settings className="h-4 w-4" /></Link></Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* File tree */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="flex h-9 items-center justify-between px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Files
            <button onClick={() => active && void loadFiles(active)} aria-label="Refresh files" className="rounded p-1 hover:bg-accent"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex-1 overflow-auto px-1.5 pb-3 font-mono text-[12.5px]">
            {files.length === 0 ? <p className="px-2 py-4 font-sans text-xs text-muted-foreground">Empty. Ask the agent to scaffold something.</p>
              : <TreeView node={tree} depth={0} onOpen={open} activePath={openFile?.path} />}
          </div>
        </aside>

        {/* Editor / preview */}
        <section className="hidden min-w-0 flex-1 flex-col border-r border-border md:flex">
          <div className="flex h-9 items-center gap-1 border-b border-border px-2">
            {(["code", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs", tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t === "code" ? <File className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />}
                {t === "code" ? (openFile?.path ?? "No file") : "Preview"}
              </button>
            ))}
            {tab === "code" && openFile && (
              <button className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label="Copy file"
                onClick={() => { void navigator.clipboard.writeText(openFile.content); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-background">
            {tab === "code" ? (
              openFile ? <CodeView content={openFile.content} /> : <Empty icon={File} text="Select a file to view it here." />
            ) : previewUrl ? (
              <iframe title="Live preview" src={previewUrl} className="h-full w-full bg-foreground" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" />
            ) : (
              <Empty icon={MonitorPlay} text="Preview appears when the agent starts a dev server." />
            )}
          </div>
        </section>

        {/* Agent panel */}
        <section className="flex min-h-0 w-full flex-col lg:w-[440px] lg:shrink-0">
          <div className="flex h-9 items-center gap-2 border-b border-border px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> Run log
            {log.length > 0 && <button onClick={() => setLog([])} className="ml-auto rounded p-1 hover:bg-accent" aria-label="Clear log"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {!active && <Empty icon={Folder} text="Create a workspace to start." />}
            {active && log.length === 0 && <Empty icon={Brain} text="Describe what you want built. Ctrl + Enter to send." />}
            {log.map((item) => <LogRow key={item.id} item={item} />)}
            {running && <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working</div>}
            <div ref={logEnd} />
          </div>
          <div className="border-t border-border p-3">
            <div className="glass rounded-xl focus-within:ring-1 focus-within:ring-ring">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }}
                placeholder={mode === "plan" ? "Describe the change. The agent will propose a plan first." : "What should the agent build?"}
                className="min-h-[88px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0" disabled={!active} />
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="flex rounded-md border border-border p-0.5 text-xs">
                  {(["build", "plan"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={cn("rounded px-2 py-0.5 capitalize", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m}</button>
                  ))}
                </div>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Model" /></SelectTrigger>
                  <SelectContent>{models.map((m) => <SelectItem key={m.id} value={String(m.id)} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
                </Select>
                {running ? (
                  <Button size="sm" variant="destructive" className="ml-auto h-7" onClick={() => abortRef.current?.abort()}><Square className="h-3 w-3" /> Stop</Button>
                ) : (
                  <Button size="sm" className="ml-auto h-7" disabled={!prompt.trim() || !active} onClick={() => void run()}><Send className="h-3 w-3" /> Send</Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>New workspace</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="my-api" value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void createWorkspace()} />
          <DialogFooter><Button onClick={() => void createWorkspace()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof File; text: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5" />{text}
    </div>
  );
}

function CodeView({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <pre className="font-mono text-[12.5px] leading-6">
      {lines.map((l, i) => (
        <div key={i} className="flex hover:bg-accent/40">
          <span className="w-12 shrink-0 select-none pr-4 text-right text-muted-foreground/60">{i + 1}</span>
          <code className="whitespace-pre pr-6">{l || " "}</code>
        </div>
      ))}
    </pre>
  );
}

function LogRow({ item }: { item: LogItem }) {
  const [open, setOpen] = useState(false);
  const e = item.event;
  if (item.prompt) {
    return <div className="ml-8 rounded-xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">{item.prompt}</div>;
  }
  if (e.type === "status") return e.message ? <p className="px-1 font-mono text-[11px] text-muted-foreground">{e.message}</p> : null;
  if (e.type === "text") return e.text ? <div className="whitespace-pre-wrap px-1 text-sm leading-relaxed">{e.text}</div> : null;
  if (e.type === "thinking") return <div className="whitespace-pre-wrap border-l-2 border-border pl-3 text-xs italic text-muted-foreground">{e.text}</div>;
  if (e.type === "error") return <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"><XCircle className="h-4 w-4 shrink-0" />{e.message}</div>;
  if (e.type === "done") return <div className="flex items-center gap-2 px-1 font-mono text-[11px] text-success"><CheckCircle2 className="h-3.5 w-3.5" /> done{e.usage ? ` · ${e.usage.input + e.usage.output} tokens` : ""}</div>;
  if (e.type === "file_changed") return <p className="px-1 font-mono text-[11px] text-success">+ {e.path}</p>;
  if (e.type === "preview") return <p className="px-1 font-mono text-[11px] text-primary">preview → {e.url}</p>;
  if (e.type === "tool_call") {
    const summary = String(e.args['path'] ?? e.args['command'] ?? e.args['query'] ?? e.args['name'] ?? "");
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs"><span className="text-primary">{e.name}</span><span className="truncate text-muted-foreground">{summary}</span></div>;
  }
  if (e.type === "tool_result") {
    return (
      <div className={cn("rounded-lg border font-mono text-xs", e.ok ? "border-border" : "border-destructive/40")}>
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className={e.ok ? "text-success" : "text-destructive"}>{e.ok ? "ok" : "failed"}</span>
          <span className="truncate">{e.output.split("\n")[0]?.slice(0, 80)}</span>
        </button>
        {open && <pre className="max-h-72 overflow-auto border-t border-border px-3 py-2 whitespace-pre-wrap text-muted-foreground">{e.output}</pre>}
      </div>
    );
  }
  return null;
}

interface TreeNode { name: string; path: string; type: "file" | "dir"; children: TreeNode[] }

function buildTree(files: WorkspaceFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const p = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: p, type: i === parts.length - 1 ? f.type : "dir", children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => { n.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)); n.children.forEach(sort); };
  sort(root);
  return root;
}

function TreeView({ node, depth, onOpen, activePath }: { node: TreeNode; depth: number; onOpen: (p: string) => void; activePath?: string | undefined }) {
  return <>{node.children.map((c) => <TreeItem key={c.path} node={c} depth={depth} onOpen={onOpen} activePath={activePath} />)}</>;
}

function TreeItem({ node, depth, onOpen, activePath }: { node: TreeNode; depth: number; onOpen: (p: string) => void; activePath?: string | undefined }) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 12 };
  if (node.type === "dir") {
    return (
      <div>
        <button style={pad} onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 rounded py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          {open ? <FolderOpen className="h-3.5 w-3.5 text-primary" /> : <Folder className="h-3.5 w-3.5 text-primary" />}{node.name}
        </button>
        {open && <TreeView node={node} depth={depth + 1} onOpen={onOpen} activePath={activePath} />}
      </div>
    );
  }
  return (
    <button style={pad} onClick={() => onOpen(node.path)} className={cn("flex w-full items-center gap-1.5 rounded py-1 hover:bg-accent", activePath === node.path ? "bg-accent text-foreground" : "text-muted-foreground")}>
      <File className="h-3.5 w-3.5" />{node.name}
    </button>
  );
}
