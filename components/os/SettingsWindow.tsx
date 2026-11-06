// components/os/SettingsWindow.tsx
"use client";

import { useRef } from "react";
import type { AppSettings } from "@/lib/settings";
interface Props {
  onClose: () => void;
  onUploadCharacter: (e: React.ChangeEvent<HTMLInputElement>) => void;
  settings: AppSettings;
  onChangeSettings: (patch: Partial<AppSettings>) => void;
}

const RES_PRESETS = [
  { label: "RENDAH", cols: 100 },
  { label: "SEDANG", cols: 140 },
  { label: "TINGGI", cols: 180 },
  { label: "ULTRA", cols: 220 },
];

export default function SettingsWindow({ onClose, onUploadCharacter, settings, onChangeSettings }: Props) {
  const charInputRef = useRef<HTMLInputElement>(null);

  // Fungsi manggil Text Editor bawaan Linux
  const openFile = (fileName: string) => {
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.openNativeEditor) {
      // @ts-ignore
      window.electronAPI.openNativeEditor(fileName);
    } else {
      alert("Fitur ini hanya berjalan di dalam Electron!");
    }
  };

  const iconBoxStyle = "w-16 h-16 flex items-center justify-center bg-[#111] border border-white/20 group-hover:border-white/60 transition-colors relative";

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[600px] h-[520px] bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      
      {/* Title Bar */}
      <div className="h-10 bg-black border-b border-white/20 flex items-center justify-between px-4 select-none shrink-0">
        <div className="flex items-center gap-2 text-white font-medium text-sm tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          System Settings
        </div>
        
        <button 
          onClick={onClose} 
          className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:bg-red-500 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

<div className="flex-1 p-6 overflow-y-auto flex flex-col">
        <div className="flex gap-8">
          
          {/* FILE 1: ENV.LOCAL */}
          <div onClick={() => openFile('.env.local')} className="flex flex-col items-center gap-2 cursor-pointer group w-20">
            <div className={iconBoxStyle}>
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/50"></div>
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/50"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70 group-hover:text-white transition-colors">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <span className="text-[10px] text-center text-white/50 group-hover:text-white transition-colors font-mono tracking-wider w-full truncate uppercase">
              env.local
            </span>
          </div>

          {/* FILE 2: AI.MODEL */}
          <div onClick={() => openFile('lib/gemini/client.ts')} className="flex flex-col items-center gap-2 cursor-pointer group w-20">
            <div className={iconBoxStyle}>
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/50"></div>
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/50"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70 group-hover:text-white transition-colors">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="1" x2="9" y2="4"></line>
                <line x1="15" y1="1" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="23"></line>
                <line x1="15" y1="20" x2="15" y2="23"></line>
                <line x1="20" y1="9" x2="23" y2="9"></line>
                <line x1="20" y1="14" x2="23" y2="14"></line>
                <line x1="1" y1="9" x2="4" y2="9"></line>
                <line x1="1" y1="14" x2="4" y2="14"></line>
              </svg>
            </div>
            <span className="text-[10px] text-center text-white/50 group-hover:text-white transition-colors font-mono tracking-wider w-full truncate uppercase">
              client.ts
            </span>
          </div>

          {/* FILE 3: KARAKTER */}
          <div onClick={() => charInputRef.current?.click()} className="flex flex-col items-center gap-2 cursor-pointer group w-20">
            <div className={iconBoxStyle}>
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/50"></div>
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/50"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70 group-hover:text-white transition-colors">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span className="text-[10px] text-center text-white/50 group-hover:text-white transition-colors font-mono tracking-wider w-full truncate uppercase">
              character.png
            </span>
          </div>

          <input type="file" accept="image/*" ref={charInputRef} onChange={onUploadCharacter} className="hidden" />
        </div>

        {/* PENGATURAN KARAKTER */}
<div className="mt-6 border-t border-white/10 pt-5 flex flex-col gap-5 font-mono">

  {/* Resolusi */}
  <div>
    <div className="flex justify-between text-[10px] tracking-widest text-white/60 mb-2">
      <span>RESOLUSI KARAKTER</span>
      <span className="text-white/40">{settings.cols} KOLOM</span>
    </div>
    <div className="flex gap-2">
      {RES_PRESETS.map((p) => (
        <button
          key={p.cols}
          onClick={() => onChangeSettings({ cols: p.cols })}
          className={`flex-1 py-1.5 text-[10px] tracking-widest border transition-colors ${
            settings.cols === p.cols
              ? "bg-white text-black border-white"
              : "text-white/60 border-white/20 hover:border-white/60 hover:text-white"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
    <p className="text-[9px] text-white/30 mt-1">Makin tinggi makin detail, tapi makin berat.</p>
  </div>

  {/* Ukuran */}
  <div>
    <div className="flex justify-between text-[10px] tracking-widest text-white/60 mb-2">
      <span>UKURAN KARAKTER</span>
      <span className="text-white/40">{settings.size}px</span>
    </div>
    <input
      type="range"
      min={500}
      max={1300}
      step={10}
      value={settings.size}
      onChange={(e) => onChangeSettings({ size: Number(e.target.value) })}
      className="w-full accent-white"
    />
  </div>

  {/* Voice */}
  <div className="flex items-center justify-between">
    <span className="text-[10px] tracking-widest text-white/60">VOICE CHAT</span>
    <button
      onClick={() => onChangeSettings({ voice: !settings.voice })}
      className={`px-4 py-1.5 text-[10px] tracking-widest border transition-colors ${
        settings.voice
          ? "bg-white text-black border-white"
          : "text-white/60 border-white/20 hover:border-white/60"
      }`}
    >
      {settings.voice ? "ON" : "OFF"}
    </button>
  </div>
</div>
        
        <p className="text-[10px] text-white/30 text-center mt-auto pb-4">
          *Klik file untuk membukanya di aplikasi Text Editor bawaan Linux.
        </p>
      </div>
    </div>
  );
}