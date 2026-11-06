export type AppSettings = { cols: number; size: number; voice: boolean };

export const DEFAULT_SETTINGS: AppSettings = { cols: 160, size: 896, voice: true };

const KEY = "asciios_settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}