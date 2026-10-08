import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/azula/Logo";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({
  mode: z.enum(["signin", "register"]).optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Azula Code" },
      { name: "description", content: "Sign in or create a free Azula Code account." },
      { property: "og:title", content: "Sign in — Azula Code" },
      { property: "og:description", content: "Create a free account and bring your own API key." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "register">(search.mode ?? "signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", referral: search.ref ?? "" });
  const [busy, setBusy] = useState(false);
  const { signIn, register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) void navigate({ to: "/workspace" }); }, [user, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      if (mode === "signin") await signIn(form.email, form.password);
      else await register({ name: form.name, email: form.email, password: form.password, referral: form.referral || undefined });
      void navigate({ to: "/workspace" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-10 sm:justify-center sm:py-0">
      <Logo />
      <div className="mt-10 w-full max-w-sm animate-rise">
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Welcome back." : "Free. No card. Bring your own API key."}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="ref">Referral ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="ref" className="font-mono" placeholder="From an invite link" value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button className="text-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "signin" ? "register" : "signin")}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
