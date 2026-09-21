import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface UseCameraScannerOptions {
  onScan: (scannedText: string) => void;
  debounceMs?: number; // Anti-doublon (défaut 2000 ms)
  fps?: number; // Cadence d'analyse (défaut 10 fps)
  facingMode?: "user" | "environment";
}

export function useCameraScanner({
  onScan,
  debounceMs = 2000,
  fps = 10,
  facingMode = "environment",
}: UseCameraScannerOptions) {
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem("atelier_preferred_camera") || "";
  });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string>("");

  // Arrête toutes les pistes d'un flux sans fuite
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Énumération des périphériques caméra
  const updateDeviceList = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Caméra ${index + 1}`,
        }));
      setDevices(videoInputs);

      // Si aucune caméra n'est sélectionnée, ou celle sélectionnée a disparu
      if (videoInputs.length > 0) {
        const stillExists = videoInputs.some((d) => d.deviceId === selectedDeviceId);
        if (!stillExists) {
          const defaultDev = videoInputs[0].deviceId;
          setSelectedDeviceId(defaultDev);
          localStorage.setItem("atelier_preferred_camera", defaultDev);
        }
      }
    } catch (err) {
      console.warn("Échec enumerateDevices:", err);
    }
  }, [selectedDeviceId]);

  // Initialisation du flux caméra
  const startCamera = useCallback(async () => {
    stopStream();
    setErrorType(null);
    setErrorMessage(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorType("NotFoundError");
      setErrorMessage("Votre système ou navigateur ne supporte pas l'accès caméra.");
      return;
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: selectedDeviceId
        ? {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
    };

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: unknown) {
        // En cas d'OverconstrainedError, tentative de repli avec contraintes simples
        const errName = (firstErr as Error)?.name;
        if (errName === "OverconstrainedError" || errName === "ConstraintNotSatisfiedError") {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play().catch(() => {});
      }

      setIsScanning(true);
      // Rafraîchit les noms de caméras maintenant que l'autorisation a été donnée
      await updateDeviceList();
    } catch (err: unknown) {
      const error = err as Error;
      setHasPermission(false);
      setIsScanning(false);
      setErrorType(error.name || "CameraError");

      switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          setErrorMessage(
            "Accès caméra refusé. Vérifiez vos autorisations dans Paramètres Windows > Confidentialité > Caméra (autoriser les applications de bureau)."
          );
          break;
        case "NotFoundError":
        case "DevicesNotFoundError":
          setErrorMessage("Aucune caméra détectée sur cet appareil.");
          break;
        case "NotReadableError":
        case "TrackStartError":
          setErrorMessage("La caméra est actuellement utilisée par une autre application.");
          break;
        case "OverconstrainedError":
          setErrorMessage("La résolution demandée n'est pas supportée par cette caméra.");
          break;
        default:
          setErrorMessage(`Erreur d'accès à la caméra : ${error.message || error.name}`);
      }
    }
  }, [facingMode, selectedDeviceId, stopStream, updateDeviceList]);

  // Boucle de scan cadencée (hors surcharge CPU)
  useEffect(() => {
    if (!isScanning) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let lastTick = 0;
    const intervalMs = 1000 / fps;
    let isActive = true;

    const tick = (time: number) => {
      if (!isActive) return;

      if (time - lastTick >= intervalMs) {
        lastTick = time;
        const video = videoRef.current;

        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          if (videoWidth > 0 && videoHeight > 0) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

            try {
              const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });

              if (code && code.data && code.data.trim()) {
                const now = Date.now();
                const scannedText = code.data.trim();

                // Anti-doublon temporel : même code dans les debounceMs ignoré
                const isSameCode = scannedText === lastScannedTextRef.current;
                const isDebounced = now - lastScanTimestampRef.current < debounceMs;

                if (!isSameCode || !isDebounced) {
                  lastScannedTextRef.current = scannedText;
                  lastScanTimestampRef.current = now;
                  onScan(scannedText);
                }
              }
            } catch {
              // Ignore les erreurs d'extraction occasionnelles
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isScanning, fps, debounceMs, onScan]);

  // Détection du branchement/débranchement à chaud de caméras
  useEffect(() => {
    const handleDeviceChange = () => {
      updateDeviceList();
    };

    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }
    updateDeviceList();

    return () => {
      if (navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
    };
  }, [updateDeviceList]);

  // Changement de caméra
  const changeCamera = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      localStorage.setItem("atelier_preferred_camera", deviceId);
    },
    []
  );

  // Arrêt strict à la destruction du hook
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    videoRef,
    devices,
    selectedDeviceId,
    hasPermission,
    errorType,
    errorMessage,
    isScanning,
    startCamera,
    stopCamera: stopStream,
    changeCamera,
  };
}
