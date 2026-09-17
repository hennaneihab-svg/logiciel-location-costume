import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, switchUserRole } = useAuthStore();
  const { logAuditEvent } = useSettingsStore();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Veuillez renseigner votre identifiant et votre mot de passe.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = login({ username, password });
    setIsSubmitting(false);

    if (result.success) {
      logAuditEvent(
        "LOGIN_SUCCESS",
        "session",
        username,
        `Connexion réussie utilisateur ${username}`
      );
      toast.success(`Bienvenue ! Connexion réussie.`);
      navigate("/");
    } else {
      logAuditEvent(
        "LOGIN_FAILURE",
        "session",
        username,
        `Tentative de connexion échouée pour ${username}`
      );
      setErrorMsg(result.error || "Identifiants invalides.");
      toast.error(result.error || "Identifiants invalides.");
    }
  };

  const handleQuickLogin = (role: "admin" | "vendeur") => {
    switchUserRole(role);
    const label = role === "admin" ? "Directeur Général (Admin)" : "Sophie Vendeuse (Vendeur)";
    toast.success(`Connecté avec succès en tant que ${label}`);
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-sm space-y-6"
      >
        {/* Logo & Titre */}
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center mx-auto font-bold text-sm tracking-wider">
            AP
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground uppercase">
            Atelier Prestige
          </h1>
          <p className="text-xs text-muted-foreground">
            Logiciel de gestion • Costumes &amp; Cérémonie
          </p>
        </div>

        {/* Formulaire de Connexion */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Identifiant</span>
            </label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin ou vendeur"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Mot de passe</span>
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 pl-3 pr-9 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md bg-foreground text-background font-medium text-xs hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Se connecter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Accès Démo Rapide */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="text-[11px] text-muted-foreground font-medium">
            Accès rapide de démonstration :
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin")}
              className="p-2 rounded-md border border-border bg-muted/40 hover:bg-muted text-left transition-colors"
            >
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Directeur</span>
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Admin (complet)
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("vendeur")}
              className="p-2 rounded-md border border-border bg-muted/40 hover:bg-muted text-left transition-colors"
            >
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Vendeuse</span>
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Vendeur (restreint)
              </p>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
