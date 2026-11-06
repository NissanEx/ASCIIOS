// components/os/AppLauncherWindow.tsx
"use client";

import { useState, useRef } from "react";

type AppDef = {
  id: string;
  name: string;
  icon?: string;
};

interface Props {
  apps: AppDef[];
  pinnedApps: string[];
  onTogglePin: (id: string) => void;
  onOpenApp: (id: string) => void;
  onClose: () => void;
}

export default function AppLauncherWindow({ 
  apps, 
  pinnedApps, 
  onTogglePin, 
  onOpenApp, 
  onClose, 
}: Props) {
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false); 
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Tambahkan pengaman typeof window
  const [pos, setPos] = useState({ x: typeof window !== "undefined" ? window.innerWidth - 616 : 40, y: 40 });
  const [size, setSize] = useState({ w: 600, h: 450 });
  const isDragging = useRef(false);

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    isDragging.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;
      setPos({ x: startPosX + (event.clientX - startX), y: startPosY + (event.clientY - startY) });
    };

    const onMouseUp = (event: MouseEvent) => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      const px = event.clientX;
      const py = event.clientY;

      if (py < 40) setIsMaximized(true);
      else if (px < 50) { setIsMaximized(false); setPos({ x: 0, y: 24 }); setSize({ w: window.innerWidth / 2, h: window.innerHeight - 24 }); }
      else if (px > window.innerWidth - 50) { setIsMaximized(false); setPos({ x: window.innerWidth / 2, y: 24 }); setSize({ w: window.innerWidth / 2, h: window.innerHeight - 24 }); }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
      setPos({ x: window.innerWidth - 616, y: 40 });
      setSize({ w: 600, h: 450 });
    } else {
      setIsMaximized(true);
    }
  };

  return (
    <div
      className="absolute z-[70] flex flex-col pointer-events-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden"
      style={{
        left: isMaximized ? 0 : pos.x,
        top: isMaximized ? 24 : pos.y,
        width: isMaximized ? '100vw' : size.w,
        height: isMaximized ? 'calc(100vh - 24px)' : size.h,
        transition: isDragging.current ? 'none' : 'all 0.2s ease-out',
      }}
    >
      
      {/* ================= TITLE BAR (DENGAN SEARCH) ================= */}
      <div 
        className="h-10 bg-black border-b border-white/20 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing select-none shrink-0"
        onMouseDown={handleMouseDown}
      >
        {/* KIRI: Ikon, Judul, & Search Input */}
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          
          {/* Ikon Grid (Hilang kalau search dibuka) */}
          {!isSearchOpen && (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 shrink-0">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          )}

          {/* Teks Judul ATAU Input Search */}
          {isSearchOpen ? (
            <input
              autoFocus
              type="text"
              placeholder="Cari aplikasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => { if (!search) setIsSearchOpen(false); }} // Tutup otomatis kalau kosong
              className="bg-transparent border-none text-white text-sm outline-none w-full placeholder:text-white/30 cursor-text"
              onMouseDown={(e) => e.stopPropagation()} // Biar bisa diklik, nggak kena drag
            />
          ) : (
            <span className="text-white/80 font-medium text-sm tracking-wide shrink-0">App Launcher</span>
          )}
        </div>

        {/* KANAN: Tombol Aksi */}
        <div className="flex items-center gap-2 cursor-default shrink-0" onMouseDown={(e) => e.stopPropagation()}>
           
           {/* Tombol Search (Kaca Pembesar) */}
           <button 
             onClick={() => setIsSearchOpen(!isSearchOpen)} 
             className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${isSearchOpen ? 'text-white bg-white/20' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
             title="Search"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <circle cx="11" cy="11" r="8"></circle>
               <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
             </svg>
           </button>

           {/* Tombol Maximize */}
           <button 
             onClick={toggleMaximize} 
             className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors"
             title={isMaximized ? "Restore" : "Maximize"}
           >
             {isMaximized ? "❐" : "□"}
           </button>

           {/* Tombol Close */}
           <button 
             onClick={onClose} 
             className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:bg-red-500 hover:text-white transition-colors"
           >
             ✕
           </button>
        </div>
      </div>

      {/* ================= BODY / GRID (CUMA ICON) ================= */}
      <div className="flex-1 p-6 overflow-y-auto relative flex flex-col min-h-0 custom-scrollbar bg-transparent">
        
        {/* Grid Ikon */}
        <div className={`grid gap-y-6 gap-x-4 ${isMaximized ? 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12' : (size.w === window.innerWidth / 2 ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-5')}`}>
          {filteredApps.length === 0 ? (
            <div className="col-span-full text-center text-white/30 text-xs font-mono mt-10 tracking-widest">
              [ APLIKASI TIDAK DITEMUKAN ]
            </div>
          ) : (
            filteredApps.map((app) => {
              const isPinned = pinnedApps.includes(app.id);
              return (
                <div
                  key={app.id}
                  onClick={() => onOpenApp(app.id)}
                  title={app.name}
                  className="relative group flex flex-col items-center justify-center p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer aspect-square"
                >
                  {/* Tombol Pin */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(app.id);
                    }}
                    className="absolute top-1 right-1 text-[9px] w-5 h-5 flex items-center justify-center bg-black/60 rounded text-white/40 hover:text-white hover:bg-white/20 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={isPinned ? "Lepas Pin" : "Pin ke Dock"}
                  >
                    {isPinned ? "✕" : "+"}
                  </button>

                  {/* Ikon Asli */}
                  <div className="w-12 h-12 flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95">
                    {app.icon ? (
                      <img 
                        src={app.icon} 
                        alt={app.name} 
                        className="w-full h-full object-contain drop-shadow-md" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const nextSibling = e.currentTarget.nextElementSibling;
                          if (nextSibling) nextSibling.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    
                    {/* Fallback Huruf Depan */}
                    <div className={`w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-lg ${app.icon ? 'hidden' : 'flex'}`}>
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Scrollbar Style */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}