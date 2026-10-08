import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Code2, Gift, KeyRound, LogOut, Shield, User as UserIcon, CreditCard, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/workspace", label: "Workspace", icon: Code2 },
  { to: "/settings", label: "API keys & agent", icon: KeyRound },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/referrals", label: "Referrals", icon: Gift },
  { to: "/pricing", label: "Plans", icon: CreditCard },
] as const;

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) void navigate({ to: "/auth" });
    else if (admin && user.role !== "admin") void navigate({ to: "/workspace" });
  }, [user, loading, admin, navigate]);

  if (loading || !user || (admin && user.role !== "admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ title, description, children, actions }: {
  title: string; description?: string; children: ReactNode; actions?: ReactNode;
}) {
  const { user, signOut } = useAuth();
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          <div className="flex h-14 items-center px-5 border-b border-border"><Logo /></div>
          <nav className="flex-1 space-y-0.5 p-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                activeProps={{ className: "bg-accent text-foreground" }}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link to="/admin"
                className="mt-3 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}>
                <Shield className="h-4 w-4" />Admin console
              </Link>
            )}
          </nav>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                {user?.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <button onClick={signOut} aria-label="Sign out" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <MobileNav />
          <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions}
            </div>
            {children}
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}

function MobileNav() {
  const { user } = useAuth();
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
      {[...nav, ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin", icon: Shield }] as const : [])].map((n) => (
        <Link key={n.to} to={n.to}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground")}
          activeProps={{ className: "bg-accent text-foreground" }}>
          <n.icon className="h-3.5 w-3.5" />{n.label}
        </Link>
      ))}
    </div>
  );
}

export function Panel({ title, description, children, className }: {
  title?: string; description?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn("glass rounded-xl p-5 md:p-6", className)}>
      {title && (
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
