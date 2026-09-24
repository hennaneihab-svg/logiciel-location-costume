import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  RefreshCw,
  Info,
  Clock,
  Shirt,
  Move,
} from "lucide-react";
import {
  useMatrixStore,
  formatDateToIso,
  addDays,
  parseIsoDate,
} from "@/store/matrixStore";
import { useStockStore } from "@/store/stockStore";
import { toast } from "sonner";
import { ContractQuickDetailModal } from "./ContractQuickDetailModal";
import { RescheduleConfirmModal } from "./RescheduleConfirmModal";
import type {
  AvailabilitySlot,
  SlotNature,
  VariantAvailabilityMatrixRow,
  PendingRescheduleProposal,
} from "@/types/matrix";

export const AvailabilityMatrix: React.FC = () => {
  const {
    startDate,
    daysCount,
    rows,
    isLoading,
    loadMatrix,
    setStartDate,
    shiftDays,
    resetToToday,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedArticleId,
    setSelectedArticleId,
    page,
    setPage,
    pageSize,
    setPageSize,
    validateSlotAvailability,
    rescheduleRental,
    optimisticReschedule,
    rollbackOptimisticReschedule,
    pendingProposal,
    setPendingProposal,
  } = useMatrixStore();

  const { articles } = useStockStore();

  // Extraction unique des catégories depuis les articles
  const categories = useMemo<{ id: string; name: string }[]>(() => {
    const map = new Map<string, string>();
    articles.forEach((a) => {
      if (a.category_id && a.category_name) {
        map.set(a.category_id, a.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [articles]);

  // État local pour le tooltip interactif
  const [hoveredSlot, setHoveredSlot] = useState<{
    slot: AvailabilitySlot;
    row: VariantAvailabilityMatrixRow;
    dateIso: string;
    x: number;
    y: number;
  } | null>(null);

  // État modal de détail contrat (clic simple)
  const [inspectedContractRef, setInspectedContractRef] = useState<string | null>(null);

  // État Drag and Drop
  const [draggingSlot, setDraggingSlot] = useState<{
    slot: AvailabilitySlot;
    sourceRow: VariantAvailabilityMatrixRow;
  } | null>(null);

  const [dragOverCell, setDragOverCell] = useState<{
    varianteId: string;
    dateIso: string;
  } | null>(null);

  // Chargement initial
  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Génération de la séquence des 30 jours calendaires
  const daysList = useMemo(() => {
    const start = parseIsoDate(startDate);
    const days: { date: Date; iso: string; dayName: string; dayNum: number; monthName: string; isWeekend: boolean; isToday: boolean }[] = [];
    const todayIso = formatDateToIso(new Date());

    const formatterDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
    const formatterMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });

    for (let i = 0; i < daysCount; i++) {
      const d = addDays(start, i);
      const iso = formatDateToIso(d);
      const dayOfWeek = d.getDay(); // 0 = Dimanche, 6 = Samedi
      days.push({
        date: d,
        iso,
        dayName: formatterDay.format(d).replace(".", "").toUpperCase(),
        dayNum: d.getDate(),
        monthName: formatterMonth.format(d).replace(".", "").toLowerCase(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: iso === todayIso || iso === "2026-09-14",
      });
    }

    return days;
  }, [startDate, daysCount]);

  // Filtrage combiné (Recherche textuelle, Catégorie, Article)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Filtre article spécifique
      if (selectedArticleId && r.article_id !== selectedArticleId) {
        return false;
      }

      // Filtre catégorie
      if (selectedCategory) {
        const art = articles.find((a) => a.id === r.article_id);
        if (!art || art.category_id !== selectedCategory) {
          return false;
        }
      }

      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNom = r.article_nom.toLowerCase().includes(q);
        const matchRef = r.reference.toLowerCase().includes(q);
        const matchTaille = r.taille.toLowerCase().includes(q);
        const matchId = r.variante_id.toLowerCase().includes(q);
        if (!matchNom && !matchRef && !matchTaille && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [rows, selectedArticleId, selectedCategory, searchQuery, articles]);

  // Pagination des variantes pour préserver les performances DOM
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Rendu visuel d'un créneau selon sa nature (Charte DressRent & codes métier adoucis)
  const getSlotStyle = (nature: SlotNature) => {
    switch (nature) {
      case "location":
        return {
          bg: "bg-status-reserved-bg text-status-reserved border-status-reserved-border hover:opacity-90",
          badge: "bg-status-reserved text-white",
          label: "Location",
        };
      case "pressing":
        return {
          bg: "bg-status-cleaning-bg text-status-cleaning border-status-cleaning-border hover:opacity-90",
          badge: "bg-status-cleaning text-white font-bold",
          label: "Pressing",
        };
      case "retard":
        return {
          bg: "bg-status-late-bg text-status-late border-status-late-border hover:opacity-90 animate-pulse",
          badge: "bg-status-late text-white font-bold",
          label: "Retard",
        };
    }
  };

  // Trouver le créneau actif pour une variante et un jour donné
  const findSlotForDate = (row: VariantAvailabilityMatrixRow, dateIso: string): AvailabilitySlot | undefined => {
    return row.slots.find((s) => dateIso >= s.date_debut && dateIso <= s.date_fin);
  };

  const handleCellClick = (slot?: AvailabilitySlot) => {
    if (!slot) return;
    if (slot.nature === "location" || slot.nature === "retard") {
      const ref = slot.reference_code || slot.reference_id;
      if (ref) {
        setInspectedContractRef(ref);
      }
    }
  };

  // ============================================================================
  // GESTION DU DRAG AND DROP (C1, C2, C3)
  // ============================================================================

  const handleDragStart = (
    e: React.DragEvent,
    slot: AvailabilitySlot,
    sourceRow: VariantAvailabilityMatrixRow
  ) => {
    if (slot.nature !== "location") {
      e.preventDefault();
      return;
    }

    setHoveredSlot(null);
    setDraggingSlot({ slot, sourceRow });

    const payload = JSON.stringify({
      slot,
      sourceRowId: sourceRow.variante_id,
    });
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/json", payload);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: React.DragEvent, targetRow: VariantAvailabilityMatrixRow, dateIso: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    if (
      !dragOverCell ||
      dragOverCell.varianteId !== targetRow.variante_id ||
      dragOverCell.dateIso !== dateIso
    ) {
      setDragOverCell({ varianteId: targetRow.variante_id, dateIso });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetRow: VariantAvailabilityMatrixRow,
    dropDateIso: string
  ) => {
    e.preventDefault();
    setDragOverCell(null);

    let slot = draggingSlot?.slot;
    let sourceRow = draggingSlot?.sourceRow;

    if (!slot || !sourceRow) {
      const rawData = e.dataTransfer.getData("application/json");
      if (rawData) {
        try {
          const parsed = JSON.parse(rawData);
          slot = parsed.slot;
          sourceRow = rows.find((r) => r.variante_id === parsed.sourceRowId) || targetRow;
        } catch {
          // ignore
        }
      }
    }

    setDraggingSlot(null);

    if (!slot || !sourceRow) return;

    // Calculer la durée initiale en jours
    const startObj = parseIsoDate(slot.date_debut);
    const endObj = parseIsoDate(slot.date_fin);
    const durationDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)));

    // Nouvelles dates cibles
    const newStartObj = parseIsoDate(dropDateIso);
    const newEndObj = addDays(newStartObj, durationDays);
    const newStartDate = dropDateIso;
    const newEndDate = formatDateToIso(newEndObj);

    // Si la cible est identique aux dates et variantes actuelles, ne rien faire
    if (
      sourceRow.variante_id === targetRow.variante_id &&
      slot.date_debut === newStartDate
    ) {
      return;
    }

    const proposal: PendingRescheduleProposal = {
      slot,
      sourceRow,
      targetRow,
      newStartDate,
      newEndDate,
      durationDays,
    };

    // 1. Déplacement visuel optimiste immédiat (C1)
    optimisticReschedule(proposal);

    // 2. Validation immédiate côté backend (C2)
    const excludeId = slot.reference_id || slot.reference_code || undefined;
    const validation = await validateSlotAvailability(
      targetRow.variante_id,
      newStartDate,
      newEndDate,
      excludeId
    );

    if (!validation.disponible) {
      // Annulation visuelle immédiate + affichage du motif exact
      rollbackOptimisticReschedule();
      toast.error(
        validation.motif_refus ||
          "Impossible de déplacer la réservation : conflit de disponibilité avec une autre location ou un tampon pressing."
      );
      return;
    }

    // 3. Si validé : ouverture de la modal de confirmation explicite avant écriture
    setPendingProposal(proposal);
  };

  const handleConfirmReschedule = async () => {
    if (!pendingProposal) return;

    try {
      const locationId = pendingProposal.slot.reference_id || pendingProposal.slot.reference_code || "";
      await rescheduleRental({
        location_id: locationId,
        current_variant_id: pendingProposal.sourceRow.variante_id,
        target_variant_id: pendingProposal.targetRow.variante_id,
        new_pickup_date: pendingProposal.newStartDate,
        new_return_date: pendingProposal.newEndDate,
      });

      toast.success(
        `Contrat ${pendingProposal.slot.reference_code || locationId} reprogrammé avec succès du ${pendingProposal.newStartDate} au ${pendingProposal.newEndDate} !`
      );
      setPendingProposal(null);
    } catch (err: any) {
      rollbackOptimisticReschedule();
      await loadMatrix();
      setPendingProposal(null);
      toast.error(
        err?.message || "Erreur lors de la confirmation de reprogrammation (conflit concurrent)."
      );
    }
  };

  const handleCancelReschedule = () => {
    rollbackOptimisticReschedule();
    setPendingProposal(null);
  };

  return (
    <div className="space-y-4">
      {/* 1. Barre de Contrôle et Navigation Temporelle */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
        {/* Navigation Jours */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetToToday}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-semibold text-foreground border border-border transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            <span>Aujourd'hui</span>
          </button>

          <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-0.5">
            <button
              type="button"
              onClick={() => shiftDays(-7)}
              title="Reculer de 7 jours"
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-foreground">
              7 jours
            </span>
            <button
              type="button"
              onClick={() => shiftDays(7)}
              title="Avancer de 7 jours"
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Début :</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => loadMatrix()}
            disabled={isLoading}
            title="Rafraîchir les disponibilités"
            className="p-2 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>

        {/* Légende Interactive & Drag Help */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          <span className="text-muted-foreground font-medium">Légende :</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-status-reserved-bg text-status-reserved border border-status-reserved-border">
            <span className="w-2 h-2 rounded-full bg-status-reserved" />
            <span className="font-semibold">Location (Glissable)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-status-cleaning-bg text-status-cleaning border border-status-cleaning-border">
            <span className="w-2 h-2 rounded-full bg-status-cleaning" />
            <span className="font-semibold">Pressing</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-status-late-bg text-status-late border border-status-late-border">
            <span className="w-2 h-2 rounded-full bg-status-late animate-ping" />
            <span className="font-semibold">Retard</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-status-completed-bg text-status-completed border border-status-completed-border">
            <span className="w-2 h-2 rounded-full bg-status-completed" />
            <span className="font-semibold">Disponible</span>
          </div>
        </div>
      </div>

      {/* 2. Filtres (Recherche, Catégories, Articles) & Pagination */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-3 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Recherche texte */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer modèle, taille, réf..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filtre Catégorie */}
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Filtre Article Spécifique */}
          <select
            value={selectedArticleId || ""}
            onChange={(e) => setSelectedArticleId(e.target.value || null)}
            className="h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[200px] truncate"
          >
            <option value="">Tous les articles</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.reference} - {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Contrôles de Pagination */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Variantes / page :</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-semibold text-foreground font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Grille Matricielle Articles × Jours */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Conteneur défilant avec colonnes et en-têtes sticky */}
        <div className="overflow-x-auto max-h-[650px] relative select-none">
          <table className="w-full border-collapse text-left">
            {/* En-tête des colonnes de dates */}
            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs border-b border-border">
              <tr>
                {/* Colonne Variante (Sticky Gauche) */}
                <th className="sticky left-0 z-30 bg-muted/95 backdrop-blur-xs p-3 min-w-[240px] max-w-[260px] border-r border-border text-xs font-bold text-foreground">
                  <div className="flex items-center justify-between">
                    <span>Variantes & Articles</span>
                    <span className="text-[10px] font-normal text-muted-foreground font-mono">
                      {filteredRows.length} pièces
                    </span>
                  </div>
                </th>

                {/* 30 Colonnes Jours */}
                {daysList.map((d) => (
                  <th
                    key={d.iso}
                    className={`p-1.5 text-center min-w-[42px] max-w-[42px] border-r border-border/40 font-mono transition-colors ${
                      d.isToday
                        ? "bg-primary/15 text-primary border-b-2 border-b-primary font-bold"
                        : d.isWeekend
                        ? "bg-secondary/40 text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <div className="text-[9px] uppercase font-bold tracking-tighter opacity-80">
                      {d.dayName}
                    </div>
                    <div className="text-xs font-black leading-tight">
                      {d.dayNum}
                    </div>
                    <div className="text-[8px] opacity-70">
                      {d.monthName}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Lignes Variantes */}
            <tbody className="divide-y divide-border/50 text-xs">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysList.length + 1}
                    className="p-12 text-center text-muted-foreground"
                  >
                    <Shirt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="font-semibold text-foreground">Aucune variante trouvée</p>
                    <p className="text-xs mt-1">
                      Ajustez vos filtres de recherche ou sélectionnez une autre catégorie.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.variante_id} className="hover:bg-secondary/20 transition-colors">
                    {/* Colonne fixe Variante */}
                    <td className="sticky left-0 z-10 bg-card/95 backdrop-blur-xs p-2.5 border-r border-border max-w-[260px]">
                      <div className="font-semibold text-foreground truncate text-xs" title={row.article_nom}>
                        {row.article_nom}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-mono font-medium text-foreground">{row.reference}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 rounded bg-secondary text-foreground font-semibold">
                          T.{row.taille}
                        </span>
                        {row.sous_taille && (
                          <span className="text-muted-foreground">({row.sous_taille})</span>
                        )}
                      </div>
                    </td>

                    {/* 30 Cellules de jours */}
                    {daysList.map((d) => {
                      const slot = findSlotForDate(row, d.iso);
                      const isSlotStart = slot && slot.date_debut === d.iso;
                      const isSlotEnd = slot && slot.date_fin === d.iso;
                      const isDragTarget =
                        dragOverCell?.varianteId === row.variante_id &&
                        dragOverCell?.dateIso === d.iso;

                      if (!slot) {
                        return (
                          <td
                            key={d.iso}
                            data-testid={`cell-${row.variante_id}-${d.iso}`}
                            onDragOver={(e) => handleDragOver(e, row, d.iso)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, row, d.iso)}
                            className={`p-0 border-r border-border/30 text-center transition-colors hover:bg-status-completed-bg/60 ${
                              isDragTarget
                                ? "bg-primary/25 ring-2 ring-primary ring-inset"
                                : d.isWeekend
                                ? "bg-secondary/20"
                                : ""
                            }`}
                            title={`${row.article_nom} (T.${row.taille}) - Glisser ici pour reprogrammer au ${d.iso}`}
                          >
                            <div className="h-9 w-full flex items-center justify-center">
                              {isDragTarget ? (
                                <Move className="w-3.5 h-3.5 text-primary animate-bounce" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-status-completed/25 opacity-0 hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </td>
                        );
                      }

                      const style = getSlotStyle(slot.nature);
                      const isClickable = slot.nature === "location" || slot.nature === "retard";
                      const isDraggable = slot.nature === "location";

                      return (
                        <td
                          key={d.iso}
                          data-testid={`cell-${row.variante_id}-${d.iso}`}
                          onClick={() => handleCellClick(slot)}
                          onDragOver={(e) => handleDragOver(e, row, d.iso)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, row, d.iso)}
                          onMouseEnter={(e) => {
                            if (!draggingSlot) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredSlot({
                                slot,
                                row,
                                dateIso: d.iso,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredSlot(null)}
                          className={`p-0.5 border-r border-border/30 transition-all ${
                            isDragTarget ? "bg-primary/25 ring-2 ring-primary ring-inset" : ""
                          } ${d.isWeekend ? "bg-secondary/20" : ""}`}
                        >
                          <div
                            draggable={isDraggable}
                            onDragStart={(e) => isDraggable && handleDragStart(e, slot, row)}
                            data-testid={`slot-${slot.nature}`}
                            data-reference={slot.reference_code || slot.reference_id || ""}
                            className={`h-8 w-full border flex items-center justify-center text-[10px] font-bold transition-all shadow-xs ${
                              style.bg
                            } ${isClickable ? "cursor-pointer active:scale-95" : "cursor-default"} ${
                              isDraggable ? "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-blue-400" : ""
                            } ${
                              isSlotStart ? "rounded-l-md border-l-2" : "rounded-l-none border-l-0"
                            } ${
                              isSlotEnd ? "rounded-r-md border-r-2" : "rounded-r-none border-r-0"
                            }`}
                          >
                            {isSlotStart && (
                              <span className="truncate px-1 tracking-tighter flex items-center gap-0.5">
                                {isDraggable && <Move className="w-2.5 h-2.5 opacity-60 shrink-0" />}
                                <span>
                                  {slot.nature === "pressing"
                                    ? "PRS"
                                    : slot.reference_code
                                    ? slot.reference_code.replace("LOC-2026-", "#")
                                    : "LOC"}
                                </span>
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Barre d'état inférieure */}
        <div className="p-3 border-t border-border bg-muted/40 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-primary" />
            <span>
              Horizon glissant de 30 jours : du <strong>{startDate}</strong> au{" "}
              <strong>{daysList[daysList.length - 1]?.iso}</strong>. Glissez-déposez un bloc bleu pour le reprogrammer.
            </span>
          </div>

          <div className="text-[11px]">
            Affichage de <strong>{paginatedRows.length}</strong> sur <strong>{filteredRows.length}</strong> variantes
            filtrées.
          </div>
        </div>
      </div>

      {/* 5. Tooltip Interactif au Survol (Floating Info-bulle) */}
      {hoveredSlot && !draggingSlot && (
        <div
          role="tooltip"
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl text-xs max-w-xs animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${hoveredSlot.x}px`,
            top: `${hoveredSlot.y - 8}px`,
          }}
        >
          {/* Header Tooltip */}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5 mb-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                getSlotStyle(hoveredSlot.slot.nature).badge
              }`}
            >
              {getSlotStyle(hoveredSlot.slot.nature).label}
            </span>
            {hoveredSlot.slot.reference_code && (
              <span className="font-mono font-bold text-[11px] text-foreground">
                {hoveredSlot.slot.reference_code}
              </span>
            )}
          </div>

          {/* Vêtement */}
          <div className="font-semibold text-foreground">
            {hoveredSlot.row.article_nom}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Taille : <strong>{hoveredSlot.row.taille}</strong>{" "}
            {hoveredSlot.row.sous_taille && `(${hoveredSlot.row.sous_taille})`}
          </div>

          {/* Client */}
          {hoveredSlot.slot.client_nom && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[11px]">
              <span className="text-muted-foreground">Client : </span>
              <strong className="text-foreground">{hoveredSlot.slot.client_nom}</strong>
            </div>
          )}

          {/* Période */}
          <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-primary shrink-0" />
            <span>
              Du {hoveredSlot.slot.date_debut} au {hoveredSlot.slot.date_fin}
            </span>
          </div>

          {/* Description */}
          {hoveredSlot.slot.description && (
            <div className="mt-1 text-[10px] italic text-muted-foreground">
              {hoveredSlot.slot.description}
            </div>
          )}

          {(hoveredSlot.slot.nature === "location" || hoveredSlot.slot.nature === "retard") && (
            <div className="mt-2 pt-1 border-t border-border/50 text-[9px] text-primary font-bold">
              💡 Cliquez pour ouvrir la fiche • Glissez pour reprogrammer
            </div>
          )}
        </div>
      )}

      {/* 6. Modal Fiche Rapide de Contrat (Clic simple) */}
      {inspectedContractRef && (
        <ContractQuickDetailModal
          contractIdOrCode={inspectedContractRef}
          onClose={() => setInspectedContractRef(null)}
        />
      )}

      {/* 7. Modal Confirmation Explicite de Déplacement (Drop validé) */}
      {pendingProposal && (
        <RescheduleConfirmModal
          proposal={pendingProposal}
          onConfirm={handleConfirmReschedule}
          onCancel={handleCancelReschedule}
        />
      )}
    </div>
  );
};
