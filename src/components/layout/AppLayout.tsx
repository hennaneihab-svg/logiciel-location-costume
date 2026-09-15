import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuthStore } from "@/store/authStore";

export const AppLayout: React.FC = () => {
  const touchActivity = useAuthStore((s) => s.touchActivity);

  useEffect(() => {
    const handleActivity = () => {
      touchActivity();
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    // Vérification périodique toutes les 30 secondes
    const interval = setInterval(() => {
      touchActivity();
    }, 30000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      clearInterval(interval);
    };
  }, [touchActivity]);
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar latérale */}
      <Sidebar />

      {/* Conteneur principal */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Barre supérieure avec recherche & horloge */}
        <Topbar />

        {/* Zone de contenu des pages avec scrollbar indépendante */}
        <main className="flex-1 overflow-y-auto p-6 bg-secondary/20">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
