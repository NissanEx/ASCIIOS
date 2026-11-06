// Engine cadangan: speechSynthesis bawaan browser/Electron. Tanpa key, tanpa login.
const MS_PER_CHAR = 65;

export type TTSOptions = { provider?: string; voice?: string; lang?: string };

export type TTSEngine = {
  speak(text: string, opts: TTSOptions, onChar?: (i: number) => void, onEnd?: () => void): boolean;
  cancel(): void;
  getLevel(): number;
};

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices().filter((v) => v.localService);
  const base = lang.split("-")[0].toLowerCase();
  return (
    vs.find((v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase()) ||
    vs.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}

let voiceBroken = false; // voice pilihan pernah gagal -> pakai default sistem di panggilan berikutnya

export function createWebSpeechEngine(): TTSEngine {
  let gen = 0;
  let speaking = false;
  let gotBoundary = false;
  let pulse = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const ok = () => typeof window !== "undefined" && !!window.speechSynthesis;

  const cancel = () => {
    gen++;
    stopTimer();
    const was = speaking;
    speaking = false;
    if (ok() && (was || window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
  };

  const speak: TTSEngine["speak"] = (text, opts, onChar, onEnd) => {
    cancel();
    if (!text || !ok()) return false;
    const my = gen;
    let retried = false;
    let startedAt = 0;
    gotBoundary = false;

    const finish = () => {
      if (my !== gen) return;
      stopTimer();
      speaking = false;
      onChar?.(text.length);
      onEnd?.();
    };

    // Tidak ada suara sama sekali: mulut tetap jalan sesuai estimasi waktu
    const silentFallback = () => {
      if (my !== gen) return;
      speaking = true;
      gotBoundary = false;
      const t0 = performance.now();
      stopTimer();
      timer = setInterval(() => {
        if (my !== gen) return;
        const i = Math.floor((performance.now() - t0) / MS_PER_CHAR);
        if (i >= text.length) {
          finish();
          return;
        }
        onChar?.(i);
      }, 80);
    };

    const onstart = () => {
      if (my !== gen) return;
      speaking = true;
      startedAt = performance.now();
      onChar?.(0);
      stopTimer();
      timer = setInterval(() => {
        if (my !== gen || gotBoundary) return;
        onChar?.(Math.min(text.length - 1, Math.floor((performance.now() - startedAt) / MS_PER_CHAR)));
      }, 80);
    };

    const onboundary = (e: SpeechSynthesisEvent) => {
      if (my !== gen) return;
      gotBoundary = true;
      pulse = performance.now();
      onChar?.(e.charIndex);
    };

    const u = new SpeechSynthesisUtterance(text);
    const v = voiceBroken ? null : pickVoice(opts.lang || "id-ID");
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.onstart = onstart;
    u.onboundary = onboundary;
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") return;
      if (my !== gen) return;
      console.debug("[TTS cadangan] percobaan 1 gagal:", e.error);
      if (e.error === "synthesis-failed" && !retried) {
        retried = true;
        voiceBroken = true;
        const u2 = new SpeechSynthesisUtterance(text); // polos: default sistem
        u2.onstart = onstart;
        u2.onboundary = onboundary;
        u2.onend = finish;
        u2.onerror = () => silentFallback();
        window.speechSynthesis.speak(u2);
        return;
      }
      silentFallback();
    };

    window.speechSynthesis.speak(u);
    return true;
  };

  const getLevel = () => {
    if (!speaking) return -1;
    const now = performance.now();
    if (gotBoundary) return 0.02 + 0.09 * Math.max(0, 1 - (now - pulse) / 200);
    return 0.06 + 0.05 * Math.abs(Math.sin(now / 90));
  };

  return { speak, cancel, getLevel };
}