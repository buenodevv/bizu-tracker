let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      return null;
    }
  }

  return audioContext;
}

/**
 * Prepara o áudio a partir de um gesto do usuário (play/resume). Sem isso,
 * o navegador pode bloquear o som quando a fase termina em outra página.
 */
export function primeTimerAudio(): void {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

/** Sinal curto de duas notas — suave, para não assustar. */
export async function playTimerChime(): Promise<void> {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") await context.resume();
  } catch {
    return;
  }
  if (context.state !== "running") return;

  const startAt = context.currentTime;
  const notes = [880, 1174.66];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = startAt + index * 0.16;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.6);
  });
}
