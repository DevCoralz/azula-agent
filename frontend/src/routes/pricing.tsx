import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/azula/SiteHeader";
import { api, type PlanRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans — Azula Code" },
      { name: "description", content: "Azula Code is free with your own API key. Optional plans add more workspace capacity." },
      { property: "og:title", content: "Plans — Azula Code" },
      { property: "og:description", content: "Free with your own key. Upgrade only for more capacity." },
    ],
  }),
  component: PricingPage,
});

const fallback: PlanRecord[] = [
  { id: 1, slug: "free", name: "Free", price_cents: 0, currency: "USD", interval: "month", highlighted: false, enabled: true,
    features: ["Bring your own API key", "3 workspaces", "1 GB disk per workspace", "Live preview", "Community support"] },
  { id: 2, slug: "pro", name: "Pro", price_cents: 900, currency: "USD", interval: "month", highlighted: true, enabled: true,
    features: ["Everything in Free", "25 workspaces", "10 GB disk per workspace", "Longer command timeouts", "Priority queue"] },
  { id: 3, slug: "team", name: "Team", price_cents: 2900, currency: "USD", interval: "month", highlighted: false, enabled: true,
    features: ["Everything in Pro", "Unlimited workspaces", "Shared workspaces", "Admin audit log", "Email support"] },
];

function PricingPage() {
  const [plans, setPlans] = useState<PlanRecord[]>(fallback);
  useEffect(() => { api<{ plans: PlanRecord[] }>("/api/plans").then((d) => d.plans.length && setPlans(d.plans)).catch(() => {}); }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Free. Seriously.</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">You pay your model provider directly. Plans only exist for people who need more workspaces or disk.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.filter((p) => p.enabled).map((p) => (
            <div key={p.id} className={cn("glass flex flex-col rounded-2xl p-7", p.highlighted && "glow-primary")}>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight">
                {p.price_cents === 0 ? "$0" : `$${(p.price_cents / 100).toFixed(0)}`}
                <span className="text-sm font-normal text-muted-foreground"> /{p.interval}</span>
              </p>
              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2.5 text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}
              </ul>
              <Button asChild className="mt-8" variant={p.highlighted ? "default" : "outline"}>
                <Link to="/auth" search={{ mode: "register" }}>{p.price_cents === 0 ? "Start free" : `Choose ${p.name}`}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
