import { useState } from "react";
import { Plane, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CustomRulesPanel } from "@/components/CustomRulesPanel";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border gradient-surface">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
          <Plane className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            AirflowMigrator
            <span className="text-[10px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded">AI</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">Airflow 2.x → 3.x Migration Utility</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Migration Rules
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[440px] p-0">
            <CustomRulesPanel />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>Powered by AI</span>
        </div>
      </div>
    </header>
  );
}
