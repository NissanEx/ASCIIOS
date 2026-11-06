// components/os/TopBar.tsx
"use client";

import { useState, useRef } from "react";

interface Props {
  onOpenChat: () => void;
  onUploadCharacter: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogout: () => void; // Hapus API Key
  onQuitApp: () => void; // Keluar dari aplikasi
}

export default function TopBar({ onOpenChat, onUploadCharacter, onLogout, onQuitApp }: Props) {
  const [activeMenu, setActiveMenu] = useState<"settings" | "power" | null>(null);
  const charInputRef = useRef<HTMLInputElement>(null);

  const chamferStyle = {
    clipPath:
      "polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)",
  };

  return (
    <header className="absolute top-0 w-full h-7 bg-black/80 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-4 text-xs tracking-widest z-[100] select-none">
      
      {/* KIRI: Tombol Chat Saja */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenChat}
          className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer rounded-sm border border-transparent hover:border-white/20"
          title="Chat Interface"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/>
            <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
            <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>
          </svg>
        </button>
      </div>

      {/* KANAN: Hanya Settings & Power */}
      <div className="relative flex gap-4 justify-self-end items-center">
        
        {/* Tombol Settings */}
        <button onClick={() => setActiveMenu(prev => prev === "settings" ? null : "settings")} className={`p-1 rounded transition-all cursor-pointer ${activeMenu === 'settings' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>

        {/* Tombol Power */}
        <button onClick={() => setActiveMenu(prev => prev === "power" ? null : "power")} className={`p-1 rounded transition-all cursor-pointer ${activeMenu === 'power' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Power">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
        </button>

        {/* Dropdown Menu */}
        {activeMenu && (
          <div className={`absolute top-8 right-0 w-64 bg-[#333] p-[1px] z-[110]`} style={chamferStyle} onClick={(e) => e.stopPropagation()}>
            <div className="w-full h-full bg-[#0a0a0a]/95 backdrop-blur-xl p-3 flex flex-col gap-2 cursor-default" style={chamferStyle}>
              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1 text-[10px] text-white/50 uppercase tracking-[0.2em]">
                <span>{activeMenu === "settings" ? "Pengaturan" : "Power"}</span>
                <button onClick={() => setActiveMenu(null)} className="hover:text-red-400 cursor-pointer transition-colors p-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {activeMenu === "settings" && (
                <div className="flex flex-col gap-2 text-[11px] text-white/70">
                  <button onClick={() => charInputRef.current?.click()} className="border border-white/20 hover:bg-white hover:text-black py-2 rounded transition-colors cursor-pointer flex items-center justify-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    Ganti Karakter
                  </button>
                  <input type="file" accept="image/*" ref={charInputRef} onChange={onUploadCharacter} className="hidden" />
                  
                  <button onClick={() => { onLogout(); setActiveMenu(null); }} className="border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white py-2 rounded transition-colors cursor-pointer flex items-center justify-center gap-2 mt-1">
                      Logout API Key
                  </button>
                </div>
              )}

              {activeMenu === "power" && (
                <div className="flex flex-col gap-2 text-[11px] text-white/70">
                  <button onClick={onQuitApp} className="border border-white/20 hover:bg-red-500 hover:text-white hover:border-red-500 py-2 rounded transition-colors cursor-pointer flex items-center justify-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Keluar Aplikasi
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}