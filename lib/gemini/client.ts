// lib/gemini/client.ts
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-flash-lite-latest"; 

export function getGeminiClient(apiKey?: string): GoogleGenAI {
  // Pakai API Key dari parameter (user), kalau nggak ada baru pakai dari .env
  const key = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    throw new Error("API Key tidak ditemukan.");
  }
  return new GoogleGenAI({ apiKey: key });
}

// TAMBAHKAN PARAMETER apiKey
export async function* sendChatMessageStream(
  history: { role: "user" | "model"; text: string }[],
  apiKey?: string 
) {
  const ai = getGeminiClient(apiKey);

  const contents = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const responseStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL, 
      contents,
      config: {
        systemInstruction:
          "Kamu adalah asisten OS cerdas bernama ASCII OS. Kamu berjalan di sistem Linux dan punya akses untuk membuka aplikasi, website, atau mencari video di YouTube.\n" +
          "ATURAN KETAT:\n" +
          "1. Jika user meminta membuka aplikasi (misal: chrome, tlauncher, libreoffice, wps, code), balas dengan tag persis: [CMD: OPEN_APP, <nama_aplikasi>]\n" +
          "2. Jika user meminta membuka website atau mencari sesuatu di YouTube, balas dengan tag persis: [CMD: OPEN_URL, <url_lengkap>]\n" +
          "3. Sisipkan tag [CMD] itu di AWAL kalimat balasanmu, lalu ikuti dengan kalimat konfirmasi yang ramah.\n" +
          "Contoh 1:\n" +
          "User: Tolong buka chrome dong\n" +
          "AI: [CMD: OPEN_APP, Google Chrome] Siap bos! Chrome sedang dibuka.\n" +
          "Contoh 2:\n" +
          "User: buka tlauncher\n" +
          "AI: [CMD: OPEN_APP, TLauncher] Oke, TLauncher sedang dibuka.\n" +
          "Contoh 3:\n" +
          "User: buka libre office\n" +
          "AI: [CMD: OPEN_APP, LibreOffice] Siap, LibreOffice dibuka.\n" +
          "Ekspresi wajah: Awali balasan dengan SATU tag ekspresi: [EXPR: happy] [EXPR: sad] [EXPR: surprised] [EXPR: neutral].",
        maxOutputTokens: 200,
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  } catch (err: any) {
    if (err.message.includes("503") || err.message.includes("high demand")) {
       throw new Error("Server Google lagi penuh/overload. Tunggu beberapa saat lalu coba lagi ya!");
    }
    throw new Error(err.message);
  }
}