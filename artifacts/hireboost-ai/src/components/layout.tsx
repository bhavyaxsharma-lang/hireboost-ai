import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { useLogoutUser } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import { LayoutDashboard, FileText, Video, History, LogOut, Menu, UserCircle, Linkedin, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useTheme } from "./theme-provider";
import { Moon, Sun } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
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

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/resume", label: "Analyzer", icon: FileText },
    { href: "/interview", label: "Interview", icon: Video },
    { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
    { href: "/salary", label: "Salary", icon: TrendingUp },
    { href: "/history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          <div className="flex flex-1 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-xl tracking-tight text-primary">HireBoost</span>
              <span className="font-bold text-xl tracking-tight">AI</span>
            </Link>

            <div className="flex items-center space-x-2 md:space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>

              {isAuthenticated ? (
                <>
                  <div className="hidden md:flex items-center space-x-4">
                    <nav className="flex items-center space-x-5 text-sm font-medium">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                    <div className="flex items-center gap-2 border-l pl-4 border-border/40">
                      <span className="text-sm font-medium">{user?.name}</span>
                      <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
                        <LogOut className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                      <nav className="flex flex-col gap-4 mt-8">
                        <div className="flex items-center gap-2 mb-4">
                          <UserCircle className="h-8 w-8 text-primary" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{user?.name}</span>
                            <span className="text-xs text-muted-foreground">{user?.email}</span>
                          </div>
                        </div>
                        {navItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2 px-2 py-2 text-sm font-medium rounded-md hover:bg-accent"
                          >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                          </Link>
                        ))}
                        <Button
                          variant="ghost"
                          className="justify-start px-2 mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={handleLogout}
                        >
                          <LogOut className="h-5 w-5 mr-2" />
                          Log out
                        </Button>
                      </nav>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link href="/auth">
                    <Button variant="default" size="sm">
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
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
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
