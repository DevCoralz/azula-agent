import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/azula/SiteHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Acceptable use — Azula Code" },
      { name: "description", content: "What you may and may not run on Azula Code workspaces." },
      { property: "og:title", content: "Acceptable use — Azula Code" },
      { property: "og:description", content: "Workspace rules and prohibited workloads." },
    ],
  }),
  component: TermsPage,
});

const rules = [
  "No cryptocurrency mining, staking agents, wallet drainers or chain nodes of any kind.",
  "No stress testing, denial-of-service tooling, botnets, proxies or traffic relays.",
  "No scanning, brute forcing or exploiting systems you do not own or have written authorisation to test.",
  "No mass email, SMS or spam infrastructure.",
  "No attempts to escape the workspace sandbox, escalate privileges or reach other tenants.",
  "Security and penetration tooling is permitted for authorised assessments and local targets.",
  "Workspaces are not durable storage. Keep anything you care about in your own git remote.",
];

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Acceptable use</h1>
        <p className="mt-4 text-muted-foreground">
          Azula Code is free and shared. These rules keep it running for everyone. Breaking them suspends the account and terminates running processes immediately.
        </p>
        <ul className="mt-10 space-y-4">
          {rules.map((r) => (
            <li key={r} className="glass rounded-xl p-4 text-sm leading-relaxed text-muted-foreground">{r}</li>
          ))}
        </ul>
      </div>
      <SiteFooter />
    </div>
  );
}
