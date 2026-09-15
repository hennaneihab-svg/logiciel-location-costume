import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  KeyRound,
  Store,
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4 relative overflow-hidden">
      {/* Halo décoratif de fond */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl relative z-10 space-y-6"
      >
        {/* Logo & Titre */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            ATELIER PRESTIGE
          </h1>
          <p className="text-xs text-muted-foreground">
            Logiciel de Gestion • Cérémonie, Costumes & Chaussures
          </p>
        </div>

        {/* Formulaire de Connexion */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>Identifiant utilisateur</span>
            </label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: admin ou vendeur"
              className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span>Mot de passe (Bcrypt)</span>
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-medium animate-in shake">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            <span>Se connecter</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Accès Démo Rapide */}
        <div className="pt-4 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Accès rapide démonstration :
            </span>
            <span className="text-[10px] text-primary font-mono">Bcrypt vérifié</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin")}
              className="p-2.5 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-left transition-all group"
            >
              <div className="text-xs font-bold text-foreground group-hover:text-primary flex items-center justify-between">
                <span>Directeur</span>
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Rôle Admin • Accès total
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("vendeur")}
              className="p-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-left transition-all group"
            >
              <div className="text-xs font-bold text-foreground group-hover:text-primary flex items-center justify-between">
                <span>Vendeuse</span>
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Rôle Vendeur • Restreint
              </p>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
