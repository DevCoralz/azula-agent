import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary/15 stroke-primary/50" strokeWidth="1" />
      <path d="M9 22 L16 9 L23 22" className="stroke-primary" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 17.5 H19.5" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">
        Azula<span className="text-muted-foreground font-normal"> Code</span>
      </span>
    </Link>
  );
}
