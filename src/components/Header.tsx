import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/" as const, label: "홈", icon: "🏠" },
  { to: "/feed" as const, label: "피드", icon: "📷" },
  { to: "/lessons" as const, label: "레슨", icon: "📚" },
];

export function Header() {
  const location = useLocation();

  return (
    <>
      {/* Top header - minimal on mobile */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🇳🇵</span>
            <span className="text-base font-bold text-foreground">
              네팔어 학습
            </span>
          </Link>
          {/* Desktop nav only */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.to ||
                (item.to === "/lessons" && location.pathname.startsWith("/lessons")) ||
                (item.to === "/feed" && location.pathname.startsWith("/feed"));
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
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom tab bar - mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md sm:hidden safe-bottom">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to === "/lessons" && location.pathname.startsWith("/lessons")) ||
              (item.to === "/feed" && location.pathname.startsWith("/feed"));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
