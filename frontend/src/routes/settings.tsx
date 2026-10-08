import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/azula/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, API_BASE } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "API keys & agent — Azula Code" },
      { name: "description", content: "Manage your model provider keys and agent connection." },
      { property: "og:title", content: "API keys & agent — Azula Code" },
      { property: "og:description", content: "Bring your own model key. Encrypted at rest." },
    ],
  }),
  component: SettingsPage,
});

interface KeyRow { id: number; provider: string; label: string; last4: string; base_url: string | null; created_at: string }

const providers = [
  { v: "openai", l: "OpenAI" },
  { v: "anthropic", l: "Anthropic" },
  { v: "google", l: "Google Gemini" },
  { v: "openrouter", l: "OpenRouter" },
  { v: "groq", l: "Groq" },
  { v: "deepseek", l: "DeepSeek" },
  { v: "custom", l: "Custom (OpenAI-compatible)" },
];

function SettingsPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [form, setForm] = useState({ provider: "openai", label: "", key: "", base_url: "" });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);

  const load = () => api<{ keys: KeyRow[] }>("/api/keys").then((d) => setKeys(d.keys)).catch(() => {});
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!form.key.trim()) return;
    setBusy(true);
    try {
      await api("/api/keys", { method: "POST", body: { ...form, base_url: form.base_url || null } });
      setForm({ provider: form.provider, label: "", key: "", base_url: "" });
      toast.success("Key saved");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save key"); }
    finally { setBusy(false); }
  }

  async function test(id: number) {
    setTesting(id);
    try {
      const r = await api<{ ok: boolean; message: string }>(`/api/keys/${id}/test`, { method: "POST" });
      if (r.ok) toast.success(r.message); else toast.error(r.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Test failed"); }
    finally { setTesting(null); }
  }

  async function remove(id: number) {
    await api(`/api/keys/${id}`, { method: "DELETE" }).catch(() => {});
    void load();
  }

  return (
    <AppShell title="API keys & agent" description="Azula is free. The agent runs on the model key you provide.">
      <div className="space-y-6">
        <Panel title="Add a provider key" description="Keys are encrypted with AES-256-GCM on the server and never sent back to the browser.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{providers.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input placeholder="Personal" maxLength={60} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>API key</Label>
              <Input type="password" className="font-mono" placeholder="sk-..." value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            </div>
            {form.provider === "custom" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Base URL</Label>
                <Input className="font-mono" placeholder="https://api.example.com/v1" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
              </div>
            )}
          </div>
          <Button className="mt-5" onClick={() => void add()} disabled={busy || !form.key}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Save key
          </Button>
        </Panel>

        <Panel title="Saved keys">
          {keys.length === 0 ? <p className="text-sm text-muted-foreground">No keys yet. Add one above to start running the agent.</p> : (
            <div className="divide-y divide-border">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{k.label || k.provider}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.provider} · ••••{k.last4}{k.base_url ? ` · ${k.base_url}` : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void test(k.id)} disabled={testing === k.id}>
                    {testing === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Test
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete key" onClick={() => void remove(k.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Agent backend" description="The server that runs your workspace. Set VITE_API_URL at build time to change it.">
          <p className="font-mono text-sm">{API_BASE}</p>
        </Panel>
      </div>
    </AppShell>
  );
}
