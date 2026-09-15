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
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { useAlertEngine } from "./hooks/useAlertEngine";

export const App: React.FC = () => {
  // Lance le moteur d'alertes au démarrage et toutes les heures
  useAlertEngine();

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
