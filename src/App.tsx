import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { StockPage } from "./pages/StockPage";
import { ClientsPage } from "./pages/ClientsPage";
import { LocationsPage } from "./pages/LocationsPage";
import { CaissePage } from "./pages/CaissePage";
import { RapportsPage } from "./pages/RapportsPage";
import { AlertesPage } from "./pages/AlertesPage";
import { ParametresPage } from "./pages/ParametresPage";
import { LoginPage } from "./pages/LoginPage";
import { PressingPage } from "./components/pressing/PressingPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { useAlertEngine } from "./hooks/useAlertEngine";
import { useAppInit } from "./hooks/useAppInit";
import { AlertTriangle, RefreshCw } from "lucide-react";

export const App: React.FC = () => {
  const { status, error, retry } = useAppInit();

  // Lance le moteur d'alertes au démarrage et toutes les heures
  useAlertEngine();

  if (status === "initializing") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 select-none">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm font-semibold tracking-wider uppercase text-foreground">
          Atelier Prestige
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Initialisation de la base de données locale...
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 select-none">
        <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="text-sm font-semibold text-destructive">
          Erreur de connexion SQLite
        </div>
        <div className="text-xs text-muted-foreground mt-1 max-w-md text-center">
          {error || "Impossible d'initialiser les tables et données locales."}
        </div>
        <button
          onClick={retry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Réessayer</span>
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Route Publique Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Routes Protégées Authentification */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="caisse" element={<CaissePage />} />
          <Route path="pressing" element={<PressingPage />} />
          <Route path="rapports" element={<RapportsPage />} />
          <Route path="alertes" element={<AlertesPage />} />

          {/* Route Réservée exclusivement aux Administrateurs */}
          <Route
            path="parametres"
            element={
              <ProtectedRoute requireAdmin={true}>
                <ParametresPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
