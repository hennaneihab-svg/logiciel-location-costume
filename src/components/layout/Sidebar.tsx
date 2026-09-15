/**
 * Sidebar de navigation principale — Atelier Prestige
 * Gestion dynamique des rôles (Admin vs Vendeur) & Badges d'alertes
 */

import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Shirt,
  Users,
  CalendarDays,
  CreditCard,
  FileBarChart,
  BellRing,
  Settings,
  Sparkles,
  ChevronRight,
  Lock,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";

export const Sidebar: React.FC = () => {
  const activeCount = useAlertStore((s) => s.getActiveCount());
  const criticalCount = useAlertStore((s) => s.getCriticalCount());

  const { currentUser, switchUserRole } = useAuthStore();
  const isAdmin = currentUser?.role === "admin";

  const NAV_ITEMS = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Stock", path: "/stock", icon: Shirt },
    { name: "Clients", path: "/clients", icon: Users },
    { name: "Locations", path: "/locations", icon: CalendarDays },
    { name: "Caisse", path: "/caisse", icon: CreditCard },
    { name: "Rapports", path: "/rapports", icon: FileBarChart },
    {
      name: "Alertes",
      path: "/alertes",
      icon: BellRing,
      badge: activeCount > 0 ? String(activeCount) : undefined,
      badgeColor: criticalCount > 0
        ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
        : "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    },
    {
      name: "Paramètres",
      path: "/parametres",
      icon: Settings,
      isRestricted: !isAdmin,
      badge: !isAdmin ? "Admin" : undefined,
      badgeColor: "bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[9px]",
    },
  ];

  return (
    <aside className="w-64 h-screen bg-card border-r border-border flex flex-col select-none shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight text-sm text-foreground">
              ATELIER PRESTIGE
            </h1>
            <p className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">
              Costumes &amp; Cérémonie
            </p>
          </div>
        </div>
      </div>

      {/* Navigation list */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Navigation Principale
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.isRestricted && "opacity-80"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "w-4 h-4 transition-transform duration-150 group-hover:scale-110",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.isRestricted && (
                    <span title="Accès réservé aux administrateurs">
                      <Lock className="w-3 h-3 text-amber-500" />
                    </span>
                  )}
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        item.badgeColor ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-primary opacity-80" />
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer / Session & Changement de rôle */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0",
                isAdmin
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-blue-500/20 border-blue-500/40 text-blue-500"
              )}
            >
              {currentUser?.full_name ? currentUser.full_name.slice(0, 2).toUpperCase() : "AP"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {currentUser?.full_name || "Non connecté"}
              </p>
              <span
                className={cn(
                  "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-sm inline-block",
                  isAdmin
                    ? "bg-primary/15 text-primary"
                    : "bg-blue-500/15 text-blue-500"
                )}
              >
                {isAdmin ? "Admin" : "Vendeur"}
              </span>
            </div>
          </div>

          {/* Switch rôle rapide pour test & déconnexion */}
          <button
            type="button"
            onClick={() => switchUserRole(isAdmin ? "vendeur" : "admin")}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Basculer vers le rôle ${isAdmin ? "Vendeur" : "Admin"}`}
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
