// app/api/tts/route.ts
import { v1beta1 } from "@google-cloud/text-to-speech";
import path from "path";
import { NextResponse } from "next/server";

const client = new v1beta1.TextToSpeechClient({
  keyFilename: path.join(process.cwd(), "gcloud-key.json"),
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const words = text.split(/\s+/);
    const ssml = `<speak>${words
      .map(
        (w, i) =>
          `${escapeXml(w)}${i < words.length - 1 ? " " : ""}<mark name="w${i}"/>`,
      )
      .join("")}</speak>`;

    const request = {
      input: { ssml },
      voice: {
        languageCode: "id-ID",
        name: "id-ID-Chirp3-HD-Autonoe",
      },
      audioConfig: {
        audioEncoding: "MP3" as const,
        speakingRate: 1.05,
        pitch: 0.0,
      },
      enableTimePointing: ["SSML_MARK" as any],
    };

    const response = await client.synthesizeSpeech(request);
    const result = response[0];

    if (!result.audioContent || !result.timepoints) {
      console.error("[TTS API] respons kosong:", result);
      return NextResponse.json({ error: "Empty TTS response" }, { status: 500 });
    }

    return NextResponse.json({
      audio: Buffer.from(result.audioContent).toString("base64"),
      timepoints: result.timepoints,
    });
  } catch (err) {
    console.error("[TTS API] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate speech", detail: msg },
      { status: 500 },
    );
  }
}