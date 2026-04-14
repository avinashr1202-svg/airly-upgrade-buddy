import { Plane, Zap, BookOpen, Activity, Settings, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CustomRulesPanel } from "@/components/CustomRulesPanel";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Migration", icon: null },
    { to: "/dags", label: "DAGs", icon: Activity },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border gradient-surface">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              AirflowMigrator
              <span className="text-[10px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded">AI</span>
            </h1>
            <p className="text-[10px] md:text-[11px] text-muted-foreground hidden sm:block">Airflow 2.x → 3.x Migration Utility</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                location.pathname === link.to
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {link.icon && <link.icon className="w-3.5 h-3.5" />}
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 hidden sm:flex hover:border-primary/50 transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Migration Rules</span>
              <span className="lg:hidden">Rules</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[320px] sm:w-[400px] md:w-[440px] p-0">
            <CustomRulesPanel />
          </SheetContent>
        </Sheet>

        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>Powered by AI</span>
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-14 left-0 right-0 z-50 bg-card border-b border-border p-3 md:hidden animate-slide-up">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  location.pathname === link.to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.icon && <link.icon className="w-4 h-4" />}
                {link.label}
              </Link>
            ))}
            <Sheet>
              <SheetTrigger asChild>
                <button className="px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 flex items-center gap-2 text-left">
                  <BookOpen className="w-4 h-4" />
                  Migration Rules
                </button>
              </SheetTrigger>
              <SheetContent className="w-[320px] p-0">
                <CustomRulesPanel />
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      )}
    </header>
  );
}
