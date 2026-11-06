export const GESTURE_NAMES = ["wave", "explain", "think", "shrug", "surprise", "sad", "none"] as const;
export type GestureName = (typeof GESTURE_NAMES)[number];
export type Expression = "happy" | "sad" | "surprised" | "neutral";
export type Cue = { at: number; g: GestureName }; // at = indeks karakter di teks bersih

const EXPRS: Expression[] = ["happy", "sad", "surprised", "neutral"];

export function parseReply(raw: string) {
  let text = "";
  let expression: Expression = "neutral";
  let gotExpr = false;
  const cues: Cue[] = [];

  const re = /\[(EXPR|GESTURE)\s*:\s*([a-z_]+)\s*\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    text += raw.slice(last, m.index);
    const kind = m[1].toUpperCase();
    const val = m[2].toLowerCase();
    if (kind === "EXPR") {
      if (!gotExpr && (EXPRS as string[]).includes(val)) { expression = val as Expression; gotExpr = true; }
    } else if ((GESTURE_NAMES as readonly string[]).includes(val)) {
      cues.push({ at: text.length, g: val as GestureName });
    }
    last = m.index + m[0].length;
  }
  text += raw.slice(last);
  text = text.replace(/\[[^\]]*$/, ""); // tag yang belum selesai saat streaming

  const lead = text.length - text.trimStart().length;
  if (lead) cues.forEach((c) => { c.at = Math.max(0, c.at - lead); });

  return { text: text.trimStart(), expression, cues };
}
