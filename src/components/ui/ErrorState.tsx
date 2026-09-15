/**
 * ErrorState.tsx — Composant etat vide / erreur reutilisable
 * Usage : <ErrorState icon={AlertTriangle} title="..." description="..." onRetry={fn} />
 */
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  variant?: "error" | "empty" | "info";
}

const variantStyles = {
  error: "border-red-500/20 bg-red-500/5",
  empty: "border-border bg-card",
  info: "border-blue-500/20 bg-blue-500/5",
};

const variantIconColors = {
  error: "text-red-500",
  empty: "text-muted-foreground",
  info: "text-blue-500",
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  icon: Icon = AlertTriangle,
  title = "Une erreur est survenue",
  description = "Impossible de charger les donnees. Verifiez votre connexion et reessayez.",
  onRetry,
  retryLabel = "Reessayer",
  className,
  variant = "error",
}) => (
  <div
    className={cn(
      "p-10 rounded-2xl border text-center space-y-4",
      variantStyles[variant],
      className
    )}
  >
    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto bg-current/10", variantIconColors[variant])}>
      <Icon className={cn("w-6 h-6", variantIconColors[variant])} />
    </div>
    <div className="space-y-1.5">
      <h3 className="font-bold text-sm text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm mx-auto"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {retryLabel}
      </button>
    )}
  </div>
);
