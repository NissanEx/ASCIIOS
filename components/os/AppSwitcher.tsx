// components/os/AppSwitcher.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  onClose: () => void;
}

export default function AppSwitcher({ onClose }: Props) {
  const [windows, setWindows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWindows = async () => {
      // @ts-ignore
      if (window.electronAPI) {
        // @ts-ignore
        const wins = await window.electronAPI.getRunningWindows();
        setWindows(wins);
      }
      setLoading(false);
    };
    fetchWindows();
  }, []);

  const handleFocus = (id: string) => {
    // @ts-ignore
    if (window.electronAPI) {
      // @ts-ignore
      window.electronAPI.focusWindow(id);
    }
    onClose();
  };

  // Fungsi buat ngatur tata letak
  const handleArrange = (e: React.MouseEvent, id: string, action: string) => {
    e.stopPropagation(); // Biar jendela gak langsung fokus (tutup switcher)
    // @ts-ignore
    if (window.electronAPI) {
      // @ts-ignore
      window.electronAPI.arrangeWindow(id, action);
    }
  };

  return (
    <div 
      className="absolute inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-white/20 p-6 rounded-xl shadow-2xl w-[700px] max-w-[90vw] max-h-[80vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-sm font-bold mb-4 tracking-[0.2em] border-b border-white/10 pb-2 flex justify-between items-center">
          <span>RUNNING APPLICATIONS (MULTITASKING)</span>
          <span className="text-white/30 text-[10px]">[ SUPER + TAB ]</span>
        </h2>
        
        {loading ? (
          <div className="text-white/50 animate-pulse text-center py-4 text-sm">Scanning windows...</div>
        ) : windows.length === 0 ? (
          <div className="text-white/50 text-center py-4 text-sm">No other windows open.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {windows.map((win) => (
              <div
                key={win.id}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg transition-all group"
              >
                {/* Info Jendela */}
                <button
                  onClick={() => handleFocus(win.id)}
                  className="flex flex-col items-start text-left flex-1 min-w-0 pr-4"
                >
                  <span className="text-white/90 font-medium truncate w-full group-hover:text-white text-sm">
                    {win.title}
                  </span>
                  <span className="text-white/30 text-[9px] mt-1 group-hover:text-white/50">
                    {win.id}
                  </span>
                </button>

                {/* Tombol Aksi Tiling */}
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={(e) => handleArrange(e, win.id, 'left')}
                    className="px-2 py-1 bg-white/5 hover:bg-white hover:text-black border border-white/20 text-white/70 rounded transition-colors text-xs font-mono"
                    title="Split Kiri"
                  >
                    [ ◧ ]
                  </button>
                  <button 
                    onClick={(e) => handleArrange(e, win.id, 'right')}
                    className="px-2 py-1 bg-white/5 hover:bg-white hover:text-black border border-white/20 text-white/70 rounded transition-colors text-xs font-mono"
                    title="Split Kanan"
                  >
                    [ ◨ ]
                  </button>
                  <button 
                    onClick={(e) => handleArrange(e, win.id, 'maximize')}
                    className="px-2 py-1 bg-white/5 hover:bg-white hover:text-black border border-white/20 text-white/70 rounded transition-colors text-xs font-mono"
                    title="Maximize"
                  >
                    [ □ ]
                  </button>
                  <button 
                    onClick={(e) => handleArrange(e, win.id, 'restore')}
                    className="px-2 py-1 bg-white/5 hover:bg-white hover:text-black border border-white/20 text-white/70 rounded transition-colors text-xs font-mono"
                    title="Restore"
                  >
                    [ ❐ ]
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="text-center text-white/30 text-[9px] mt-6 tracking-widest uppercase">
          Click title to focus | Click [◧/◨] to split screen
        </div>
      </div>
    </div>
  );
}