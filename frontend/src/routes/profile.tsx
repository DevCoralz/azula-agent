import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/azula/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Azula Code" },
      { name: "description", content: "Your Azula Code profile and account security." },
      { property: "og:title", content: "Profile — Azula Code" },
      { property: "og:description", content: "Manage your profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: "", bio: "", avatar_url: "" });
  const [pw, setPw] = useState({ current: "", next: "" });

  useEffect(() => {
    if (user) setForm({ name: user.name, bio: user.bio ?? "", avatar_url: user.avatar_url ?? "" });
  }, [user]);

  async function save() {
    try {
      const d = await api<{ user: User }>("/api/users/me", { method: "PATCH", body: form });
      setUser(d.user); toast.success("Profile updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  }

  async function changePw() {
    if (pw.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    try {
      await api("/api/users/me/password", { method: "POST", body: pw });
      setPw({ current: "", next: "" }); toast.success("Password changed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not change password"); }
  }

  return (
    <AppShell title="Profile">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Plan", user?.plan ?? "-"], ["Credits", String(user?.credits ?? 0)], ["Member since", user ? new Date(user.created_at).toLocaleDateString() : "-"]].map(([k, v]) => (
            <div key={k} className="glass rounded-xl p-5">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1.5 text-xl font-semibold capitalize tracking-tight">{v}</p>
            </div>
          ))}
        </div>
        <Panel title="Details">
          <div className="grid gap-4">
            <div className="space-y-1.5"><Label>Name</Label><Input maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div className="space-y-1.5"><Label>Avatar URL</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Bio</Label><Textarea maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          </div>
          <Button className="mt-5" onClick={() => void save()}>Save changes</Button>
        </Panel>
        <Panel title="Password">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          </div>
          <Button className="mt-5" variant="outline" onClick={() => void changePw()}>Update password</Button>
        </Panel>
      </div>
    </AppShell>
  );
}
