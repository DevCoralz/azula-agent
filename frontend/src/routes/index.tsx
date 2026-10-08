import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, FileCode2, KeyRound, MonitorPlay, ShieldCheck, Terminal, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/azula/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Azula Code — Autonomous coding agent, your API key" },
      { name: "description", content: "An isolated workspace where an AI agent reads, writes and runs code for you. Free. Bring your own model key." },
      { property: "og:title", content: "Azula Code — Autonomous coding agent" },
      { property: "og:description", content: "Isolated workspaces, real terminals, live preview. Free with your own API key." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Terminal, title: "Real terminal", body: "The agent runs commands in your own sandboxed workspace and streams every line back." },
  { icon: FileCode2, title: "Multi-file edits", body: "Reads the codebase, plans, then writes across files. You see every diff as it lands." },
  { icon: MonitorPlay, title: "Live preview", body: "Dev servers started by the agent are proxied straight into the preview pane." },
  { icon: Wrench, title: "Install tooling", body: "Package managers, linters, security scanners. Install what the job needs." },
  { icon: KeyRound, title: "Your key, your model", body: "OpenAI, Anthropic, Google, OpenRouter, or any OpenAI-compatible endpoint. Encrypted at rest." },
  { icon: ShieldCheck, title: "Guard rails", body: "A command policy blocks miners, abuse and anything that would harm shared infrastructure." },
];

const log = [
  ["think", "Reading package.json and src/ to understand the layout"],
  ["tool", "list_dir src/"],
  ["tool", "write_file src/routes/api/health.ts"],
  ["exec", "npm run test -- health"],
  ["ok", "3 passed in 1.2s"],
  ["done", "Added /api/health with uptime and version. Tests pass."],
] as const;

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-backdrop [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-24 pt-20 md:pt-28 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Free forever. Bring your own key.
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
              <span className="text-gradient">An agent that ships code,</span><br />not suggestions.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Describe the job. Azula plans it, edits the files, runs the commands and shows you the result in a live preview. All inside your own isolated workspace.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="glow-primary">
                <Link to="/auth" search={{ mode: "register" }}>Start building <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline"><Link to="/docs">How it works</Link></Button>
            </div>
          </div>

          <div className="glass-strong animate-rise rounded-2xl p-1.5 [animation-delay:120ms]">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-xs text-muted-foreground">agent · gpt-4.1 · 38ms</span>
              <span className="ml-auto rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">BUILD</span>
            </div>
            <div className="space-y-2.5 p-4 font-mono text-[12.5px]">
              {log.map(([k, t], i) => (
                <div key={i} className="flex gap-3 animate-rise" style={{ animationDelay: `${300 + i * 140}ms` }}>
                  <span className={
                    k === "ok" || k === "done" ? "w-12 shrink-0 text-success"
                      : k === "exec" ? "w-12 shrink-0 text-warning"
                      : k === "tool" ? "w-12 shrink-0 text-primary"
                      : "w-12 shrink-0 text-muted-foreground"}>{k}</span>
                  <span className={k === "done" ? "text-foreground" : "text-muted-foreground"}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight">Everything the agent needs to finish the job.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-background p-7">
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-5 font-medium tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-24 md:grid-cols-3">
          {[
            ["01", "Add your key", "Paste a key from your model provider. It is encrypted with AES-256 before it touches the database."],
            ["02", "Write the prompt", "Plan mode drafts the approach. Build mode executes it. Ctrl + Enter to send."],
            ["03", "Watch it run", "Tool calls, terminal output and file changes stream live. Stop it any time."],
          ].map(([n, t, b]) => (
            <div key={n}>
              <span className="font-mono text-sm text-primary">{n}</span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
