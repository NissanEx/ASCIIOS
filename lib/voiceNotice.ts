export const VOICE_NOTICE_EVENT = "voice-notice";

let last: string | null = null;

export function emitVoiceNotice(msg: string | null) {
  last = msg;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VOICE_NOTICE_EVENT, { detail: msg }));
  }
}

// dipakai ChatWindow saat dibuka, supaya pesan yang muncul saat chat tertutup tidak hilang
export function getLastVoiceNotice() {
  return last;
}