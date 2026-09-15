/**
 * Module E — AlertCard v2
 * Carte d'affichage d'une alerte individuelle avec traçabilité complète :
 * - Rouge clignotant doux pour les retards
 * - Orange pour Jour-J
 * - J-1, J-2, J-3 stylisés
 * - Accès direct à la fiche location
 * - Actions : Marquer vue, Traiter (avec modal note), Acquitter, Réactiver
 */

import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Package,
  ShoppingBag,
  CheckCircle2,
  RotateCcw,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  CalendarX2,
  Eye,
  CheckCheck,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCents, formatDate } from "@/lib/utils";
import type { AppAlert } from "@/types/alert";
import { useRentalStore } from "@/store/rentalStore";
import { useAlertStore } from "@/store/alertStore";
import { useSettingsStore } from "@/store/settingsStore";
import { ouvrirWhatsApp } from "@/lib/whatsapp";
import { buildRappelRetourMessage } from "@/lib/whatsappTemplates";

interface AlertCardProps {
  alert: AppAlert;
  index: number;
  onDismiss: (alert: AppAlert) => void;
  onReactivate: (alertId: string) => void;
  onMarkViewed?: (alertId: string) => void;
  onProcess?: (alert: AppAlert) => void;
}

const CATEGORY_CONFIG: Record<
  AppAlert["category"],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
    glowClass?: string;
  }
> = {
  retard_retour: {
    label: "Retard de retour",
    icon: CalendarX2,
    badgeClass: "bg-red-500/20 text-red-500 border border-red-500/30",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-500/5",
    glowClass: "animate-pulse ring-1 ring-red-500/30 shadow-sm shadow-red-500/10",
  },
  retour_jour_j: {
    label: "Retour Aujourd'hui",
    icon: Clock,
    badgeClass: "bg-amber-500/20 text-amber-500 border border-amber-500/30",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-500/5",
  },
  retour_j1: {
    label: "Rappel J-1",
    icon: Clock,
    badgeClass: "bg-orange-500/20 text-orange-500 border border-orange-500/30",
    borderClass: "border-l-orange-400",
    bgClass: "bg-orange-500/5",
  },
  retour_j2: {
    label: "Rappel J-2",
    icon: Clock,
    badgeClass: "bg-blue-500/15 text-blue-500 border border-blue-500/25",
    borderClass: "border-l-blue-400",
    bgClass: "bg-blue-500/5",
  },
  retour_j3: {
    label: "Rappel J-3",
    icon: Clock,
    badgeClass: "bg-sky-500/15 text-sky-400 border border-sky-500/25",
    borderClass: "border-l-sky-400",
    bgClass: "bg-sky-500/5",
  },
  stock_bas: {
    label: "Stock bas",
    icon: Package,
    badgeClass: "bg-violet-500/15 text-violet-400 border border-violet-500/25",
    borderClass: "border-l-violet-400",
    bgClass: "bg-violet-500/5",
  },
  article_inactif: {
    label: "Article inactif",
    icon: ShoppingBag,
    badgeClass: "bg-gray-500/15 text-gray-400 border border-gray-500/25",
    borderClass: "border-l-gray-400",
    bgClass: "bg-gray-500/5",
  },
};

