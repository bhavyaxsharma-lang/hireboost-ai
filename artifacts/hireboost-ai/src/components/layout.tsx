import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { useLogoutUser } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import {
  LayoutDashboard, FileText, Video, History, LogOut,
  Menu, UserCircle, Linkedin, TrendingUp, ClipboardList,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useTheme } from "./theme-provider";
import { Moon, Sun } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resume", label: "Analyzer", icon: FileText },
  { href: "/interview", label: "Interview", icon: Video },
  { href: "/jd-prep", label: "JD Prep", icon: ClipboardList },
  { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/salary", label: "Salary", icon: TrendingUp },
  { href: "/history", label: "History", icon: History },
];

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();
  const logout = useLogoutUser();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
        window.location.reload();
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          <div className="flex flex-1 items-center justify-between gap-4">
            {/* Brand */}
            <Link href="/" className="flex items-center space-x-1.5 shrink-0">
              <span className="font-extrabold text-xl tracking-tight text-primary">HireBoost</span>
              <span className="font-extrabold text-xl tracking-tight text-foreground">AI</span>
            </Link>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="shrink-0"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>

              {isAuthenticated ? (
                <>
                  {/* Desktop nav */}
                  <div className="hidden md:flex items-center gap-1">
                    <nav className="flex items-center">
                      {navItems.map((item) => {
                        const active = location === item.href || location.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              active
                                ? "text-foreground bg-accent"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            }`}
                          >
                            {item.label}
                            {active && (
                              <span className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-primary" />
                            )}
                          </Link>
                        );
                      })}
                    </nav>

                    <div className="flex items-center gap-1 border-l ml-2 pl-3 border-border/50">
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {user?.name?.[0]?.toUpperCase() ?? "U"}
                        </div>
                        <span className="text-sm font-medium max-w-[80px] truncate">{user?.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" className="h-8 w-8">
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile hamburger */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[260px] sm:w-[300px] p-0">
                      <div className="flex flex-col h-full">
                        {/* User header */}
                        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/50 bg-muted/30">
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                            {user?.name?.[0]?.toUpperCase() ?? "U"}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold truncate">{user?.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                          </div>
                        </div>

                        {/* Nav links */}
                        <nav className="flex flex-col gap-1 p-3 flex-1">
                          {navItems.map((item) => {
                            const active = location === item.href || location.startsWith(item.href + "/");
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-accent"
                                }`}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </nav>

                        {/* Logout */}
                        <div className="p-3 border-t border-border/50">
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleLogout}
                          >
                            <LogOut className="h-4 w-4 shrink-0" />
                            Log out
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth">
                    <Button variant="default" size="sm" className="font-semibold shadow-md shadow-primary/20">
                      Log In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border/40 bg-background/80 py-4 px-6">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-center gap-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" className="text-primary" opacity="0.9" />
              <path d="M2 17l10 5 10-5" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <path d="M2 12l10 5 10-5" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">
            Invented by{" "}
            <span className="font-semibold text-foreground">Bhavya AI Solution</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
