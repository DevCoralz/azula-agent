import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/azula/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — Azula Code" },
      { name: "description", content: "Invite developers to Azula Code and earn workspace credits." },
      { property: "og:title", content: "Referrals — Azula Code" },
      { property: "og:description", content: "Invite friends, earn credits." },
    ],
  }),
  component: ReferralsPage,
});

interface RefData {
  code: string; reward_per_signup: number; total_earned: number;
  referred: { name: string; created_at: string; rewarded: boolean }[];
}

function ReferralsPage() {
  const [data, setData] = useState<RefData | null>(null);
  useEffect(() => { api<RefData>("/api/referrals").then(setData).catch(() => {}); }, []);
  const link = data && typeof window !== "undefined" ? `${window.location.origin}/auth?mode=register&ref=${data.code}` : "";

  return (
    <AppShell title="Referrals" description="Every developer who signs up with your link earns you credits for longer runs and more workspaces.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Invited", String(data?.referred.length ?? 0)], ["Credits earned", String(data?.total_earned ?? 0)], ["Per signup", String(data?.reward_per_signup ?? 0)]].map(([k, v]) => (
            <div key={k} className="glass rounded-xl p-5"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1.5 text-2xl font-semibold tracking-tight">{v}</p></div>
          ))}
        </div>
        <Panel title="Your invite link">
          <div className="flex gap-2">
            <Input readOnly value={link} className="font-mono text-xs" />
            <Button onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="h-4 w-4" /> Copy</Button>
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">code: {data?.code}</p>
        </Panel>
        <Panel title="People you invited">
          {!data?.referred.length ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Gift className="h-4 w-4" /> No signups yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {data.referred.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-3 text-sm">
                  <span>{r.name}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.rewarded ? "rewarded" : "pending"}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
