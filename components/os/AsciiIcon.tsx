// components/os/AsciiIcon.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src?: string;
  name?: string;
  size?: number; 
  className?: string;
}

const RAMP = " .:-~=+*xX#%&@";

export default function AsciiIcon({ src, name = "App", size = 4, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || error) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cols = 20; // Naikkan resolusi grid sedikit biar lebih jelas (tadi 16)
      const rows = 20;
      const offCanvas = document.createElement("canvas");
      offCanvas.width = cols;
      offCanvas.height = rows;
      const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, cols, rows);
      const data = offCtx.getImageData(0, 0, cols, rows).data;

      // Cek apakah gambar transparan semua (SVG failure)
      let hasPixels = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 10) { hasPixels = true; break; }
      }
      
      if (!hasPixels) {
        setError(true); 
        return;
      }

      const charW = size;
      const charH = size * 1.2;
      canvas.width = cols * charW;
      canvas.height = rows * charH;
      
      ctx.font = `bold ${charH}px ui-monospace, Menlo, monospace`; // Pakai 'bold' biar tegas
      ctx.textBaseline = "top";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          const a = data[i + 3];

          // Jika transparan, skip
          if (a < 128) continue;

          let lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // --- PENYESUAIAN WARNA (CLEAR, NO GLOW) ---
          // Kalau terlalu gelap (hampir hitam), angkat sedikit kecerahannya biar kelihatan di background hitam
          if (lum < 20) {
            r = 100; g = 100; b = 100; // Jadikan abu-abu sedang
            lum = 100;
          } else {
            // Boost tipis aja (1.2) biar warna aslinya nggak hilang
            const boost = 1.2; 
            r = Math.min(255, r * boost);
            g = Math.min(255, g * boost);
            b = Math.min(255, b * boost);
            lum = Math.min(255, lum * boost);
          }

          // Karakter berdasarkan luminance
          const charIdx = Math.max(1, Math.floor((lum / 255) * (RAMP.length - 1)));
          const char = RAMP[charIdx];

          if (char !== " ") {
            // Tanpa shadow/glow, murni warna tegas
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillText(char, x * charW, y * charH);
          }
        }
      }
    };
    img.onerror = () => setError(true);
  }, [src, size, error]);

  // Fallback jika gambar gagal diload
  if (!src || error) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#2a2a2a] border border-white/30 text-white font-bold text-xl ${className}`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
}