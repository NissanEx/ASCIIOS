// hooks/useGeminiChat.ts
"use client";

import { useCallback, useState } from "react";
import { sendChatMessageStream } from "@/lib/gemini/client";

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  text: string;
};

// TAMBAHKAN PARAMETER apiKey
export function useGeminiChat(apiKey?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
      const aiMsgId = crypto.randomUUID();
      const initialAiMsg: ChatMessage = { id: aiMsgId, role: "model", text: "" };

      setMessages((prev) => [...prev, userMsg, initialAiMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
        
        // KIRIM API KEY KE FUNGSI STREAM
        const stream = sendChatMessageStream(history, apiKey); 

        let fullText = "";
        for await (const chunk of stream) {
          fullText += chunk;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMsgId ? { ...msg, text: fullText } : msg))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        setMessages((prev) => prev.filter((msg) => msg.id !== aiMsgId));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, apiKey] // Masukkan apiKey ke dependensi
  );

  return { messages, sendMessage, isLoading, error };
}