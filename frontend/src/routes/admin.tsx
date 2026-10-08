import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/azula/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ModelRecord, type PlanRecord, type User } from "@/lib/api";
import { RequireAuth } from "@/components/azula/AppShell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Azula Code" },
      { name: "description", content: "Manage users, models, plans and site settings." },
      { property: "og:title", content: "Admin console — Azula Code" },
      { property: "og:description", content: "Platform administration." },
    ],
  }),
  component: () => <RequireAuth admin><AdminPage /></RequireAuth>,
});

function AdminPage() {
  return (
    <AppShell title="Admin console" description="Users, models, pricing and site configuration.">
      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="plans">Pricing</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="models"><ModelsTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="site"><SiteTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

interface AdminUser extends User { suspended: boolean; workspaces: number }

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const load = () => api<{ users: AdminUser[] }>("/api/admin/users").then((d) => setUsers(d.users)).catch(() => setUsers([]));
  useEffect(() => { void load(); }, []);

  async function patch(id: number, body: Record<string, unknown>) {
    try { await api(`/api/admin/users/${id}`, { method: "PATCH", body }); toast.success("User updated"); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  }

  const shown = (users ?? []).filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel title="Users" description="Change roles, plans or suspend accounts.">
      <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      {!users ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
        <div className="divide-y divide-border">
          {shown.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name} {u.suspended && <span className="ml-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">suspended</span>}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{u.email} · {u.workspaces} workspaces · {u.credits} credits</p>
              </div>
              <Select value={u.role} onValueChange={(v) => void patch(u.id, { role: v })}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="user">user</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent>
              </Select>
              <Button size="sm" variant={u.suspended ? "outline" : "destructive"} onClick={() => void patch(u.id, { suspended: !u.suspended })}>
                {u.suspended ? "Restore" : "Suspend"}
              </Button>
            </div>
          ))}
          {shown.length === 0 && <p className="py-3 text-sm text-muted-foreground">No users match.</p>}
        </div>
      )}
    </Panel>
  );
}

function ModelsTab() {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [form, setForm] = useState({ provider: "openai", model_id: "", label: "", context_window: 128000 });
  const load = () => api<{ models: ModelRecord[] }>("/api/admin/models").then((d) => setModels(d.models)).catch(() => {});
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!form.model_id.trim()) return;
    try { await api("/api/admin/models", { method: "POST", body: form }); setForm({ ...form, model_id: "", label: "" }); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not add model"); }
  }

  return (
    <div className="space-y-6">
      <Panel title="Add a model" description="Models users can select in the workspace. They run on the user's own key.">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5"><Label>Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["openai", "anthropic", "google", "openrouter", "groq", "deepseek", "custom"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Model id</Label><Input value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} className="font-mono" placeholder="gpt-4.1" /></div>
          <div className="space-y-1.5"><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="GPT-4.1" /></div>
          <div className="space-y-1.5"><Label>Context</Label><Input type="number" value={form.context_window} onChange={(e) => setForm({ ...form, context_window: Number(e.target.value) })} /></div>
        </div>
        <Button className="mt-5" onClick={() => void add()}><Plus className="h-4 w-4" /> Add model</Button>
      </Panel>
      <Panel title="Model registry">
        <div className="divide-y divide-border">
          {models.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{m.provider} · {m.model_id} · {m.context_window.toLocaleString()} ctx</p>
              </div>
              <Switch checked={m.enabled} onCheckedChange={(v) => { void api(`/api/admin/models/${m.id}`, { method: "PATCH", body: { enabled: v } }).then(load); }} />
              <Button size="icon" variant="ghost" aria-label="Delete model" onClick={() => { void api(`/api/admin/models/${m.id}`, { method: "DELETE" }).then(load); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {models.length === 0 && <p className="py-3 text-sm text-muted-foreground">No models yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const load = () => api<{ plans: PlanRecord[] }>("/api/admin/plans").then((d) => setPlans(d.plans)).catch(() => {});
  useEffect(() => { void load(); }, []);

  async function save(p: PlanRecord) {
    try { await api(`/api/admin/plans/${p.id}`, { method: "PATCH", body: p }); toast.success(`${p.name} saved`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save plan"); }
  }

  return (
    <div className="space-y-6">
      {plans.map((p, i) => (
        <Panel key={p.id} title={p.name}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={p.name} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
            <div className="space-y-1.5"><Label>Price (cents)</Label><Input type="number" value={p.price_cents} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, price_cents: Number(e.target.value) } : x))} /></div>
            <div className="space-y-1.5"><Label>Interval</Label><Input value={p.interval} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, interval: e.target.value } : x))} /></div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label>Features (one per line)</Label>
            <Textarea rows={5} value={p.features.join("\n")} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, features: e.target.value.split("\n") } : x))} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={p.enabled} onCheckedChange={(v) => setPlans(plans.map((x, j) => j === i ? { ...x, enabled: v } : x))} /> Visible</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={p.highlighted} onCheckedChange={(v) => setPlans(plans.map((x, j) => j === i ? { ...x, highlighted: v } : x))} /> Highlighted</label>
            <Button size="sm" className="ml-auto" onClick={() => void save(p)}><Save className="h-4 w-4" /> Save</Button>
          </div>
        </Panel>
      ))}
      {plans.length === 0 && <Panel><p className="text-sm text-muted-foreground">No plans configured.</p></Panel>}
    </div>
  );
}

function SiteTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  useEffect(() => { api<{ settings: Record<string, string> }>("/api/admin/settings").then((d) => setSettings(d.settings)).catch(() => {}); }, []);

  const fields: [string, string, string][] = [
    ["site_name", "Site name", "Azula Code"],
    ["tagline", "Tagline", "An agent that ships code"],
    ["support_email", "Support email", "support@example.com"],
    ["referral_reward", "Referral reward (credits)", "50"],
    ["max_workspaces_free", "Max workspaces (free plan)", "3"],
    ["exec_timeout_seconds", "Command timeout (seconds)", "180"],
    ["registrations_open", "Registrations open (true/false)", "true"],
    ["announcement", "Announcement banner", ""],
  ];

  async function save() {
    try { await api("/api/admin/settings", { method: "PUT", body: { settings } }); toast.success("Settings saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save settings"); }
  }

  return (
    <Panel title="Site settings" description="Applies platform-wide, immediately.">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([k, label, ph]) => (
          <div key={k} className="space-y-1.5">
            <Label>{label}</Label>
            <Input placeholder={ph} value={settings[k] ?? ""} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <Button className="mt-5" onClick={() => void save()}><Save className="h-4 w-4" /> Save settings</Button>
    </Panel>
  );
}
