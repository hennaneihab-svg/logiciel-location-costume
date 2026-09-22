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
  ChevronRight,
  Lock,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { usePressingStore } from "@/store/pressingStore";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  isRestricted?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const activeCount = useAlertStore((s) => s.getActiveCount());
  const criticalCount = useAlertStore((s) => s.getCriticalCount());
  const isPressingActive = usePressingStore((s) => s.isModuleActive);

  const { currentUser, switchUserRole } = useAuthStore();
  const isAdmin = currentUser?.role === "admin";

  const exploitationItems: NavItem[] = [
    { name: "Tableau de bord", path: "/", icon: LayoutDashboard },
    { name: "Inventaire & Stock", path: "/stock", icon: Shirt },
    { name: "Répertoire Clients", path: "/clients", icon: Users },
    { name: "Contrats & Locations", path: "/locations", icon: CalendarDays },
    { name: "Caisse & Vente", path: "/caisse", icon: CreditCard },
  ];

  if (isPressingActive) {
    exploitationItems.push({
      name: "Pressing & Atelier",
      path: "/pressing",
      icon: Sparkles,
    });
  }

  const NAV_SECTIONS: NavSection[] = [
    {
      title: "Exploitation",
      items: exploitationItems,
    },
    {
      title: "Pilotage & Contrôle",
      items: [
        {
          name: "Centre d'alertes",
          path: "/alertes",
          icon: BellRing,
          badge: activeCount > 0 ? String(activeCount) : undefined,
          badgeColor: criticalCount > 0
            ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
            : "bg-muted text-foreground border border-border",
        },
        { name: "Rapports & Exports", path: "/rapports", icon: FileBarChart },
        {
          name: "Configuration",
          path: "/parametres",
          icon: Settings,
          isRestricted: !isAdmin,
          badge: !isAdmin ? "Admin" : undefined,
          badgeColor: "bg-muted text-muted-foreground border border-border text-[9px]",
        },
      ],
    },
  ];

  return (
    <aside className="w-64 h-screen bg-card border-r border-border flex flex-col select-none shrink-0">
      {/* Brand Header */}
      <div className="h-14 px-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center font-bold text-xs tracking-wider">
            AP
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-xs text-foreground uppercase">
              Atelier Prestige
            </span>
            <span className="text-[10px] text-muted-foreground">
              Costumes &amp; Cérémonie
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    item.isRestricted && "opacity-80"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-opacity",
                          isActive ? "opacity-100 text-foreground" : "opacity-60 group-hover:opacity-100"
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.isRestricted && (
                        <span title="Accès réservé aux administrateurs">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </span>
                      )}
                      {item.badge && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            item.badgeColor ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Footer / Session & Changement de rôle */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-background/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "w-7 h-7 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0",
                isAdmin
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-muted border-border text-foreground"
              )}
            >
              {currentUser?.full_name ? currentUser.full_name.slice(0, 2).toUpperCase() : "AP"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {currentUser?.full_name || "Non connecté"}
              </p>
              <span className="text-[10px] text-muted-foreground block truncate">
                {isAdmin ? "Administrateur" : "Vendeur"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => switchUserRole(isAdmin ? "vendeur" : "admin")}
            className="p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={`Basculer vers le rôle ${isAdmin ? "Vendeur" : "Admin"}`}
            aria-label="Basculer le rôle"
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
