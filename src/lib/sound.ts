/**
 * Émet un bref bip sonore via Web Audio API pour le retour haptique/auditif de scan
 */
export function playScanBeep(frequency = 1200, durationMs = 80): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Fade in et fade out rapide pour éviter les clics audio
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);

    // Libération du contexte après utilisation
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, durationMs + 50);
  } catch (err) {
    // Silencieux si l'audio n'est pas supporté ou bloqué par les politiques de navigateur
  }
}
