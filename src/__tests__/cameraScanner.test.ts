import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCameraScanner } from "@/hooks/useCameraScanner";

describe("useCameraScanner Hook", () => {
  let mockStopTrack: ReturnType<typeof vi.fn>;
  let mockMediaStream: MediaStream;

  beforeEach(() => {
    mockStopTrack = vi.fn();
    mockMediaStream = {
      getTracks: () => [
        { stop: mockStopTrack, kind: "video" } as unknown as MediaStreamTrack,
      ],
    } as unknown as MediaStream;

    // Mock de navigator.mediaDevices
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: "cam-1", kind: "videoinput", label: "Webcam Intégrée HD" },
          { deviceId: "cam-2", kind: "videoinput", label: "Webcam Externe USB" },
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gère l'accès caméra et l'énumération des périphériques", async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useCameraScanner({ onScan }));

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasPermission).toBe(true);
    expect(result.current.isScanning).toBe(true);
    expect(result.current.devices.length).toBe(2);
    expect(result.current.devices[0].label).toBe("Webcam Intégrée HD");
  });

  it("gère l'erreur NotAllowedError (refus de permission par l'utilisateur ou Windows)", async () => {
    const notAllowedError = new Error("Permission denied");
    notAllowedError.name = "NotAllowedError";

    (navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      notAllowedError
    );

    const onScan = vi.fn();
    const { result } = renderHook(() => useCameraScanner({ onScan }));

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.errorType).toBe("NotAllowedError");
    expect(result.current.errorMessage).toContain("Paramètres Windows > Confidentialité > Caméra");
  });

  it("gère l'erreur NotFoundError (aucune caméra connectée)", async () => {
    const notFoundError = new Error("Requested device not found");
    notFoundError.name = "NotFoundError";

    (navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      notFoundError
    );

    const onScan = vi.fn();
    const { result } = renderHook(() => useCameraScanner({ onScan }));

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.errorType).toBe("NotFoundError");
    expect(result.current.errorMessage).toContain("Aucune caméra détectée");
  });

  it("arrête toutes les pistes vidéo (track.stop) à l'appel de stopCamera", async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useCameraScanner({ onScan }));

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isScanning).toBe(true);

    act(() => {
      result.current.stopCamera();
    });

    expect(mockStopTrack).toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  });

  it("arrête automatiquement les flux vidéo au démontage du composant (anti-fuite voyant caméra)", async () => {
    const onScan = vi.fn();
    const { result, unmount } = renderHook(() => useCameraScanner({ onScan }));

    await act(async () => {
      await result.current.startCamera();
    });

    unmount();

    expect(mockStopTrack).toHaveBeenCalled();
  });
});
