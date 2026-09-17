import React, { useState, useEffect } from "react";
import { Search, Sun, Moon, Bell } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { UniversalSearchModal } from "@/components/search/UniversalSearchModal";
import { useAlertStore } from "@/store/alertStore";

export const Topbar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);

  const criticalCount = useAlertStore((s) => s.getCriticalCount());
  const activeCount = useAlertStore((s) => s.getActiveCount());

  // Horloge
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Raccourci global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-14 px-6 bg-card border-b border-border flex items-center justify-between shrink-0 select-none">
        {/* Universal Search Bar — cliquable → ouvre le modal */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="relative w-80 max-w-sm h-8 pl-8 pr-3 flex items-center text-xs rounded-md bg-muted/40 border border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-text"
          aria-label="Ouvrir la recherche universelle"
        >
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <span className="flex-1 text-left truncate">Recherche universelle...</span>
          <kbd className="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground pointer-events-none">
            Ctrl+K
          </kbd>
        </button>

        {/* Right Controls: Clock + Theme Switch + Notifications */}
        <div className="flex items-center gap-3">
          {/* Horloge & Date minimaliste */}
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{dateStr}</span>
            <span className="text-border">•</span>
            <span className="font-mono font-medium text-foreground">{timeStr}</span>
          </div>

          <div className="h-4 w-[1px] bg-border hidden md:block" />

          {/* Bouton Thème Clair/Sombre */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            className="w-8 h-8 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title={`Activer le mode ${theme === "dark" ? "clair" : "sombre"}`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-foreground" />
            )}
          </button>

          {/* Bouton Notification avec badge */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative w-8 h-8 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title={`${activeCount} alerte${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""}`}
          >
            <Bell className="w-4 h-4" />
            {activeCount > 0 && (
              <span
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  criticalCount > 0 ? "bg-red-500" : "bg-primary"
                }`}
              />
            )}
          </button>
        </div>
      </header>

      {/* Modal Recherche Universelle */}
      <UniversalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
