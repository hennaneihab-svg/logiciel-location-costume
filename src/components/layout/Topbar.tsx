import React, { useState, useEffect } from "react";
import { Search, Sun, Moon, Bell, Clock } from "lucide-react";
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
      <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0 select-none">
        {/* Universal Search Bar — cliquable → ouvre le modal */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="relative w-96 max-w-md h-9 pl-9 pr-4 flex items-center text-xs rounded-lg bg-secondary/60 border border-border/80 text-muted-foreground/70 hover:border-primary/40 hover:bg-secondary transition-all cursor-text"
          aria-label="Ouvrir la recherche universelle"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <span className="flex-1 text-left">Recherche universelle (client, costume, contrat)...</span>
          <kbd className="hidden sm:inline-flex text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground pointer-events-none">
            Ctrl + K
          </kbd>
        </button>

        {/* Right Controls: Clock + Theme Switch + Notifications */}
        <div className="flex items-center gap-4">
          {/* Horloge & Date en direct */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/60 text-xs">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="capitalize text-muted-foreground">{dateStr}</span>
            <span className="font-semibold text-foreground font-mono">{timeStr}</span>
          </div>

          {/* Bouton Thème Clair/Sombre */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            className="p-2 rounded-lg bg-secondary/60 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Activer le mode ${theme === "dark" ? "clair" : "sombre"}`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 hover:-rotate-12 transition-transform duration-200" />
            )}
          </button>

          {/* Bouton Notification avec badge */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative p-2 rounded-lg bg-secondary/60 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`${activeCount} alerte${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""}`}
          >
            <Bell className="w-4 h-4" />
            {activeCount > 0 && (
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-card ${
                  criticalCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"
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
