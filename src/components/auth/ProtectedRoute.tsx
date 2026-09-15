import React from "react";
import { useAuthStore } from "@/store/authStore";
import { ShieldAlert, ArrowLeft, KeyRound } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, currentUser, switchUserRole } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && currentUser.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-md">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-lg font-bold text-foreground">
            Accès Réservé aux Administrateurs
          </h3>
          <p className="text-xs text-muted-foreground">
            Votre profil actuel (<strong>{currentUser.full_name}</strong> • Rôle Vendeur)
            ne dispose pas des autorisations nécessaires pour accéder aux Paramètres système,
            à la configuration de l'établissement ou aux sauvegardes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-xl border border-border bg-secondary text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au Tableau de Bord</span>
          </button>

          <button
            type="button"
            onClick={() => switchUserRole("admin")}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md"
          >
            <KeyRound className="w-4 h-4" />
            <span>Passer en Mode Administrateur</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
