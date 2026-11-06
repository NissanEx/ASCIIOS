// app/page.tsx
"use client";

import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { useState, useEffect, useRef, useMemo } from "react";
import LiveAsciiFace from "@/components/chat/LiveAsciiFace";
import ChatWindow from "@/components/chat/ChatWindow";
import TopBar from "@/components/os/TopBar";
import ClockVisualizer from "@/components/os/ClockVisualizer";
import { useFaceLandmarks, type Landmark } from "@/hooks/useFaceLandmarks";
import { useGeminiChat } from "@/hooks/useGeminiChat";
import { getPose } from "@/hooks/useBodyPose";
import { parseReply } from "@/lib/parseReply";

const CHAR_MS = 68;
const DB_NAME = "AsciiOS_DB";
const STORE_NAME = "settings";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (key: string, value: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(value, key);
};

const getFromDB = async (key: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || null);
  });
};
function SetupPanel() {
  const [characterSrc, setCharacterSrc] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isMounted, setIsMounted] = useState(false);

  const [sliderSize, setSliderSize] = useState(settings.size);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  const { landmarks, mask, detect } = useFaceLandmarks();
  const detectRef = useRef(detect);
  detectRef.current = detect;

  useEffect(() => {
    setIsMounted(true);
    getFromDB("character").then((saved) => {
      if (saved) {
        setCharacterSrc(saved); 
        const img = new Image();
        img.src = saved;
        img.onload = () => detectRef.current(img);
      } 
    });
    const loaded = loadSettings();
    setSettings(loaded);
    setSliderSize(loaded.size); 
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setCharacterSrc(base64);
      await saveToDB("character", base64);
      const img = new Image();
      img.src = base64;
      img.onload = () => detectRef.current(img);
    };
    reader.readAsDataURL(file);
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (!patch.size) saveSettings(next); 
      return next;
    });
  };

  const handleSliderSave = () => {
    saveSettings({ ...settings, size: sliderSize });
  };

  if (!isMounted) return null;

  return (
    <main className="w-screen h-screen bg-black text-white flex flex-col font-sans select-none overflow-hidden relative">
      
      <div className="w-full h-full max-w-[1600px] mx-auto flex flex-col relative z-10">
        
        {/* HEADER */}
        <header className="flex justify-between items-center px-8 lg:px-12 py-6 z-40">
          <div className="text-lg font-bold tracking-[0.3em] text-white">ASCII<span className="text-gray-600">OS</span></div>

          <div className="flex gap-6 lg:gap-8 text-[10px] lg:text-[11px] tracking-widest font-bold text-gray-400">
            <label className="hover:text-white transition-colors cursor-pointer">
              UPLOAD
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>

            {/* MISSION = Launcher */}
            <div className="relative">
              <button
                onClick={() => setIsLauncherOpen((v) => !v)}
                className={`transition-colors cursor-pointer ${isLauncherOpen ? "text-white" : "hover:text-white"}`}
              >
                MISSION
              </button>

              {isLauncherOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLauncherOpen(false)} />
                  <div className="absolute top-7 right-0 w-44 bg-[#0a0a0a] border border-white/20 flex flex-col text-[10px] tracking-widest font-bold z-50">
                    <button
                     onClick={() => {
  (window as any).electronAPI?.openChat?.();
  setIsLauncherOpen(false);
}}
                      className="text-left px-4 py-3 text-gray-300 hover:bg-white hover:text-black transition-colors cursor-pointer"
                    >
                      CHAT
                    </button>
                    <button
                      onClick={() => {
                        (window as any).electronAPI?.openTerminal?.();
                        setIsLauncherOpen(false);
                      }}
                      className="text-left px-4 py-3 text-gray-300 hover:bg-white hover:text-black transition-colors cursor-pointer border-t border-white/10"
                    >
                      TERMINAL
                    </button>
                  </div>
                </>
              )}
            </div>

            <span className="hover:text-white transition-colors cursor-pointer">ABOUT</span>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex items-center justify-between px-8 lg:px-12 w-full overflow-hidden">
          
          {/* KIRI: Teks & Kontrol */}
          <div className="w-[35%] max-w-[400px] flex flex-col justify-center flex-shrink-0 z-20">
            <h1 className="text-4xl lg:text-5xl font-light tracking-wide mb-5 leading-[1.15]">
              TAKING<br />CHARACTERS<br />TO DESKTOP
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed mb-8 max-w-sm">
              In 2026, ASCII OS returned the ability to turn your favorite images into live, interactive desktop companions. The engine uses advanced face landmarks to bring your character to life.
            </p>

            <div className="flex flex-col gap-5 mb-8 w-full max-w-[320px]">
               <div>
                  <span className="text-[9px] text-gray-500 mb-2 block tracking-widest font-bold">RESOLUTION (COLS)</span>
                  <div className="flex gap-2">
{[80, 120, 160, 200].map(cols => (
                      <button key={cols} onClick={() => updateSettings({ cols })} className={`flex-1 py-1.5 text-[11px] border transition-colors ${settings.cols === cols ? 'border-white bg-white text-black font-bold' : 'border-gray-800 text-gray-400 hover:border-gray-500'}`}>{cols}</button>
                    ))}
                  </div>
               </div>
               
               <div>
                  <div className="flex justify-between text-[9px] text-gray-500 mb-1.5 tracking-widest font-bold">
                    <span>CHARACTER SIZE</span>
                    <span className="text-white">{sliderSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min={400} 
                    max={1000} 
                    step={10} 
                    value={sliderSize} 
                    onChange={(e) => setSliderSize(Number(e.target.value))} 
                    onMouseUp={() => {
                      updateSettings({ size: sliderSize });
                      handleSliderSave();
                    }}
                    onTouchEnd={() => {
                      updateSettings({ size: sliderSize });
                      handleSliderSave();
                    }}
                    className="w-full accent-white cursor-pointer" 
                  />
                  
               </div>
                              <div>
                  <span className="text-[9px] text-gray-500 mb-2 block tracking-widest font-bold">VOICE (TTS)</span>
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => updateSettings({ voice: v })}
                        className={`flex-1 py-1.5 text-[11px] border transition-colors ${!!settings.voice === v ? 'border-white bg-white text-black font-bold' : 'border-gray-800 text-gray-400 hover:border-gray-500'}`}
                      >
                        {v ? "ON" : "OFF"}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="flex gap-3">
               <button 
                  onClick={() => {
                    // @ts-ignore
                    window.electronAPI?.toggleLiveWallpaper?.();
                  }}
                  className="bg-white text-black px-6 py-2.5 text-[10px] font-bold tracking-widest hover:bg-gray-200 transition-colors cursor-pointer"
               >
                  SET AS WALLPAPER
               </button>
               
               <label className="border border-gray-700 text-white px-6 py-2.5 text-[10px] font-bold tracking-widest hover:border-white transition-colors cursor-pointer flex items-center justify-center">
                  UPLOAD IMAGE
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
               </label>
            </div>
          </div>

          {/* KANAN: Live Preview Karakter */}
          <div className="w-[65%] h-full flex justify-center items-center relative flex-shrink-0 overflow-hidden">
             <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none"></div>
             
             {characterSrc ? (
               <div className="flex justify-center items-center z-0 h-full w-full">
                 <div style={{ width: '100%', maxWidth: sliderSize }}>
                   <LiveAsciiFace
                      imageSrc={characterSrc}
                      landmarks={landmarks}
                      bodyLandmarks={null}
                      mask={mask}
                      state="idle"
                      expression="neutral"
                      speech=""
                      cues={[]}
                      cols={settings.cols}
                      voiceEnabled={false}
                    />
                 </div>
               </div>
             ) : (
               <div className="text-gray-700 text-xs tracking-widest z-20">[ NO CHARACTER UPLOADED ]</div>
             )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="w-full flex justify-center gap-3 pb-6 z-20">
          <div className="w-8 h-1 bg-white rounded-full"></div>
          <div className="w-2 h-1 bg-gray-700 rounded-full"></div>
          <div className="w-2 h-1 bg-gray-700 rounded-full"></div>
        </div>
        
      </div>
    </main>
  );
}
// ==========================================
// 2. HALAMAN WALLPAPER (Hanya Wajah & Jam)
// ==========================================
function WallpaperOnly() {
  const [characterSrc, setCharacterSrc] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const { landmarks, mask, detect } = useFaceLandmarks();
  const detectRef = useRef(detect);
  detectRef.current = detect;
    const [face, setFace] = useState<{ state: "idle" | "thinking" | "talking"; expression: any; text: string; cues: any[] }>(
    { state: "idle", expression: "neutral", text: "", cues: [] }
  );
  const [voiceOn, setVoiceOn] = useState(false);
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    const ch = new BroadcastChannel("ascii-os-face");
    ch.onmessage = (e) => {
      setFace(e.data);
      setVoiceOn(!!loadSettings().voice);
      setApiKey(localStorage.getItem("ascii_os_gemini_key") || undefined);
    };
    return () => ch.close();
  }, []);

  useEffect(() => {
    getFromDB("character").then((saved) => {
      if (!saved) return;
      setCharacterSrc(saved);
      const img = new Image();
      img.src = saved;
      img.onload = () => detectRef.current(img);
    });
    setSettings(loadSettings());
    
    // Trigger animasi fade-in setelah 100ms
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col font-mono select-none pointer-events-none">
      <div className="absolute inset-0 z-10 flex items-end justify-center overflow-hidden">
        {characterSrc ? (
          <div 
            className={`w-full h-full flex justify-center items-end transition-opacity duration-1000 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              maxWidth: settings.size,
              mixBlendMode: 'screen' // <--- KUNCI: Background hitam hilang
            }}
          >
            <LiveAsciiFace
              imageSrc={characterSrc}
              landmarks={landmarks}
              bodyLandmarks={null}
              mask={mask}
              state={face.state}
              expression={face.expression}
              speech={face.text}
              cues={face.cues}
              cols={settings.cols}
              voiceEnabled={voiceOn}
              apiKey={apiKey}
            />
          </div>
        ) : null}
      </div>
      <ClockVisualizer isTalking={face.state === "talking"} />
    </main>
  );
}

// ==========================================
// 3. JENDELA UTAMA OS (Chat & Karakter)
// ==========================================
function AsciiOS() {
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedKey = localStorage.getItem("ascii_os_gemini_key");
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const handleLogin = () => {
    if (!inputKey.trim()) return;
    localStorage.setItem("ascii_os_gemini_key", inputKey.trim());
    setUserApiKey(inputKey.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem("ascii_os_gemini_key");
    setUserApiKey(null);
    setInputKey("");
  };

  const { landmarks, mask, detect } = useFaceLandmarks();
  const { messages, sendMessage, isLoading, error } = useGeminiChat(userApiKey || undefined);

  const [characterSrc, setCharacterSrc] = useState<string | null>(null);
  const [isCharReady, setIsCharReady] = useState(false);
  const [bodyLm, setBodyLm] = useState<Landmark[] | null>(null);
  const [faceState, setFaceState] = useState<"idle" | "thinking" | "talking">("idle");

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPos, setChatPos] = useState({ x: 50, y: 50 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => { setSettings(loadSettings()); }, []);
  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const detectRef = useRef(detect);
  detectRef.current = detect;

  useEffect(() => {
    getFromDB("character").then((savedChar) => {
      if (savedChar) { setCharacterSrc(savedChar); processFaceDetection(savedChar); }
    });
  }, []);

  useEffect(() => {
    if (characterSrc && mask) {
      setIsCharReady(true);
    } else if (characterSrc && !mask) {
      const timer = setTimeout(() => setIsCharReady(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [characterSrc, mask]);

  const processFaceDetection = async (base64: string) => {
    setIsCharReady(false);
    const img = new Image();
    img.src = base64;
    img.onload = async () => {
      detectRef.current(img);
      try {
        const r = (await getPose()).detect(img);
        setBodyLm(r.landmarks[0] ?? null);
      } catch (err) { setBodyLm(null); }
    };
  };

  const reply = useMemo(() => {
    const last = messages[messages.length - 1];
    return last && last.role === "model" ? parseReply(last.text) : { text: "", expression: "neutral" as const, cues: [] };
  }, [messages]);

  useEffect(() => {
    if (isLoading) setFaceState("thinking");
    else if (messages.length > 0 && messages[messages.length - 1].role === "model") {
      setFaceState("talking");
      const duration = Math.max(1500, reply.text.length * CHAR_MS + 800);
      const timer = setTimeout(() => setFaceState("idle"), duration);
      return () => clearTimeout(timer);
    } else { setFaceState("idle"); }
  }, [isLoading, messages, reply.text.length]);

  const handleCharacterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsCharReady(false);
      setCharacterSrc(base64);
      await saveToDB("character", base64);
      processFaceDetection(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - chatPos.x, y: e.clientY - chatPos.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) setChatPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  };
  const handleMouseUp = () => { isDragging.current = false; };

  if (!isMounted) return <div className="w-screen h-screen bg-black" />;

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-black flex flex-col font-mono select-none text-white"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute inset-0 z-10 flex items-end justify-center pointer-events-none overflow-hidden">
        {characterSrc ? (
          isCharReady ? (
            <div className="w-full h-full flex justify-center items-end" style={{ maxWidth: settings.size }}>
              <LiveAsciiFace
                imageSrc={characterSrc}
                landmarks={landmarks}
                bodyLandmarks={bodyLm}
                mask={mask}
                state={faceState}
                expression={reply.expression}
                speech={reply.text}
                cues={reply.cues}
                cols={settings.cols}
                voiceEnabled={settings.voice}
                apiKey={userApiKey || undefined}
              />
            </div>
          ) : (
            <div className="text-white/40 text-sm tracking-widest animate-pulse pb-10">[ PROCESSING_CHARACTER... ]</div>
          )
        ) : (
          <div className="text-white/20 text-sm tracking-widest animate-pulse pb-10">[ NO CHARACTER ]</div>
        )}
      </div>

      <ClockVisualizer isTalking={faceState === "talking"} />

      {/* TOP BAR BARU (Hanya 4 Props) */}
      <TopBar
        onUploadCharacter={handleCharacterUpload}
        onLogout={handleLogout}
        onOpenChat={() => setIsChatOpen(true)}
        onQuitApp={() => {
          // @ts-ignore
          window.electronAPI?.quitApp?.() || window.close();
        }}
      />

      {isChatOpen && (
        <div
          className="absolute z-[60] w-[450px] h-[600px] bg-[#0a0a0a] border border-white/20 shadow-2xl flex flex-col overflow-hidden"
          style={{ left: chatPos.x, top: chatPos.y }}
        >
          <div
            className="h-10 bg-black border-b border-white/20 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing select-none shrink-0"
            onMouseDown={handleMouseDown}
          >
            <div className="text-white/80">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
                <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>
              </svg>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="w-6 h-6 flex items-center justify-center rounded text-white/50 hover:bg-red-500 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-black relative">
            {!userApiKey ? (
              <div className="w-full h-full flex flex-col justify-center p-6 bg-[#0a0a0a] relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                     style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <div className="z-10 flex items-center gap-3 mb-6 border-b border-white/30 pb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <h1 className="text-xl font-bold tracking-widest text-green-400">AUTH_REQUIRED</h1>
                </div>

                <p className="z-10 text-xs text-gray-400 mb-6 leading-relaxed">
                  Sistem ini menggunakan BYOK (Bring Your Own Key). Silakan masukkan Gemini API Key lu untuk menggunakan fitur chat. Dapetin gratis di <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">Google AI Studio</a>.
                </p>

                <div className="z-10 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 tracking-widest">GEMINI_API_KEY</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                      className="w-full bg-[#0a0a0a] border border-white/30 p-3 text-sm outline-none focus:border-green-400 transition-colors placeholder:text-gray-700 text-white"
                      autoFocus
                    />
                  </div>
                  <button onClick={handleLogin} className="mt-2 w-full border border-white/50 bg-[#0a0a0a] hover:bg-white hover:text-black py-3 text-sm tracking-widest font-bold transition-all">
                    [ MOUNT_OS ]
                  </button>
                </div>
              </div>
            ) : (
             <ChatWindow messages={messages} sendMessage={sendMessage} isLoading={isLoading} error={error} allApps={[]} />
            )}
          </div>
          
        </div>

        
      )}
    </main>
  );
}
// ==========================================
// 4. JENDELA CHAT TERPISAH (mode=chat)
// ==========================================
function ChatOnly() {
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [allApps, setAllApps] = useState<{ id: string; name: string; icon?: string; nativeCommand?: string }[]>([]);
  const { messages, sendMessage, isLoading, error } = useGeminiChat(userApiKey || undefined);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    channelRef.current = new BroadcastChannel("ascii-os-face");
    return () => channelRef.current?.close();
  }, []);

  const reply = useMemo(() => {
    const last = messages[messages.length - 1];
    return last && last.role === "model"
      ? parseReply(last.text)
      : { text: "", expression: "neutral" as const, cues: [] };
  }, [messages]);

  const [faceState, setFaceState] = useState<"idle" | "thinking" | "talking">("idle");
  useEffect(() => {
    if (isLoading) setFaceState("thinking");
    else if (messages.length > 0 && messages[messages.length - 1].role === "model") {
      setFaceState("talking");
      const duration = Math.max(1500, reply.text.length * CHAR_MS + 800);
      const timer = setTimeout(() => setFaceState("idle"), duration);
      return () => clearTimeout(timer);
    } else setFaceState("idle");
  }, [isLoading, messages, reply.text.length]);

  useEffect(() => {
    channelRef.current?.postMessage({
      state: faceState,
      expression: reply.expression,
      text: reply.text,
      cues: reply.cues,
    });
  }, [faceState, reply]);
  useEffect(() => {
    const k = localStorage.getItem("ascii_os_gemini_key");
    if (k) setUserApiKey(k);

    (window as any).electronAPI?.getSystemApps?.()
      .then((apps: any[]) =>
        setAllApps(apps.map((a) => ({ id: a.id, name: a.name, icon: a.icon, nativeCommand: a.command })))
      )
      .catch(() => {});
  }, []);

  const handleLogin = () => {
    if (!inputKey.trim()) return;
    localStorage.setItem("ascii_os_gemini_key", inputKey.trim());
    setUserApiKey(inputKey.trim());
  };
  const handleLogout = () => {
    localStorage.removeItem("ascii_os_gemini_key");
    setUserApiKey(null);
    setInputKey("");
  };

  return (
    <main className="w-screen h-screen bg-[#0a0a0a] text-white flex flex-col font-mono overflow-hidden">
      {!userApiKey ? (
        <div className="w-full h-full flex flex-col justify-center p-6">
          <h1 className="text-xl font-bold tracking-widest text-green-400 mb-4 border-b border-white/30 pb-3">AUTH_REQUIRED</h1>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            Masukkan Gemini API Key (BYOK). Dapatkan gratis di{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">Google AI Studio</a>.
          </p>
          <label className="text-[10px] text-gray-500 tracking-widest mb-1">GEMINI_API_KEY</label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            className="w-full bg-[#0a0a0a] border border-white/30 p-3 text-sm outline-none focus:border-green-400 text-white"
            autoFocus
          />
          <button onClick={handleLogin} className="mt-4 w-full border border-white/50 hover:bg-white hover:text-black py-3 text-sm tracking-widest font-bold transition-all">
            [ MOUNT_OS ]
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <ChatWindow messages={messages} sendMessage={sendMessage} isLoading={isLoading} error={error} allApps={allApps} />
          </div>
          <button onClick={handleLogout} className="shrink-0 text-[10px] tracking-widest text-red-400/70 hover:text-red-400 py-1 border-t border-white/10">
            LOGOUT API KEY
          </button>
        </>
      )}
    </main>
  );
}

// ==========================================
// ROUTER UTAMA
// ==========================================
export default function Page() {
  const [mode, setMode] = useState<"loading" | "os" | "wallpaper" | "setup" | "chat">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    if (m === "wallpaper") setMode("wallpaper");
    else if (m === "setup") setMode("setup");
    else if (m === "chat") setMode("chat");
    else setMode("os");
  }, []);

  if (mode === "loading") return null;
  if (mode === "wallpaper") return <WallpaperOnly />;
  if (mode === "setup") return <SetupPanel />;
  if (mode === "chat") return <ChatOnly />;
  return <AsciiOS />;
}