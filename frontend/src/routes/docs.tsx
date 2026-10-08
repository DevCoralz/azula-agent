import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/azula/SiteHeader";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Azula Code" },
      { name: "description", content: "How Azula Code works: workspaces, agent tools, API keys and self-hosting the backend." },
      { property: "og:title", content: "Docs — Azula Code" },
      { property: "og:description", content: "Workspaces, agent tools, keys and self-hosting." },
    ],
  }),
  component: DocsPage,
});

const sections = [
  {
    h: "How it works",
    p: "You write a prompt. The agent loads your workspace context, decides which tools it needs, and runs them one at a time. Every tool call and its output is streamed to the run log over Server-Sent Events, so long builds never time out silently.",
  },
  {
    h: "Bring your own key",
    p: "Azula does not resell model access. Add a key from OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek or any OpenAI-compatible endpoint. Keys are encrypted with AES-256-GCM before storage and are only decrypted in memory for the duration of a run.",
  },
  {
    h: "Isolated workspaces",
    p: "Each workspace is a directory owned by your account. Every file path the agent touches is resolved and checked against that root, so a tool can never read or write outside it. Disk and process limits are enforced per plan.",
  },
  {
    h: "Agent tools",
    p: "read_file, write_file, delete_file, list_dir, search_files, exec_cmd, install_tool, start_preview, stop_preview. Commands run in the workspace with a timeout and captured stdout/stderr.",
  },
  {
    h: "What is not allowed",
    p: "A policy engine inspects every command before it runs. Crypto mining and wallet tooling, stress/DDoS tooling, mass scanning of third parties, fork bombs, and writes outside the workspace are refused. Security tooling is available for work against targets you own or are authorised to test.",
  },
  {
    h: "Self-hosting the backend",
    p: "The Node.js backend ships in backend/. Copy .env.example to .env, point DATABASE_URL at MySQL, run the schema in src/db/schema.sql, then npm run build && npm start. It runs on Pterodactyl, Docker or any VPS. The frontend reads VITE_API_URL at build time.",
  },
];

function DocsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-medium tracking-tight">{s.h}</h2>
              <p className="mt-2.5 leading-relaxed text-muted-foreground">{s.p}</p>
            </section>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
