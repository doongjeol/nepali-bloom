import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/" as const, label: "홈", icon: "🏠" },
  { to: "/lessons" as const, label: "레슨", icon: "📚" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🇳🇵</span>
          <span className="text-lg font-bold text-foreground">
            네팔어 학습
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to === "/lessons" && location.pathname.startsWith("/lessons"));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="mr-1.5 hidden sm:inline">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
