// components/chat/ChatWindow.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { VOICE_NOTICE_EVENT, getLastVoiceNotice, emitVoiceNotice } from "@/lib/voiceNotice";
import { parseReply } from "@/lib/parseReply";
import type { ChatMessage } from "@/hooks/useGeminiChat";

type AppDef = { id: string; name: string; icon?: string; nativeCommand?: string; };

interface Props {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  allApps: AppDef[]; // <-- TAMBAHKAN PROP INI
}

export default function ChatWindow({ messages, sendMessage, isLoading, error, allApps }: Props) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [sysLogs, setSysLogs] = useState<{ text: string; type: 'info' | 'error' }[]>([]);
  const recognitionRef = useRef<any>(null);

  const addLog = (text: string, type: 'info' | 'error' = 'info') => {
    setSysLogs(prev => [...prev, { text, type }]);
  };

  // ==========================================
  // 1. LOGIKA EKSEKUSI PERINTAH AI
  // ==========================================
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    if (lastMessage && lastMessage.role === "model" && !isLoading) {
      
      const executedCmds = JSON.parse(localStorage.getItem('executed_cmds') || '[]');
      if (executedCmds.includes(lastMessage.id)) return;

      const cmdRegex = /\[CMD:\s*(OPEN_APP|OPEN_URL),\s*([^\]]+)\]/g;
      let match;
      let hasExecuted = false;
      
      while ((match = cmdRegex.exec(lastMessage.text)) !== null) {
        hasExecuted = true;
        const type = match[1];
        const arg = match[2].trim();

        if (type === "OPEN_APP") {
          // Cari aplikasi asli di daftar allApps
          const foundApp = allApps.find(a => 
            a.name.toLowerCase().includes(arg.toLowerCase()) || 
            arg.toLowerCase().includes(a.name.toLowerCase())
          );

          if (foundApp && foundApp.nativeCommand) {
            addLog(`[SYS] Membuka ${foundApp.name}...`, 'info');
            // @ts-ignore
            if (window.electronAPI?.launchApp) {
              // @ts-ignore
              window.electronAPI.launchApp(foundApp.nativeCommand, foundApp.name).then((res: any) => {
                if (!res.success) {
                  addLog(`[ERROR] Gagal membuka ${foundApp.name}: ${res.error}`, 'error');
                }
              });
            }
          } else {
            addLog(`[ERROR] Aplikasi "${arg}" tidak ditemukan di sistem.`, 'error');
          }
        } 
        else if (type === "OPEN_URL") {
          addLog(`[SYS] Membuka URL: ${arg}`, 'info');
          // @ts-ignore
          if (window.electronAPI?.openUrl) {
            // @ts-ignore
            window.electronAPI.openUrl(arg);
          }
        }
      }

      if (hasExecuted) {
        executedCmds.push(lastMessage.id);
        if (executedCmds.length > 50) executedCmds.shift();
        localStorage.setItem('executed_cmds', JSON.stringify(executedCmds));
      }
    }
  }, [lastMessage, isLoading, allApps]);

  const cleanDisplayText = (text: string) => {
    return text.replace(/\[CMD:\s*(OPEN_APP|OPEN_URL),\s*([^\]]+)\]/g, "").trim();
  };
  // ==========================================

  // ... (LOGIKA MIKROFON SAMA SEPERTI SEBELUMNYA) ...
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return; 

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'id-ID';

    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInput(currentTranscript);
    };
    recognitionRef.current.onerror = (event: any) => {
      setIsListening(false);
      addLog(`[ERROR] Masalah mikrofon: ${event.error}`, "error");
    };
    recognitionRef.current.onend = () => setIsListening(false);
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.checkMic) {
      // @ts-ignore
      const micStatus = await window.electronAPI.checkMic();
      if (!micStatus.available) {
        addLog("[ERROR] Hardware mikrofon tidak terdeteksi di sistem.", "error");
        return;
      }
    }
    if (!recognitionRef.current) {
      addLog("[SYSTEM] Perangkat/mesin ini tidak mendukung fitur pengenalan suara.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); 
    } catch (err: any) {
      addLog(`[ERROR] Gagal akses mic: ${err.message}`, "error");
      return;
    }
    setInput("");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      addLog("[ERROR] Gagal memulai mic.", "error");
    }
  };
  // ==========================================

  const [voiceNotice, setVoiceNotice] = useState<string | null>(() => getLastVoiceNotice());
  useEffect(() => {
    const h = (e: Event) => setVoiceNotice((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(VOICE_NOTICE_EVENT, h);
    return () => window.removeEventListener(VOICE_NOTICE_EVENT, h);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    const val = input;
    setInput("");
    await sendMessage(val);
  };

  return (
    <div className="w-full h-full flex flex-col bg-black text-white font-mono text-sm p-2">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-2">
        {messages.map((m) => {
          const rawText = m.role === "model" ? parseReply(m.text).text : m.text;
          const cleanText = m.role === "model" ? cleanDisplayText(rawText) : rawText;
          if (!cleanText) return null;
          return (
            <div key={m.id} className="leading-relaxed">
              {m.role === "user" ? (
                <div className="text-blue-400"><span className="text-gray-500">usr@ascii-os:~$</span> {cleanText}</div>
              ) : (
                <div className="text-green-400"><span className="text-gray-500">ai@ascii-os:~$</span> {cleanText}</div>
              )}
            </div>
          );
        })}

        {sysLogs.map((log, i) => (
          <div key={`log-${i}`} className={`text-xs ${log.type === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
            {log.text}
          </div>
        ))}

        {error && <div className="text-red-500 text-xs mt-2">ERROR: {error}</div>}
        {voiceNotice && (
          <div className="text-yellow-400 text-xs mt-2 flex justify-between gap-2 border border-yellow-400/30 px-2 py-1.5">
            <span>[VOICE] {voiceNotice}</span>
            <button onClick={() => { emitVoiceNotice(null); setVoiceNotice(null); }} className="text-yellow-400/60 hover:text-yellow-400 shrink-0">[x]</button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/20 pt-3 mt-2 shrink-0 items-center">
        <span className="text-gray-500">&gt;</span>
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={isListening ? "Mendengarkan..." : "type here..."} 
          disabled={isLoading} 
          className={`flex-1 bg-black border-none outline-none placeholder-gray-700 font-mono ${isListening ? 'text-yellow-400' : 'text-white'}`} 
          autoComplete="off" 
        />
        <button type="button" onClick={toggleListening} disabled={isLoading} className={`p-1.5 transition-all flex items-center justify-center ${isListening ? 'text-red-500 animate-pulse bg-red-500/10' : 'text-gray-500 hover:text-white'} disabled:opacity-30`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        <button type="submit" disabled={isLoading || !input.trim()} className={`p-1.5 transition-all flex items-center justify-center ${input.trim() ? 'text-green-400 hover:text-green-300' : 'text-gray-600'} disabled:opacity-30`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    </div>
  );
}