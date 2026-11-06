// hooks/usePuterTTS.ts
"use client";
import { useCallback, useRef } from "react";
import { getGeminiClient } from "@/lib/gemini/client";
import { emitVoiceNotice } from "@/lib/voiceNotice";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = "Kore";
// false = tidak memanggil Gemini TTS, jadi tidak memakai kuota
const TTS_ENABLED = process.env.NEXT_PUBLIC_TTS_ENABLED !== "false";

// bobot waktu per karakter: jeda tanda baca lebih lama dari huruf biasa
const weight = (ch: string) =>
  /[.!?]/.test(ch) ? 6 : /[,;:]/.test(ch) ? 3 : ch === " " ? 0.7 : 1;

function buildCum(text: string) {
  const cum: number[] = [];
  let tot = 0;
  for (const ch of text) { tot += weight(ch); cum.push(tot); }
  return { cum, tot };
}

// buang hening di awal dan akhir audio
function trimBounds(ch: Float32Array, rate: number) {
  let a = 0, b = ch.length - 1;
  while (a < b && Math.abs(ch[a]) < 0.02) a++;
  while (b > a && Math.abs(ch[b]) < 0.02) b--;
  return {
    start: Math.max(0, a / rate - 0.03),
    end: Math.min(ch.length / rate, b / rate + 0.05),
  };
}

// format sisa waktu tunggu jadi "X jam Y menit"
function fmtWait(ms: number) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}

// 1. TAMBAHKAN PARAMETER apiKey DI SINI
export function usePuterTTS(apiKey?: string) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef(false);
  const reqRef = useRef(0);
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const dataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(1024));
  // waktu (epoch ms) sampai kapan pemanggilan API diblokir karena kuota habis
  const blockedUntilRef = useRef(0);

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
    playingRef.current = false;
  };

  const cancel = useCallback(() => {
    reqRef.current++;
    stopAll();
  }, []);

  const speak = useCallback(
    async (
      text: string,
      _o: unknown,
      onWord: (wordIndex: number, charIndex: number) => void,
      onEnd: () => void,
      onError?: (msg: string) => void
    ) => {
      cancel();
      if (!text) return;
      if (!TTS_ENABLED) { onEnd(); return; }
      const id = ++reqRef.current;

      try {
        const ctx = (ctxRef.current ??= new AudioContext());
        if (ctx.state === "suspended") await ctx.resume();

        let buf = cacheRef.current.get(text);
        if (!buf) {
          // kuota habis: jangan panggil API lagi sampai waktunya pulih
          const wait = blockedUntilRef.current - Date.now();
          if (wait > 0) {
            const m = `Voice dinonaktifkan sementara: kuota Gemini TTS habis. Pulih sekitar ${fmtWait(wait)} lagi.`;
            console.log("[TTS-NOTICE]", m);
            onError?.(m);
            emitVoiceNotice(m);
            onEnd();
            return;
          }

          // 2. OPER apiKey KE FUNGSI getGeminiClient
          const ai = getGeminiClient(apiKey); 
          const res = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
          });
          if (id !== reqRef.current) return;

          const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!b64) throw new Error("TTS kosong");

          const bin = atob(b64);
          const pcm = new Int16Array(bin.length >> 1);
          for (let i = 0; i < pcm.length; i++) {
            pcm[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16;
          }
          buf = ctx.createBuffer(1, pcm.length, 24000);
          const ch = buf.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
          cacheRef.current.set(text, buf);
        }

        const analyser = (analyserRef.current ??= (() => {
          const a = ctx.createAnalyser();
          a.fftSize = 1024;
          a.connect(ctx.destination);
          return a;
        })());

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(analyser);
        srcRef.current = src;

        const { cum, tot } = buildCum(text);
        const { start, end } = trimBounds(buf.getChannelData(0), buf.sampleRate);
        const duration = Math.max(0.1, end - start);

        // cari indeks karakter dari progres waktu (berbobot)
        const idxAt = (p: number) => {
          const target = Math.min(1, Math.max(0, p)) * tot;
          let lo = 0, hi = cum.length - 1;
          while (lo < hi) {
            const m = (lo + hi) >> 1;
            if (cum[m] < target) lo = m + 1; else hi = m;
          }
          return lo;
        };

        const startAt = ctx.currentTime;
        playingRef.current = true;
        timerRef.current = setInterval(() => {
          const p = (ctx.currentTime - startAt) / duration;
          const ci = Math.min(text.length - 1, idxAt(p));
          onWord(ci, ci); // dua-duanya diisi, jadi callback (ci) maupun (_wi, ci) benar
        }, 40);

        src.onended = () => {
          if (id !== reqRef.current) return;
          stopAll();
          onWord(text.length, text.length);
          onEnd();
        };
        src.start(0, start, duration);
      } catch (e: any) {
        console.warn("[TTS] Gemini gagal:", e);

        const raw = String(e?.message ?? e);
        let msg = `Voice gagal: ${raw.slice(0, 140)}`;

        if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
          const m = raw.match(/"retryDelay":"(\d+)s"/);
          const secs = m ? Number(m[1]) : 3600;
          blockedUntilRef.current = Date.now() + secs * 1000;
          msg = `Kuota harian Gemini TTS habis (free tier: 10 request/hari). Pulih sekitar ${fmtWait(secs * 1000)} lagi. Matikan VOICE CHAT di Settings kalau tidak ingin melihat pesan ini.`;
        }

        // notifikasi selalu dikirim, walau request ini sudah digantikan request lain
        console.log("[TTS-NOTICE]", msg);
        onError?.(msg);
        emitVoiceNotice(msg);

        if (id === reqRef.current) { stopAll(); onEnd(); }
      }
    },
    [cancel, apiKey] // 3. TAMBAHKAN apiKey KE DEPENDENSI
  );

  // RMS amplitudo asli; -1 kalau tidak sedang bicara
  const getLevel = useCallback(() => {
    const a = analyserRef.current;
    if (!playingRef.current || !a) return -1;
    a.getByteTimeDomainData(dataRef.current);
    let s = 0;
    for (const v of dataRef.current) { const x = (v - 128) / 128; s += x * x; }
    return Math.sqrt(s / dataRef.current.length);
  }, []);

  return { speak, cancel, getLevel };
}