const SEVERITY_CONFIG = {
  critique: {
    dotClass: "bg-red-500",
    labelClass: "text-red-500 font-bold",
    label: "Critique",
  },
  avertissement: {
    dotClass: "bg-amber-500",
    labelClass: "text-amber-500 font-semibold",
    label: "Avertissement",
  },
  info: {
    dotClass: "bg-blue-400",
    labelClass: "text-blue-400 font-medium",
    label: "Info",
  },
};

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  index,
  onDismiss,
  onReactivate,
  onMarkViewed,
  onProcess,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(false);
  const cfg = CATEGORY_CONFIG[alert.category] || CATEGORY_CONFIG.stock_bas;
  const sevCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  const isDismissed = alert.status === "acquittee" || alert.status === "traitee";
  const markWhatsAppSent = useAlertStore((s) => s.markWhatsAppSent);
  const logAuditEvent = useSettingsStore((s) => s.logAuditEvent);

  const handleGoToRental = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alert.contract_number) {
      useRentalStore.getState().setSearchQuery(alert.contract_number);
      navigate("/locations");
    }
  };

  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!alert.customer_phone) {
      toast.error("Aucun numéro de téléphone disponible pour ce client.");
      return;
    }

    const message = buildRappelRetourMessage(
      alert.customer_name ?? "Client",
      alert.article_name ?? "Tenue de cérémonie",
      alert.return_date_scheduled ? formatDate(alert.return_date_scheduled) : "ce jour",
      alert.days_overdue && alert.days_overdue > 0 ? alert.days_overdue : undefined
    );

    const res = await ouvrirWhatsApp(alert.customer_phone, message);
    if (res.success) {
      markWhatsAppSent(alert.id, "Vendeur");
      logAuditEvent(
        "WHATSAPP_REMINDER",
        "alertes",
        alert.id,
        `Rappel WhatsApp envoyé à ${alert.customer_name} (${alert.customer_phone}) pour l'alerte ${alert.title}`
      );
      toast.success(`Conversation WhatsApp ouverte pour ${alert.customer_name} !`);
    } else {
      toast.error(res.error || "Impossible d'ouvrir WhatsApp");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDismissed ? 0.65 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        "rounded-xl border border-border bg-card border-l-4 shadow-sm overflow-hidden transition-all duration-300",
        cfg.borderClass,
        alert.category === "retard_retour" && !isDismissed && cfg.glowClass,
        isDismissed && "opacity-60 saturate-50"
      )}
    >
      {/* En-tête principal */}
      <div className="p-4 flex items-start gap-4">
        {/* Icône catégorie */}
        <div className={cn("p-2.5 rounded-lg shrink-0 mt-0.5", cfg.bgClass)}>
          <Icon className="w-5 h-5 text-foreground/80" />
        </div>

        {/* Contenu central */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Badge catégorie */}
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", cfg.badgeClass)}>
              {cfg.label}
            </span>

            {/* Point de sévérité */}
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  sevCfg.dotClass,
                  alert.severity === "critique" && !isDismissed && "animate-pulse"
                )}
              />
              <span className={cn("text-[10px]", sevCfg.labelClass)}>{sevCfg.label}</span>
            </span>

            {/* État de traçabilité */}
            {alert.status === "vue" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium flex items-center gap-1">
                <Eye className="w-2.5 h-2.5" /> Vue
              </span>
            )}
            {alert.status === "traitee" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold flex items-center gap-1">
                <CheckCheck className="w-2.5 h-2.5" /> Traitée
              </span>
            )}
            {alert.status === "acquittee" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25 font-semibold">
                ✓ Acquittée
              </span>
            )}
            {alert.whatsapp_sent_at && (
              <span
                title={`Rappel WhatsApp envoyé le ${formatDate(alert.whatsapp_sent_at)} par ${alert.whatsapp_sent_by ?? "Vendeur"}`}
                className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1 shadow-xs"
              >
                <MessageCircle className="w-2.5 h-2.5" /> WhatsApp envoyé
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold text-foreground truncate">{alert.title}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {alert.description}
          </p>

          {/* Tags contextuels */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {alert.customer_name && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground font-medium">
                👤 {alert.customer_name}
              </span>
            )}

            {alert.contract_number && (
              <button
                type="button"
                onClick={handleGoToRental}
                title="Cliquer pour ouvrir la fiche location"
                className="text-[10px] px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary font-mono font-bold flex items-center gap-1 transition-colors border border-primary/20 cursor-pointer"
              >
                <span>{alert.contract_number}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}

            {alert.article_name && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground truncate max-w-[200px]">
                🧥 {alert.article_name}{alert.variant_size ? ` (T.${alert.variant_size})` : ""}
              </span>
            )}

            {alert.days_overdue !== undefined && alert.days_overdue > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20 animate-pulse">
                +{alert.days_overdue}j de retard
              </span>
            )}

            {alert.late_fee_cents !== undefined && alert.late_fee_cents > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-medium border border-red-500/20">
                Pénalité : {formatCents(alert.late_fee_cents)}
              </span>
            )}

            {alert.current_stock !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded font-bold border",
                  alert.current_stock === 0
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                )}
              >
                Stock : {alert.current_stock} / min {alert.min_stock_threshold}
              </span>
            )}
          </div>
        </div>

        {/* Actions droite */}
        <div className="flex flex-col gap-2 items-end shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDate(alert.created_at)}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Bouton rappel WhatsApp */}
            {!isDismissed && (
              <button
                type="button"
                onClick={handleWhatsAppClick}
                disabled={!alert.customer_phone}
                title={
                  alert.customer_phone
                    ? alert.whatsapp_sent_at
                      ? `Rappel déjà envoyé le ${formatDate(alert.whatsapp_sent_at)}. Cliquer pour relancer sur WhatsApp.`
                      : "Envoyer un rappel de restitution via WhatsApp"
                    : "Aucun numéro de téléphone pour ce client"
                }
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all shadow-xs",
                  alert.customer_phone
                    ? alert.whatsapp_sent_at
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white"
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                    : "opacity-40 cursor-not-allowed bg-secondary text-muted-foreground border border-border"
                )}
              >
                <MessageCircle className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {alert.whatsapp_sent_at ? "Relancer WhatsApp" : "Rappel WhatsApp"}
                </span>
              </button>
            )}

            {/* Bouton appel client */}
            {alert.customer_phone && !isDismissed && (
              <a
                href={`tel:${alert.customer_phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <PhoneCall className="w-3 h-3" />
                <span className="hidden sm:inline">{alert.customer_phone}</span>
              </a>
            )}

            {/* Fiche location directe */}
            {alert.contract_number && (
              <button
                type="button"
                onClick={handleGoToRental}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted text-[10px] font-medium transition-all"
                title="Accéder directement à la location"
              >
                <ExternalLink className="w-3 h-3 text-primary" />
                <span className="hidden md:inline">Fiche</span>
              </button>
            )}

            {/* Marquer comme vu */}
            {alert.status === "active" && onMarkViewed && (
              <button
                type="button"
                onClick={() => onMarkViewed(alert.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted text-[10px] font-medium transition-all"
                title="Marquer comme vue sans archiver"
              >
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">Vu</span>
              </button>
            )}

            {/* Marquer comme traitée */}
            {!isDismissed && onProcess && (
              <button
                type="button"
                onClick={() => onProcess(alert)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold hover:bg-blue-500 hover:text-white transition-all"
                title="Marquer l'alerte comme traitée avec note de suivi"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Traiter</span>
              </button>
            )}

            {/* Bouton acquitter */}
            {!isDismissed ? (
              <button
                type="button"
                onClick={() => onDismiss(alert)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold hover:bg-emerald-500 hover:text-white transition-all"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Acquitter</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onReactivate(alert.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border text-[10px] font-medium hover:bg-muted transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réactiver</span>
              </button>
            )}

            {/* Bouton expand */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Panneau dépliable avec détails d'audit et traçabilité */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-border bg-secondary/30 px-4 py-3 text-[11px] text-muted-foreground space-y-1.5"
        >
          {alert.return_date_scheduled && (
            <p>
              <span className="font-semibold text-foreground">Date retour prévue :</span>{" "}
              {formatDate(alert.return_date_scheduled)}
            </p>
          )}
          {alert.customer_name && (
            <p>
              <span className="font-semibold text-foreground">Client :</span>{" "}
              {alert.customer_name} {alert.customer_phone ? `— ${alert.customer_phone}` : ""}
            </p>
          )}
          {alert.late_fee_cents !== undefined && alert.late_fee_cents > 0 && (
            <p>
              <span className="font-semibold text-foreground">Pénalité accumulée :</span>{" "}
              <span className="text-red-400 font-bold">{formatCents(alert.late_fee_cents)}</span>
            </p>
          )}
          {alert.whatsapp_sent_at && (
            <p className="text-emerald-500 font-medium flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>
                Rappel WhatsApp envoyé par {alert.whatsapp_sent_by ?? "Vendeur"} le{" "}
                {formatDate(alert.whatsapp_sent_at)}
              </span>
            </p>
          )}
          {alert.viewed_at && (
            <p className="text-blue-400">
              <span className="font-semibold">Consultée par :</span> {alert.viewed_by ?? "Opérateur"} le {formatDate(alert.viewed_at)}
            </p>
          )}
          {alert.processed_comment && (
            <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="font-semibold text-blue-400 mb-0.5">
                Traitée par {alert.processed_by ?? "Opérateur"} le {formatDate(alert.processed_at ?? "")}
              </p>
              <p className="italic text-foreground/90">"{alert.processed_comment}"</p>
            </div>
          )}
          {alert.dismiss_comment && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="font-semibold text-emerald-400 mb-0.5">
                Acquittée par {alert.dismissed_by} le {formatDate(alert.dismissed_at ?? "")}
              </p>
              <p className="italic">"{alert.dismiss_comment}"</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
