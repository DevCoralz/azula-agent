import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/azula/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Azula Code" },
      { name: "description", content: "Autonomous coding agent workspace. Bring your own API key." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Azula Code" },
      { property: "og:description", content: "Autonomous coding agent workspace. Bring your own API key." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-5">
        <div className="animate-rise py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
            <span className="text-gradient">Azula Code</span>
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">
            Free. Bring your own API key.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="glow-primary">
              <Link to="/auth" search={{ mode: "register" }}>Get started <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in</Link></Button>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            What it does and how it works — <Link to="/docs" className="underline-offset-4 hover:underline">see the docs</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
