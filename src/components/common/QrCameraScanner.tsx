import React, { useState, useEffect } from "react";
import {
  Camera,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useCameraScanner } from "@/hooks/useCameraScanner";
import { playScanBeep } from "@/lib/sound";

export interface ScanResultHistoryItem {
  id: string;
  code: string;
  timestamp: string;
  status: "success" | "warning" | "error";
  message: string;
}

export interface QrCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeScanned: (rawCode: string) => {
    status: "success" | "warning" | "error";
    message: string;
  };
  title?: string;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  isOpen,
  onClose,
  onCodeScanned,
  title = "Scanner QR Code par Caméra",
}) => {
  const [history, setHistory] = useState<ScanResultHistoryItem[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [lastScanSuccess, setLastScanSuccess] = useState(false);

  const handleScan = (scannedText: string) => {
    playScanBeep(1400, 70);
    setLastScanSuccess(true);
    setTimeout(() => setLastScanSuccess(false), 800);

    const res = onCodeScanned(scannedText);
    const item: ScanResultHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      code: scannedText,
      timestamp: new Date().toLocaleTimeString(),
      status: res.status,
      message: res.message,
    };
    setHistory((prev) => [item, ...prev.slice(0, 7)]);
  };

  const {
    videoRef,
    devices,
    selectedDeviceId,
    errorMessage,
    isScanning,
    startCamera,
    stopCamera,
    changeCamera,
  } = useCameraScanner({
    onScan: handleScan,
    debounceMs: 2000,
    fps: 12,
  });

  // Démarrage ou arrêt de la caméra selon isOpen
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    handleScan(clean);
    setManualCode("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header sobre Papra */}
        <div className="h-13 px-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-foreground" />
            <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps principal */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Sélecteur de caméra si plusieurs sont disponibles */}
          {devices.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">Caméra :</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  changeCamera(e.target.value);
                  setTimeout(() => startCamera(), 100);
                }}
                className="flex-1 h-7 px-2 rounded-md bg-background border border-border text-xs text-foreground focus:outline-none"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zone Vidéo & Viseur */}
          <div className="relative aspect-4/3 w-full bg-black rounded-lg overflow-hidden flex items-center justify-center border border-border">
            {errorMessage ? (
              <div className="p-4 text-center text-xs text-destructive space-y-2 max-w-xs">
                <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                <p className="font-medium text-foreground">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-3 py-1 text-xs rounded-md bg-secondary text-foreground hover:bg-secondary/80 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Cadre de visée centré */}
                <div
                  className={`absolute w-56 h-56 rounded-lg border-2 pointer-events-none transition-all duration-200 ${
                    lastScanSuccess
                      ? "border-emerald-500 scale-105 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                      : "border-foreground/40"
                  }`}
                >
                  {/* Coins visuels */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-foreground" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-foreground" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-foreground" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-foreground" />
                </div>

                {isScanning && (
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-xs text-[11px] text-foreground font-medium border border-border/60">
                    Pointez le QR code vers la caméra
                  </div>
                )}
              </>
            )}
          </div>

          {/* Saisie manuelle de secours */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Saisir code article ou barcode (ex: BAR-SMK-001-48)"
              className="flex-1 h-8 px-2.5 rounded-md bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1 shrink-0"
            >
              <span>Valider</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Historique des derniers scans du panneau continu */}
          {history.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dernières lectures ({history.length})
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded-md border text-xs flex items-center justify-between ${
                      item.status === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-foreground"
                        : item.status === "warning"
                        ? "bg-amber-500/10 border-amber-500/20 text-foreground"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : item.status === "warning" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-medium truncate">{item.message}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-4 border-t border-border flex items-center justify-end bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            Fermer le scanner
          </button>
        </div>
      </div>
    </div>
  );
};
