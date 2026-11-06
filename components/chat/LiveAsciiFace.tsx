// components/chat/LiveAsciiFace.tsx
"use client";

import { memo, useEffect, useRef } from "react";
import { usePuterTTS } from "@/hooks/usePuterTTS";
import { Landmark } from "@/hooks/useFaceLandmarks";
import type { Cue, GestureName } from "@/lib/parseReply";

type FaceState = "idle" | "talking" | "thinking";
type Expression = "happy" | "sad" | "surprised" | "neutral";

interface Props {
  imageSrc: string | null;
  landmarks: Landmark[] | null;
  bodyLandmarks?: Landmark[] | null;
  mask: Uint8Array | null;
  state: FaceState;
  expression: Expression;
  speech?: string;
  cues?: Cue[];
  cols?: number;
  voiceEnabled?: boolean;
   apiKey?: string;
}

const DEFAULT_COLS = 160;
const SHARP = 0.8;
const GAMMA = 0.95;
const LOCAL = 0.3;
const EQ = 0.75;
const BLUR_R = 8;
const RAMP = " .'`^:,;-~_+=*x?o%#&8@";
const SS = 2;
const MAX_FPS = 24;
const CHAR_MS = 68;
const INVERT_MASK = false;
const FONT = "ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const MIN_VIS = 0.4;
const MESH_COLS = 130;
const COLOR_LIFT = 0.1;
const COLOR_GAIN = 1.5;
const COLOR_DIM = 0.85;
const SAT = 1.0;    
const BUCKETS: number[][] = Array.from({ length: 32768 }, () => []);
let CR = new Float32Array(0);
let CG = new Float32Array(0);
let CB = new Float32Array(0);
let V = new Float32Array(0);
let LUM = new Float32Array(0);
let LUMB = new Float32Array(0);
let TS = new Float32Array(0);
let TW = new Float32Array(0);
let LOC = new Float32Array(0);
const HB = new Uint32Array(256);
const CDF = new Float32Array(256);

/* ================= LANDMARK ================= */
const EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_B = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const EYES = [
  { poly: EYE_A, c0: 33, c1: 133, up: 159, lo: 145, iris: 468 },
  { poly: EYE_B, c0: 263, c1: 362, up: 386, lo: 374, iris: 473 },
];
const BROW_A = [70, 63, 105, 66, 107];
const BROW_B = [300, 293, 334, 296, 336];
const MOUTH_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

/* ================= PRESET EKSPRESI ================= */
const EXPR: Record<Expression, { smile: number; browRaise: number; browTilt: number; lid: number; squint: number; wide: number; mouthOpen: number; pitch: number; roll: number }> = {
  neutral:   { smile: 0,     browRaise: 0,    browTilt: 0,   lid: 0,    squint: 0,    wide: 0, mouthOpen: 0,    pitch: 0,     roll: 0 },
  happy:     { smile: 0.5,   browRaise: 0.12, browTilt: 0,   lid: 0,    squint: 0.25, wide: 0, mouthOpen: 0.08, pitch: -0.02, roll: -0.03 },
  sad:       { smile: -0.45, browRaise: 0,    browTilt: 0.5, lid: 0.12, squint: 0,    wide: 0, mouthOpen: 0,    pitch: 0.06,  roll: 0.03 },
  surprised: { smile: 0,     browRaise: 0.6,  browTilt: 0,   lid: 0,    squint: 0,    wide: 0, mouthOpen: 0.4,  pitch: -0.04, roll: 0 },
};

/* ================= GESTURE ================= */
type GKey = "fU" | "fE" | "fH" | "hU" | "hE" | "hH" | "tilt" | "shift" | "shrug";
const GKEYS: GKey[] = ["fU", "fE", "fH", "hU", "hE", "hH", "tilt", "shift", "shrug"];
type KF = [number, Partial<Record<GKey, number>>];
const Z: Record<GKey, number> = { fU: 0, fE: 0, fH: 0, hU: 0, hE: 0, hH: 0, tilt: 0, shift: 0, shrug: 0 };

const GESTURES: Record<Exclude<GestureName, "none">, KF[]> = {
  wave: [
    [0.3, { fU: 0.5, fE: 0.5, tilt: 0.01 }],
    [0.6, { fU: 1.15, fE: 1.4, tilt: 0.015 }],
    [0.8, { fH: 0.55 }], [1.0, { fH: -0.55 }], [1.2, { fH: 0.55 }],
    [1.4, { fH: -0.55 }], [1.6, { fH: 0.55 }], [1.8, { fH: -0.4 }],
    [1.9, { fU: 1.15, fE: 1.4, tilt: 0.015 }],
    [2.5, Z],
  ],
  explain: [
    [0.3, { fU: 0.45, fE: 0.9, fH: -0.2, hU: 0.1, tilt: 0.01 }],
    [0.75, { fU: 0.7, fE: 1.15, fH: 0.35 }],
    [1.2, { fU: 0.4, fE: 0.8, fH: -0.25, hU: 0.18 }],
    [1.65, { fU: 0.72, fE: 1.2, fH: 0.35 }],
    [2.3, Z],
  ],
  think: [
    [0.5, { fU: 0.15, fE: 2.0, fH: 0.3, tilt: -0.01 }],
    [2.2, { fU: 0.15, fE: 2.0, fH: 0.3, tilt: -0.01 }],
    [2.9, Z],
  ],
  shrug: [
    [0.3, { shrug: 1, fU: 0.35, fE: 0.5, fH: -0.3, hU: 0.2, hE: 0.1 }],
    [1.1, { shrug: 1, fU: 0.35, fE: 0.5, fH: -0.3, hU: 0.2, hE: 0.1 }],
    [1.7, Z],
  ],
  surprise: [
    [0.12, { shrug: 0.9, fU: 0.6, fE: 0.6, hU: 0.25, tilt: -0.02 }],
    [0.9, { shrug: 0.5, fU: 0.5, fE: 0.5, hU: 0.2, tilt: -0.015 }],
    [1.7, Z],
  ],
  sad: [
    [0.6, { shrug: -0.8, tilt: 0.015, fU: 0.05 }],
    [2.0, { shrug: -0.8, tilt: 0.015, fU: 0.05 }],
    [2.9, Z],
  ],
};

function evalG(kfs: KF[], t: number, k: GKey): number {
  let t0 = 0, v0 = 0;
  for (const [kt, d] of kfs) {
    const v = d[k];
    if (v === undefined) continue;
    if (t <= kt) {
      const u = (t - t0) / Math.max(1e-4, kt - t0);
      return v0 + (v - v0) * (u * u * (3 - 2 * u));
    }
    t0 = kt; v0 = v;
  }
  return v0;
}

/* ================= UTIL ================= */
type Pt = { x: number; y: number };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerpP = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const smooth = (u: number) => u * u * (3 - 2 * u);
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const noise = (t: number, s: number) =>
  (Math.sin(t * 0.9 + s * 12.9) + Math.sin(t * 1.7 + s * 78.2) * 0.6 + Math.sin(t * 0.37 + s * 37.7) * 0.8) / 2.4;

type Spring = { v: number; t: number; vel: number };
const sp = (v = 0): Spring => ({ v, t: v, vel: 0 });
const stepSpring = (s: Spring, dt: number, k: number, z: number) => {
  const a = -2 * z * k * s.vel - k * k * (s.v - s.t);
  s.vel += a * dt;
  s.v += s.vel * dt;
};

const POSE_KEYS = [
  "open", "round", "spread", "smile", "browRaise", "browTilt", "lid", "squint", "wide", "gx", "gy", "yaw", "pitch", "roll", "lean",
  "fU", "fE", "fH", "hU", "hE", "hH", "tilt", "shift", "shrug",
] as const;
type PoseKey = (typeof POSE_KEYS)[number];
type Pose = Record<PoseKey, number>;
const SPRING_CFG: Record<PoseKey, [number, number]> = {
  open: [30, 1], round: [26, 0.9], spread: [26, 0.9], smile: [12, 1], browRaise: [14, 0.9], browTilt: [12, 1],
  lid: [18, 1], squint: [12, 1], wide: [16, 0.8], gx: [40, 0.9], gy: [40, 0.9],
  yaw: [7, 0.8], pitch: [8, 0.7], roll: [8, 0.8], lean: [6, 1],
  fU: [12, 0.75], fE: [12, 0.7], fH: [18, 0.45],
  hU: [12, 0.75], hE: [12, 0.7], hH: [18, 0.45],
  tilt: [8, 0.8], shift: [5, 0.9], shrug: [12, 0.7],
};

// [open, round, spread, kind]  kind: 0 konsonan, 1 vokal, 2 tutup/jeda
function viseme(ch: string): [number, number, number, 0 | 1 | 2] {
  const c = ch.toLowerCase();
  switch (c) {
    case "a": return [1.0, 0, 0.1, 1];     // rahang turun penuh
    case "e": return [0.5, 0, 0.55, 1];    // setengah buka, agak melebar
    case "i": return [0.2, 0, 1, 1];       // celah tipis, bibir melebar, gigi kelihatan
    case "o": return [0.7, 0.85, 0, 1];    // bulat, agak buka
    case "u": return [0.28, 1, 0, 1];      // monyong, bukaan kecil
    case "m": case "b": case "p": return [0, 0, 0, 2]; // bibir nutup
    case "f": case "v": return [0.08, 0, 0.3, 0];
    case "w": return [0.18, 0.9, 0, 0];
    case "s": case "z": case "c": case "j": case "y": return [0.1, 0, 0.6, 0];
    case "r": case "l": case "t": case "d": case "n": return [0.22, 0, 0.2, 0];
    case "k": case "g": case "h": return [0.3, 0, 0.1, 0];
  }
  if (/[\s.,!?;:]/.test(c)) return [0.03, 0, 0, 2];
  return [0.2, 0, 0.1, 0];
}

let ratioCache = 0;
function charRatio() {
  if (ratioCache) return ratioCache;
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return 0.6;
  c.font = `100px ${FONT}`;
  ratioCache = c.measureText("M").width / 100 || 0.6;
  return ratioCache;
}

type RGB = [number, number, number];
const css = ([r, g, b]: RGB) => `rgb(${r | 0},${g | 0},${b | 0})`;
const avgRGB = (list: RGB[]): RGB => [0, 1, 2].map((i) => list.reduce((s, c) => s + c[i], 0) / list.length) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function sampleRGB(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, W: number, H: number, fallback: RGB = [150, 115, 100]): RGB {
  const x0 = clamp(Math.round(x) - r, 0, W - 1);
  const y0 = clamp(Math.round(y) - r, 0, H - 1);
  const w = Math.min(2 * r + 1, W - x0);
  const h = Math.min(2 * r + 1, H - y0);
  const d = ctx.getImageData(x0, y0, w, h).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
  }
  return n ? [R / n, G / n, B / n] : fallback;
}

/* ================= WEBGL MESH WARPER ================= */
type Warper = {
  canvas: HTMLCanvasElement;
  W: number; H: number; GX: number; GY: number;
  pos: Float32Array;
  shade: Float32Array;
  resize(W: number, H: number): void;
  render(src: HTMLCanvasElement): void;
};

const VS = `attribute vec2 a_pos; attribute vec2 a_uv; attribute float a_shade;
uniform vec2 u_res; varying vec2 v_uv; varying float v_shade;
void main(){ vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; v_shade = a_shade; }`;
const FS = `precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; varying float v_shade;
void main(){ vec4 c = texture2D(u_tex, v_uv); gl_FragColor = vec4(c.rgb * (1.0 - v_shade), c.a); }`;
function createWarper(): Warper | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl", { antialias: false, alpha: true, failIfMajorPerformanceCaveat: false }) || canvas.getContext("experimental-webgl", { antialias: false, alpha: true, failIfMajorPerformanceCaveat: false })) as WebGLRenderingContext | null;
    if (!gl) return null;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link error");
    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aUv = gl.getAttribLocation(prog, "a_uv");
    const aShade = gl.getAttribLocation(prog, "a_shade");
    const uRes = gl.getUniformLocation(prog, "u_res");
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUv); gl.enableVertexAttribArray(aShade);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const bufPos = gl.createBuffer(), bufUv = gl.createBuffer(), bufShade = gl.createBuffer(), bufIdx = gl.createBuffer();
    let nIdx = 0;

    const w: Warper = {
      canvas, W: 0, H: 0, GX: MESH_COLS, GY: 0,
      pos: new Float32Array(0), shade: new Float32Array(0),
      resize(W, H) {
        w.W = W; w.H = H;
        canvas.width = W; canvas.height = H;
        gl.viewport(0, 0, W, H);
        gl.uniform2f(uRes, W, H);
        const GX = MESH_COLS;
        const GY = Math.max(8, Math.round((H / W) * (GX - 1)) + 1);
        w.GY = GY;
        w.pos = new Float32Array(GX * GY * 2);
        w.shade = new Float32Array(GX * GY);
        const uv = new Float32Array(GX * GY * 2);
        for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
          const k = (j * GX + i) * 2;
          uv[k] = i / (GX - 1); uv[k + 1] = j / (GY - 1);
        }
        const idx = new Uint16Array((GX - 1) * (GY - 1) * 6);
        let n = 0;
        for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
          const a = j * GX + i, b = a + 1, c = a + GX, d = c + 1;
          idx[n++] = a; idx[n++] = b; idx[n++] = c;
          idx[n++] = b; idx[n++] = d; idx[n++] = c;
        }
        nIdx = n;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufUv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      },
      render(src) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufPos); gl.bufferData(gl.ARRAY_BUFFER, w.pos, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufShade); gl.bufferData(gl.ARRAY_BUFFER, w.shade, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
        gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
      },
    };
    return w;
  } catch (e) { return null; }
}

/* ================= DATA DASAR ================= */
type Arm = { S: Pt; E: Pt; Wr: Pt };
type Limb = { arm: Arm; sign: 1 | -1; role: "f" | "h" };

interface Base {
  mouthSkin: string;
  cols: number;
  W: number; H: number; ROWS: number;
  bg: HTMLCanvasElement;
  cutout: HTMLCanvasElement;
  body: HTMLCanvasElement;
  sc: HTMLCanvasElement; sctx: CanvasRenderingContext2D;
  gc: HTMLCanvasElement; gctx: CanvasRenderingContext2D;
  limbs: Limb[];
  pivot: Pt;
  faceX: number;
  y0: number; y1: number;
  hipY: number; armW: number;
  bodyGain: number;
  lo: number; hi: number;
  lm: Landmark[] | null;
    skin: string; lip: string; brow: string; sclera: string; iris: [string, string];
  hairVis: { brA: number; brB: number; eyA: number; eyB: number };
}

/* ================= RIG LENGAN LENTUR ================= */
function drawSeg(c: CanvasRenderingContext2D, src: CanvasImageSource, A: Pt, B: Pt, A2: Pt, r: number, w: number, extA: number, extB: number) {
  const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, nx = -uy, ny = ux;
  const a = { x: A.x - ux * extA, y: A.y - uy * extA };
  const b = { x: B.x + ux * extB, y: B.y + uy * extB };
  c.save();
  c.translate(A2.x, A2.y); c.rotate(r); c.translate(-A.x, -A.y);
  c.beginPath();
  c.moveTo(a.x + nx * w, a.y + ny * w); c.lineTo(b.x + nx * w, b.y + ny * w);
  c.lineTo(b.x - nx * w, b.y - ny * w); c.lineTo(a.x - nx * w, a.y - ny * w);
  c.closePath(); c.clip();
  const pad = w * 2;
  const minX = Math.max(0, Math.min(a.x, b.x) - pad), minY = Math.max(0, Math.min(a.y, b.y) - pad);
  const maxX = Math.max(a.x, b.x) + pad, maxY = Math.max(a.y, b.y) + pad;
  const sw = maxX - minX, sh = maxY - minY;
  c.drawImage(src, minX, minY, sw, sh, minX, minY, sw, sh);
  c.restore();
}

function drawLimb(c: CanvasRenderingContext2D, src: CanvasImageSource, a: Arm, ang: number[], w: number) {
  const dl = Math.hypot(a.Wr.x - a.E.x, a.Wr.y - a.E.y) || 1;
  const Hd: Pt = { x: a.Wr.x + ((a.Wr.x - a.E.x) / dl) * w * 1.6, y: a.Wr.y + ((a.Wr.y - a.E.y) / dl) * w * 1.6 };
  const pts = [a.S, a.E, a.Wr, Hd];
  const K = 3;
  let D = a.S;
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < K; k++) {
      const P0 = lerpP(pts[s], pts[s + 1], k / K), P1 = lerpP(pts[s], pts[s + 1], (k + 1) / K);
      const r = ang[s] + (ang[s + 1] - ang[s]) * ((k + 0.5) / K);
      const sl = Math.hypot(P1.x - P0.x, P1.y - P0.y);
      drawSeg(c, src, P0, P1, D, r, w, s === 0 && k === 0 ? w * 0.3 : sl * 0.4, sl * 0.4);
      D = {
        x: D.x + (P1.x - P0.x) * Math.cos(r) - (P1.y - P0.y) * Math.sin(r),
        y: D.y + (P1.x - P0.x) * Math.sin(r) + (P1.y - P0.y) * Math.cos(r),
      };
    }
  }
}

function armAngles(s: number, U: number, E: number, Hh: number) {
  const a0 = s * U, a1 = -s * E, a2 = -s * Hh;
  return [a0 * 0.5, a0, a0 + a1, a0 + a1 + a2];
}

/* ================= DEFORMASI BADAN + KEPALA ================= */
function bodyOffset(B: Base, y: number, p: Pose) {
  const span = Math.max(B.H * 0.25, B.hipY - B.pivot.y);
  const above = y <= B.hipY;
  const up = clamp((B.hipY - y) / span, 0, 1.3);
  const low = clamp((y - B.hipY) / Math.max(1, B.H - B.hipY), 0, 1);
  const dx = (p.shift * (above ? 1 : 1 - low) + (above ? p.tilt * Math.pow(up, 1.3) : 0)) * B.W;
  const dy = above ? -p.shrug * B.H * 0.012 * Math.min(up, 1) : 0;
  return { dx: dx * B.bodyGain, dy: dy * B.bodyGain };
}

function fillMesh(B: Base, M: Warper, p: Pose, t: number) {
  const { W, H, pivot: pv, faceX, y0, y1 } = B;
  const { GX, GY, pos, shade } = M;
  const no = bodyOffset(B, pv.y, p);
  const span = Math.max(H * 0.25, B.hipY - pv.y);
  const roll = p.roll + clamp(Math.atan((p.tilt * W * 1.3) / span) * 0.8, -0.15, 0.15) * B.bodyGain;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const s = p.lean * (1 + 0.005 * Math.sin(t * 1.7));
  const sY = s * (1 - Math.abs(p.pitch) * 0.04);
  const dY = p.pitch * H * 0.05;
  const ya = Math.abs(p.yaw), dir = Math.sign(p.yaw);
  const lmk = B.lm;
  const mouthY = lmk ? lmk[13].y * H : 0;
  const chinY = lmk ? lmk[152].y * H : 0;
  const lowerY = lmk ? lmk[14].y * H : 0;
  const fw = lmk ? Math.abs(lmk[454].x - lmk[234].x) * W : W * 0.3;

  const mA = lmk ? Math.atan2((lmk[291].y - lmk[61].y) * H, (lmk[291].x - lmk[61].x) * W) : 0;
  const mouthCx = lmk ? ((lmk[61].x + lmk[291].x) / 2) * W : faceX;

  let k = 0;
  for (let j = 0; j < GY; j++) {
    const y = (j * H) / (GY - 1);
    const o = bodyOffset(B, y, p);
    const w = y <= y0 ? 1 : y >= y1 ? 0 : 1 - smooth((y - y0) / (y1 - y0));
    for (let i = 0; i < GX; i++, k++) {
      const x = (i * W) / (GX - 1);
      let px = x + o.dx, py = y + o.dy, sh = 0;
      if (w > 0) {
        const ux = x - faceX;
        const xw = x - (0.35 * p.yaw * ux * ux) / W + p.yaw * W * 0.05;
        const yw = y + (y - pv.y) * (-p.yaw * (ux / W) * 0.12);
        const rx = (xw - pv.x) * s, ry = (yw - pv.y) * sY;
        const hx = pv.x + no.dx + rx * cr - ry * sr;
        const hy = pv.y + no.dy + dY + rx * sr + ry * cr;
        px += (hx - px) * w;
        py += (hy - py) * w;
        if (lmk && y > mouthY) {
          const zoneEnd = lowerY + H * 0.012;
          const ramp = y >= zoneEnd ? 1 : (y - mouthY) / Math.max(1, zoneEnd - mouthY);
          const fade = y <= chinY ? 1 : clamp(1 - (y - chinY) / (H * 0.05), 0, 1);
          const jh = clamp(1 - Math.abs(x - mouthCx) / (fw * 0.55), 0, 1);
         py += ramp * fade * jh * p.open * H * 0.03 * w;
        }
        if (lmk) {
  // bibir ditarik ke tengah (o/u) atau ditarik keluar (i/e)
  const my = (mouthY + lowerY) / 2;
  const vy = Math.exp(-Math.pow((y - my) / (H * 0.035), 2));
  const hk = clamp(1 - Math.abs(x - mouthCx) / (fw * 0.6), 0, 1);
  const sq = p.round * 0.3 - p.spread * 0.14;
  px += (mouthCx - x) * sq * vy * hk * w;
}
        sh = ya * 0.15 * w * clamp((ux * dir) / (W * 0.3), 0, 1);
      }
      pos[k * 2] = px; pos[k * 2 + 1] = py; shade[k] = sh;
    }
  }
}

function drawBrow(c: CanvasRenderingContext2D, pts: Pt[], p: Pose, B: Base, ew: number, vis: number) {
  const th = ew * 0.15;
  const dev = clamp((Math.abs(p.browRaise) + Math.abs(p.browTilt)) * 4, 0, 1) * vis;
  if (dev < 0.02) return;
  c.save(); c.globalAlpha = dev;
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = B.skin; c.shadowColor = B.skin; c.shadowBlur = th * 0.5; c.lineWidth = th * 1.2;
  c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke(); c.restore();
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = B.brow; c.lineWidth = th;
  c.beginPath();
  pts.forEach((q, i) => {
    const t = i / (pts.length - 1);
    const y = q.y - p.browRaise * ew * 0.15 - p.browTilt * ew * 0.15 * (t - 0.5);
    i ? c.lineTo(q.x, y) : c.moveTo(q.x, y);
  });
  c.stroke(); c.restore(); c.restore();
}

function drawEye(c: CanvasRenderingContext2D, P: (i: number) => Pt, m: (typeof EYES)[number], p: Pose, B: Base, _irisColor: string, lid: number, vis: number) {
  if ((lid < 0.05 && p.squint < 0.02) || vis < 0.05) return;
  const c0 = P(m.c0), c1 = P(m.c1), up = P(m.up), lo = P(m.lo);
  const cx = (c0.x + c1.x) / 2, cy = (up.y + lo.y) / 2;
  const ew = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  const left = c0.x < c1.x ? c0 : c1;
  const right = c0.x < c1.x ? c1 : c0;
  const mid = (left.y + right.y) / 2;
  const upY = up.y + (lo.y - up.y) * lid;
  const loY = lo.y - (lo.y - up.y) * 0.45 * p.squint;
  const ext = Math.max(ew * 0.25, B.W * 0.01);
  c.save(); c.globalAlpha = vis;
  c.beginPath(); m.poly.map(P).forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.clip(); c.fillStyle = B.skin;
  c.beginPath(); c.moveTo(left.x - ext, cy - ew); c.lineTo(right.x + ext, cy - ew); c.lineTo(right.x + ext, right.y); c.lineTo(right.x, right.y);
  c.quadraticCurveTo(cx, 2 * upY - mid, left.x, left.y); c.lineTo(left.x - ext, left.y); c.closePath(); c.fill();
  if (p.squint > 0.02) {
    c.beginPath(); c.moveTo(left.x - ext, cy + ew); c.lineTo(right.x + ext, cy + ew); c.lineTo(right.x + ext, right.y); c.lineTo(right.x, right.y);
    c.quadraticCurveTo(cx, 2 * loY - mid, left.x, left.y); c.lineTo(left.x - ext, left.y); c.closePath(); c.fill();
  }
  c.restore();
  c.save(); c.globalAlpha = clamp(lid * 2 - 0.2, 0, 1) * vis; c.lineCap = "round"; c.strokeStyle = B.brow; c.lineWidth = Math.max(1.5, ew * 0.14);
  c.beginPath(); c.moveTo(left.x, left.y); c.quadraticCurveTo(cx, 2 * upY - mid, right.x, right.y); c.stroke(); c.restore();
}
function drawMouth(c: CanvasRenderingContext2D, P: (i: number) => Pt, p: Pose, B: Base) {
  const open = clamp(p.open, 0, 1);
  const rnd = clamp(p.round, 0, 1);
  const spr = clamp(p.spread, 0, 1);
  if (open < 0.06 && rnd < 0.2) return;

  const L = P(78), R = P(308), t = P(13), b = P(14);
  const cx = (L.x + R.x) / 2;
  const hw = (R.x - L.x) / 2;
  const y1 = b.y + B.H * (0.012 + 0.008 * rnd - 0.004 * spr);
  const th = y1 - t.y;
  const vis = clamp(Math.max(open * 5, rnd * 2.5), 0, 1);

  const path = () => {
    c.beginPath(); c.moveTo(L.x, L.y);
    [191, 80, 81, 82, 13, 312, 311, 310, 415, 308].forEach((i) => c.lineTo(P(i).x, P(i).y));
    // vokal bulat -> dasar rongga lebih melengkung
    c.quadraticCurveTo(cx, y1 + th * (0.4 + rnd * 0.5), L.x, L.y);
    c.closePath();
  };

  c.save(); c.globalAlpha = vis;
  // cincin bibir (kelihatan tebal pas o/u)
  if (rnd > 0.15) {
    path(); c.lineJoin = "round"; c.strokeStyle = B.lip;
    c.lineWidth = B.H * (0.004 + 0.012 * rnd); c.stroke();
  }
  // rongga mulut
  path(); c.fillStyle = "#140607"; c.fill();
  c.save(); c.clip();
  // gigi atas: dominan di i/e, hilang di o/u
  const teeth = clamp(spr * 0.9 + open * 0.4 - rnd * 0.8, 0, 1);
  if (teeth > 0.05) {
    c.globalAlpha = vis * teeth * 0.7; c.fillStyle = "#a8a095";
    c.fillRect(cx - hw, t.y - 1, hw * 2, th * (0.22 + 0.2 * spr));
  }
  // lidah: kelihatan pas buka lebar (a)
  if (open > 0.45) {
    c.globalAlpha = vis * clamp((open - 0.45) * 2, 0, 1) * 0.85; c.fillStyle = "#6e2a30";
    c.beginPath(); c.ellipse(cx, y1, hw * 0.55, th * 0.35, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore(); c.restore();
}
function LiveAsciiFace({ imageSrc, landmarks, bodyLandmarks = null, mask, state, expression, speech = "", cues = [], cols = DEFAULT_COLS, voiceEnabled = true, apiKey }: Props) {
  const COLS = cols;
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<Base | null>(null);
  const propsRef = useRef({ state, expression, speech, cues });
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;
 const { speak, cancel, getLevel } = usePuterTTS(apiKey);
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;
  const speechCursorRef = useRef<number>(-1);
  const speechDebounceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; last: string }>({ timer: null, last: "" });
  
  // Ref buat animasi
  const introStartRef = useRef<number>(0); 
  const lastAnimatedImageRef = useRef<string | null>(null); // <-- TAMBAHAN: Biar nggak ngulang animasi

  useEffect(() => { propsRef.current = { state, expression, speech, cues }; });

  useEffect(() => {
    if (!voiceEnabled) { cancel(); speechDebounceRef.current.last = ""; return; }
    if (state !== "talking") return;
    if (!speech) return;
    if (speechDebounceRef.current.last === speech) return;
    if (speechDebounceRef.current.timer) clearTimeout(speechDebounceRef.current.timer);
    speechDebounceRef.current.timer = setTimeout(() => {
      const text = propsRef.current.speech;
      if (!text || !voiceRef.current) return;
      speechDebounceRef.current.last = text;
      speechCursorRef.current = -1;
      speak(text, null, (_wi, ci) => { speechCursorRef.current = ci; }, () => { speechCursorRef.current = -1; });
    }, 400);
  }, [state, speech, speak, voiceEnabled, cancel]);

  useEffect(() => () => { if (speechDebounceRef.current.timer) clearTimeout(speechDebounceRef.current.timer); cancel(); }, [cancel]);

  // ---------- 1. Siapkan gambar dasar ----------
  useEffect(() => {
    if (!imageSrc) {
      baseRef.current = null;
      const cv = cvRef.current;
      if (cv) cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const W = COLS * SS;
      const H = Math.round((W * nh) / nw);
      const ROWS = Math.max(8, Math.round((COLS * nh) / nw * charRatio()));
      const mk = (w: number, h: number, read = false) => {
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d", { willReadFrequently: read })!;
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
        return { cv, cx };
      };
      const cut = mk(W, H, true);
      cut.cx.drawImage(img, 0, 0, W, H);
      const bgCv = mk(W, H);
      bgCv.cx.drawImage(img, 0, 0, W, H);
      if (mask) {
        if (mask.length === nw * nh) {
          const id = cut.cx.getImageData(0, 0, W, H);
          for (let y = 0; y < H; y++) {
            const my = Math.floor((y / H) * nh) * nw;
            for (let x = 0; x < W; x++) {
              const v = mask[my + Math.floor((x / W) * nw)];
              const bg = INVERT_MASK ? v === 0 : v > 0;
              if (bg) id.data[(y * W + x) * 4 + 3] = 0;
            }
          }
          cut.cx.putImageData(id, 0, 0);
        }
      }
      const tmp = mk(COLS, ROWS, true);
      tmp.cx.drawImage(cut.cv, 0, 0, COLS, ROWS);
      const td = tmp.cx.getImageData(0, 0, COLS, ROWS).data;
      const hist = new Array(256).fill(0); let total = 0;
      for (let i = 0; i < td.length; i += 4) {
        if (td[i + 3] < 200) continue;
        hist[Math.round(0.299 * td[i] + 0.587 * td[i + 1] + 0.114 * td[i + 2])]++; total++;
      }
      let lo = 0, hi = 255, accH = 0;
      for (let i = 0; i < 256; i++) { accH += hist[i]; if (accH >= total * 0.03) { lo = i; break; } }
      accH = 0;
      for (let i = 255; i >= 0; i--) { accH += hist[i]; if (accH >= total * 0.02) { hi = i; break; } }
      if (hi - lo < 30) { lo = 0; hi = 255; }

      const lm = landmarks && landmarks.length >= 468 ? landmarks : null;
      let skin: RGB = [170, 130, 115], lip: RGB = [150, 80, 85], brow: RGB = [40, 28, 25];
      let mouthSkin: RGB = skin;
      let iris: [RGB, RGB] = [[60, 40, 30], [60, 40, 30]];
      if (lm) {
        const S = (i: number, r: number) => sampleRGB(cut.cx, lm[i].x * W, lm[i].y * H, r, W, H);
        const r1 = Math.max(2, Math.round(W * 0.01));
        skin = avgRGB([S(50, r1), S(280, r1), S(6, r1)]);
        mouthSkin = avgRGB([S(164, 3), S(200, 3), S(205, 3), S(425, 3)]);
        lip = avgRGB([S(0, 3), S(17, 3)]);
        brow = avgRGB([S(105, 2), S(334, 2)]).map((v) => v * 0.8) as RGB;
        const fixIris = (c: RGB): RGB => { const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return l > 90 ? (c.map((v) => (v * 90) / l) as RGB) : c; };
        if (lm.length >= 478) iris = [fixIris(S(468, 2)), fixIris(S(473, 2))];
      }

            // ---- deteksi rambut yang menutupi alis / mata ----
      const hairVis = { brA: 1, brB: 1, eyA: 1, eyB: 1 };
      if (lm) {
        const lumOf = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        const Ls = lumOf(skin);
        const Pm = (i: number): Pt => ({ x: lm[i].x * W, y: lm[i].y * H });
        const ewid = Math.hypot(Pm(133).x - Pm(33).x, Pm(133).y - Pm(33).y);
        const isSkin = (x: number, y: number) => {
          const c = sampleRGB(cut.cx, x, y, 2, W, H, skin);
          return lumOf(c) > Ls * 0.55 && Math.hypot(c[0] - skin[0], c[1] - skin[1], c[2] - skin[2]) < 110 ? 1 : 0;
        };
// radius sampel ikut skala mata, bukan tetap 2px
const sr = clamp(Math.round(ewid * 0.06), 0, 2);
const isSkinSoft = (x: number, y: number) => {
  const c = sampleRGB(cut.cx, x, y, sr, W, H, skin);
  return lumOf(c) > Ls * 0.35 && Math.hypot(c[0] - skin[0], c[1] - skin[1], c[2] - skin[2]) < 150 ? 1 : 0;
};
        const toVis = (f: number) => smooth(clamp((f - 0.35) / 0.45, 0, 1));
        // alis: cek dahi di atas alis. Kalau dahi gelap, berarti ketutup poni
        const browVis = (ids: number[]) => {
          let s = 0;
          for (const i of ids) {
            const p = Pm(i);
            s += isSkin(p.x, p.y - ewid * 0.5) + isSkin(p.x, p.y - ewid * 0.8);
          }
          return toVis(s / (ids.length * 2));
        };
        const eyeVis = (m: (typeof EYES)[number]) => {
          const c0 = Pm(m.c0), c1 = Pm(m.c1), up = Pm(m.up);
          let s = 0;
// jarak sampel minimal di luar jendela sampel, supaya tidak ikut menangkap bulu mata
const d1 = Math.max(ewid * 0.12, sr + 2);
const d2 = Math.max(ewid * 0.3, sr + 4);
for (const u of [0.25, 0.5, 0.75]) {
  const x = c0.x + (c1.x - c0.x) * u;
  s += isSkinSoft(x, up.y - d1) + isSkinSoft(x, up.y - d2);
}
          // baru dianggap ketutup rambut kalau hampir semua sampel bukan kulit
          return smooth(clamp((s / 6 - 0.1) / 0.3, 0, 1));
        };
        hairVis.brA = browVis(BROW_A);
        hairVis.brB = browVis(BROW_B);
        hairVis.eyA = eyeVis(EYES[0]);
        hairVis.eyB = eyeVis(EYES[1]);
        console.log("hairVis", hairVis);
      }

      const pl = bodyLandmarks && bodyLandmarks.length >= 25 ? bodyLandmarks : null;
      const vis = (i: number) => (pl ? (pl[i] as Landmark & { visibility?: number }).visibility ?? 1 : 0);
      const bc = mk(W, H);
      bc.cx.drawImage(cut.cv, 0, 0);

      const limbs: Limb[] = [];
      let pivot: Pt = { x: W / 2, y: H * 0.4 };
      let faceX = W / 2, y0 = Infinity, y1 = Infinity, hipY = H, armW = 0, bodyGain = 0.4;

      if (pl && vis(11) > MIN_VIS && vis(12) > MIN_VIS) {
        const Q = (i: number): Pt => ({ x: pl[i].x * W, y: pl[i].y * H });
        const shw = Math.max(8, Math.hypot(Q(11).x - Q(12).x, Q(11).y - Q(12).y));
        const sm: Pt = { x: (Q(11).x + Q(12).x) / 2, y: (Q(11).y + Q(12).y) / 2 };
        const hipsOK = vis(23) > MIN_VIS && vis(24) > MIN_VIS;
        hipY = hipsOK ? (Q(23).y + Q(24).y) / 2 : sm.y + shw * 1.7;
        hipY = Math.max(hipY, sm.y + shw);
        bodyGain = 1;
        const chin: Pt = lm ? { x: lm[152].x * W, y: lm[152].y * H } : { x: sm.x, y: sm.y - shw * 0.5 };
        faceX = chin.x;
        pivot = { x: (chin.x + sm.x) / 2, y: Math.max(chin.y + 4, sm.y - shw * 0.12) };
        y0 = chin.y + (pivot.y - chin.y) * 0.2;
        y1 = sm.y + shw * 0.3;

        const bend = (a: Arm) => {
          const u = { x: a.E.x - a.S.x, y: a.E.y - a.S.y }, v = { x: a.Wr.x - a.E.x, y: a.Wr.y - a.E.y };
          return Math.acos(clamp((u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1), -1, 1));
        };
        const cands = ([[11, 13, 15], [12, 14, 16]] as const).map(([s, e, w]) => {
          const arm: Arm = { S: Q(s), E: Q(e), Wr: Q(w) };
          return { arm, bend: bend(arm), sign: (arm.S.x < sm.x ? 1 : -1) as 1 | -1, ok: vis(e) > MIN_VIS && vis(w) > MIN_VIS && arm.Wr.y > arm.S.y };
        });
        armW = Math.max(4, ((Math.hypot(cands[0].arm.E.x - cands[0].arm.S.x, cands[0].arm.E.y - cands[0].arm.S.y) + Math.hypot(cands[1].arm.E.x - cands[1].arm.S.x, cands[1].arm.E.y - cands[1].arm.S.y)) / 2) * 0.35);
        const usable = cands.filter((c) => c.ok && c.bend < 1.1).sort((a, b) => a.bend - b.bend);
        if (usable[1] && usable[1].bend < 0.5) limbs.push({ arm: usable[1].arm, sign: usable[1].sign, role: "h" });
        if (usable[0]) limbs.push({ arm: usable[0].arm, sign: usable[0].sign, role: "f" });

        const torsoHalf = shw * 0.42;
        const torso = sampleRGB(cut.cx, sm.x, (sm.y + hipY) / 2, 6, W, H, [200, 200, 200]);
        for (const { arm } of limbs) {
          const dl = Math.hypot(arm.Wr.x - arm.E.x, arm.Wr.y - arm.E.y) || 1;
          const tip: Pt = { x: arm.Wr.x + ((arm.Wr.x - arm.E.x) / dl) * armW * 1.4, y: arm.Wr.y + ((arm.Wr.y - arm.E.y) / dl) * armW * 1.4 };
          const path: Pt[] = [];
          const along = (A: Pt, B: Pt, n: number) => { for (let i = 0; i <= n; i++) path.push(lerpP(A, B, i / n)); };
          along(lerpP(arm.S, arm.E, 0.2), arm.E, 12); along(arm.E, arm.Wr, 12); along(arm.Wr, tip, 4);
          const x = bc.cx;
          x.save(); x.globalCompositeOperation = "destination-out";
          for (const p of path) { x.beginPath(); x.arc(p.x, p.y, armW * 1.15, 0, Math.PI * 2); x.fill(); }
          x.restore();
          x.save(); x.beginPath(); x.rect(sm.x - torsoHalf, 0, torsoHalf * 2, H); x.clip();
          for (const p of path) {
            const dir = Math.sign(sm.x - p.x) || 1;
            const col = css(sampleRGB(cut.cx, p.x + dir * armW * 1.7, p.y, 3, W, H, torso));
            x.fillStyle = col; x.shadowColor = col; x.shadowBlur = armW * 0.4;
            x.beginPath(); x.arc(p.x, p.y, armW * 1.15, 0, Math.PI * 2); x.fill();
          }
          x.restore();
        }
      } else if (lm) {
        const chin: Pt = { x: lm[152].x * W, y: lm[152].y * H };
        const fh = Math.abs(lm[152].y - lm[10].y) * H;
        faceX = chin.x;
        pivot = { x: chin.x, y: chin.y + fh * 0.4 };
        y0 = chin.y;
        y1 = chin.y + fh * 0.9;
        hipY = pivot.y + Math.max(fh * 3, H * 0.5);
      }
      if (y1 <= y0) y1 = y0 + 1;

      const sc = mk(W, H), g = mk(COLS, ROWS, true);
      baseRef.current = {
        mouthSkin: css(mouthSkin), cols: COLS, W, H, ROWS, bg: bgCv.cv, cutout: cut.cv,
        body: bc.cv, sc: sc.cv, sctx: sc.cx, gc: g.cv, gctx: g.cx,
        limbs, pivot, faceX, y0, y1, hipY, armW, bodyGain, lo, hi, lm,
        skin: css(skin), lip: css(lip), brow: css(brow),
        sclera: css(mix(skin, [255, 255, 255], 0.5)),
        iris: [css(iris[0]), css(iris[1])],
        hairVis,
      };

      // TRIGGER ANIMASI: Tahan (0) sampai mask siap, baru jalankan
      if (lastAnimatedImageRef.current !== imageSrc) {
        lastAnimatedImageRef.current = imageSrc;
        introStartRef.current = 0; 
      }
      if (mask && introStartRef.current === 0) {
        introStartRef.current = performance.now();
      } else if (mask && introStartRef.current === 0) {
        // Jika gambar sudah ada tapi tadi nunggu mask, mulai animasi sekarang
        introStartRef.current = performance.now();
      }
    };
    img.src = imageSrc;
    return () => { cancelled = true; };
  }, [imageSrc, mask, landmarks, bodyLandmarks, cols]);

  // ---------- 2. Loop animasi ----------
  useEffect(() => {
    const A = {} as Record<PoseKey, Spring>;
    POSE_KEYS.forEach((k) => (A[k] = sp(k === "lean" ? 1 : 0)));
const rt = {
  env: 0, blinkAt: 1.5, blinkT: -1, dbl: false, nextSaccade: 0, sacX: 0, sacY: 0,
  speechStart: 0, cursor: -1, bump: 0, lastState: "idle" as FaceState,
  mx: 0, my: 0, cue: 0, lastExpr: "neutral" as Expression,
  vv: [0, 0, 0] as [number, number, number],   // <-- tambahan: vokal terakhir
  g: null as { name: Exclude<GestureName, "none">; t0: number } | null,
};
    const onMove = (e: MouseEvent) => {
      const r = wrapRef.current?.getBoundingClientRect(); if (!r) return;
      rt.mx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
      rt.my = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5), -1, 1);
    };
    window.addEventListener("mousemove", onMove);

    let warper: Warper | null | undefined;
    let raf = 0;
    let last = performance.now();
    const t0 = last;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const lvl = getLevelRef.current();
      const st0 = propsRef.current.state;
      const fps = (st0 === "idle" && lvl < 0) || st0 === "thinking" ? 15 : MAX_FPS;
      if (now - last < 1000 / fps - 2) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - t0) / 1000;

      const B = baseRef.current;
      const cv = cvRef.current;
      const wrap = wrapRef.current;
      if (!B || !cv || !wrap) return;
      const COLS = B.cols;

      if (warper === undefined) warper = createWarper();
      if (warper && (warper.W !== B.W || warper.H !== B.H)) warper.resize(B.W, B.H);

      const { state, expression, speech, cues } = propsRef.current;
      const E = EXPR[expression];
      const audioOn = lvl >= 0;
      const talking = state === "talking" || audioOn;
      const thinking = state === "thinking" && !audioOn;
      const startG = (g: GestureName) => { if (g !== "none") rt.g = { name: g, t0: t }; };

      if (rt.lastState !== state) {
        if (state === "talking") { rt.speechStart = t; rt.cursor = -1; rt.cue = 0; }
        rt.lastState = state;
      }
      if (rt.lastExpr !== expression) {
        rt.lastExpr = expression;
        if (expression === "surprised") startG("surprise");
        else if (expression === "sad") startG("sad");
      }

     let vOpen = 0, vRound = 0, vSpread = 0;
      const hasAudio = lvl >= 0;
      const target = hasAudio ? clamp((lvl - 0.03) * 5, 0, 1) : 0;
      rt.env += (target - rt.env) * (target > rt.env ? 0.5 : 0.18);

      if (talking) {
        const cur = speechCursorRef.current >= 0 ? speechCursorRef.current : Math.floor((t - rt.speechStart) / (CHAR_MS / 1000));
if ((hasAudio || !voiceRef.current) && speech && cur < speech.length) {
  const [o, r, s, kind] = viseme(speech[Math.max(0, cur)]);
  let vo = o, vr = r, vs = s;
  if (kind === 1) rt.vv = [o, r, s];
  else if (kind === 0) {
    // koartikulasi: konsonan "nempel" ke bentuk vokal sebelumnya
    vo = o * 0.5 + rt.vv[0] * 0.5;
    vr = r * 0.5 + rt.vv[1] * 0.5;
    vs = s * 0.5 + rt.vv[2] * 0.5;
  } else rt.vv = [0, 0, 0];
  // ikuti volume asli: pas hening antar kata, mulut ikut menutup
  const vol = hasAudio ? clamp(0.25 + rt.env * 1.1, 0, 1) : 1;
  vOpen = clamp(vo * (0.85 + 0.15 * hash(cur)) * vol, 0, 1);
  vRound = vr * Math.min(1, vol * 1.2);
  vSpread = vs;
} else { vOpen = 0; vRound = 0; vSpread = 0; }
        if (speech) {
          if (cur < rt.cursor || cur - rt.cursor > 6) rt.cursor = cur - 1;
          while (rt.cursor < Math.min(cur, speech.length - 1)) {
            rt.cursor++;
            const ch = speech[rt.cursor];
            while (rt.cue < cues.length && cues[rt.cue].at <= rt.cursor) startG(cues[rt.cue++].g);
            if (ch === "?" || ch === "!") rt.bump = 1;
            if (".,!?".includes(ch)) {
              A.pitch.vel += 0.2; A.fU.vel += 2; A.fE.vel += 4; A.fH.vel += 5; A.hU.vel += 0.8;
              A.tilt.vel += (hash(rt.cursor) - 0.5) * 0.2; A.shrug.vel += 0.6;
            } else if (ch === " " && hash(rt.cursor) > 0.65) {
              A.pitch.vel += 0.18;
              if (hash(rt.cursor * 3) > 0.6) { A.fE.vel += 3; A.shrug.vel += 4; }
            }
          }
        }
      }

      A.open.t = clamp(vOpen + E.mouthOpen * (talking ? 0.4 : 1), 0, 1);
      A.round.t = vRound + (thinking ? 0.12 : 0) + (expression === "surprised" && !talking ? 0.4 : 0);
      A.spread.t = clamp(vSpread + E.smile * (talking ? 0.3 : 0.6), -0.4, 1);
      A.smile.t = E.smile * (talking ? 0.6 : 1) - (thinking ? 0.1 : 0);
      A.browRaise.t = E.browRaise + rt.bump * 0.25 + (thinking ? 0.12 : 0) + (talking ? 0.05 * noise(t * 2, 5) : 0);
      A.browTilt.t = E.browTilt + (thinking ? 0.15 : 0);
      A.lid.t = E.lid + (thinking ? 0.06 : 0);
      A.squint.t = E.squint; A.wide.t = E.wide;
      rt.bump *= Math.exp(-dt * 3);

      const amp = talking ? 1.2 : 1;
      A.tilt.t = noise(t * 0.35, 21) * 0.010 * amp + A.yaw.v * 0.006 + A.roll.v * 0.02;
      A.shift.t = noise(t * 0.28, 22) * 0.014 * amp - A.yaw.v * 0.004;
      A.shrug.t = 0.12 * Math.sin(t * 1.7);
      A.fU.t = 0.03 + 0.02 * noise(t * 0.5, 15) + (talking ? 0.08 + 0.06 * noise(t * 0.8, 11) : 0);
      A.fE.t = 0.03 + (talking ? 0.2 + 0.15 * noise(t * 1.1, 12) : 0);
      A.fH.t = 0.05 * noise(t * 0.9, 17);
      A.hU.t = 0.02 * noise(t * 0.45, 16) + (talking ? 0.03 : 0);
      A.hE.t = 0.02; A.hH.t = 0.04 * noise(t * 0.8, 18);
      if (rt.g) {
        const kfs = GESTURES[rt.g.name];
        const gt = t - rt.g.t0;
        if (gt > kfs[kfs.length - 1][0] + 0.05) rt.g = null;
        else GKEYS.forEach((k) => { A[k].t += evalG(kfs, gt, k); });
      }

      if (t > rt.nextSaccade) {
        rt.nextSaccade = t + 0.7 + Math.random() * 2.2;
        rt.sacX = (Math.random() - 0.5) * 0.35; rt.sacY = (Math.random() - 0.5) * 0.2;
      }
      const look = talking ? 0.35 : 1;
      if (thinking) { A.gx.t = -0.45 + 0.1 * noise(t, 2); A.gy.t = -0.4; }
      else { A.gx.t = rt.sacX * look + rt.mx * 1.2; A.gy.t = rt.sacY * look + rt.my * 0.8; }

      const follow = 0.5;
      let yaw = rt.mx * 0.3 * follow + noise(t * 0.6, 1) * 0.05;
      let pitch = rt.my * 0.25 * follow + E.pitch + noise(t * 0.5, 2) * 0.03;
      let roll = E.roll + noise(t * 0.45, 3) * 0.025;
      if (talking) { pitch += A.open.v * 0.05; yaw += noise(t * 1.3, 4) * 0.03; roll += noise(t * 1.1, 8) * 0.01; }
      A.yaw.t = clamp(yaw, -1, 1); A.pitch.t = clamp(pitch, -1, 1); A.roll.t = roll;
      A.lean.t = 1;

      const sub = Math.ceil(dt / 0.016), h = dt / sub;
      for (let i = 0; i < sub; i++) POSE_KEYS.forEach((k) => stepSpring(A[k], h, SPRING_CFG[k][0], SPRING_CFG[k][1]));

      let blink = 0;
      if (rt.blinkT < 0 && t > rt.blinkAt) rt.blinkT = 0;
      if (rt.blinkT >= 0) {
        rt.blinkT += dt;
        const p = rt.blinkT / 0.2;
        if (p >= 1) { rt.blinkT = -1; rt.dbl = !rt.dbl && Math.random() < 0.15; rt.blinkAt = t + (rt.dbl ? 0.25 : 2 + Math.random() * 4); }
        else blink = Math.pow(Math.sin(Math.PI * p), 0.8);
      }

      const pose = {} as Pose;
      POSE_KEYS.forEach((k) => (pose[k] = A[k].v));
      pose.wide = clamp(pose.wide, 0, 1); pose.squint = clamp(pose.squint, 0, 1);
      const lid = clamp(pose.lid + (1 - pose.lid) * blink, 0, 1);

      const { W, H, ROWS, sc, sctx, gctx, lm, cutout, body, limbs, armW } = B;
      sctx.clearRect(0, 0, W, H);
      sctx.drawImage(body, 0, 0);
      for (const L of limbs) {
        const [u, e, hd] = L.role === "f" ? [pose.fU, pose.fE, pose.fH] : [pose.hU, pose.hE, pose.hH];
        drawLimb(sctx, cutout, L.arm, armAngles(L.sign, u, e, hd), armW);
      }
      if (lm) {
        const P = (i: number): Pt => ({ x: lm[i].x * W, y: lm[i].y * H });
        const ew = Math.hypot(P(133).x - P(33).x, P(133).y - P(33).y);
               drawBrow(sctx, BROW_A.map(P), pose, B, ew, B.hairVis.brA);
        drawBrow(sctx, BROW_B.map(P), pose, B, ew, B.hairVis.brB);
        EYES.forEach((m, i) => drawEye(sctx, P, m, pose, B, B.iris[i], lid, i === 0 ? B.hairVis.eyA : B.hairVis.eyB));
        drawMouth(sctx, P, pose, B);
      }

      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, COLS, ROWS);
      if (warper) {
        fillMesh(B, warper, pose, t);
        warper.render(sc);
        gctx.drawImage(warper.canvas, 0, 0, COLS, ROWS);
      } else {
        gctx.drawImage(sc, 0, 0, COLS, ROWS);
      }

      const d = gctx.getImageData(0, 0, COLS, ROWS).data;
      const span = Math.max(1, B.hi - B.lo);
      const top = RAMP.length - 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const cw = wrap.clientWidth / COLS;
      const chh = cw / charRatio();
      const pw = Math.round(COLS * cw * dpr), ph = Math.round(ROWS * chh * dpr);
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw; cv.height = ph;
        cv.style.width = `${COLS * cw}px`;
        cv.style.height = `${ROWS * chh}px`;
      }
      const c = cv.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, COLS * cw, ROWS * chh);
      c.font = `${chh}px ${FONT}`;
      c.textBaseline = "top";

      for (const bk of BUCKETS) bk.length = 0;
      const N = COLS * ROWS;
      if (LUM.length !== N) {
        LUM = new Float32Array(N); LUMB = new Float32Array(N);
        TS = new Float32Array(N); TW = new Float32Array(N); LOC = new Float32Array(N);
        CR = new Float32Array(N); CG = new Float32Array(N); CB = new Float32Array(N); V = new Float32Array(N);
      }

      for (let i = 0; i < N; i++) {
        const o = i * 4;
        LUM[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          const c0 = LUM[i];
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = clamp(y + dy, 0, ROWS - 1);
            for (let dx = -1; dx <= 1; dx++) {
              const j = yy * COLS + clamp(x + dx, 0, COLS - 1);
              s += d[j * 4 + 3] >= 128 ? LUM[j] : c0;
            }
          }
          LUMB[i] = s / 9;
        }
      }
      const R = BLUR_R;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          let s = 0, w = 0;
          for (let dx = -R; dx <= R; dx++) {
            const j = y * COLS + clamp(x + dx, 0, COLS - 1);
            if (d[j * 4 + 3] >= 128) { s += LUM[j]; w++; }
          }
          const i = y * COLS + x;
          TS[i] = s; TW[i] = w;
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          let s = 0, w = 0;
          for (let dy = -R; dy <= R; dy++) {
            const j = clamp(y + dy, 0, ROWS - 1) * COLS + x;
            s += TS[j]; w += TW[j];
          }
          const i = y * COLS + x;
          LOC[i] = w > 0 ? s / w : LUM[i];
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          let r = 0, g = 0, b = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = clamp(y + dy, 0, ROWS - 1);
            for (let dx = -1; dx <= 1; dx++) {
              const j = (yy * COLS + clamp(x + dx, 0, COLS - 1)) * 4;
              if (d[j + 3] < 128) continue;
              r += d[j]; g += d[j + 1]; b += d[j + 2]; n++;
            }
          }
          const i = y * COLS + x;
          if (n) { CR[i] = r / n; CG[i] = g / n; CB[i] = b / n; }
        }
      }
      HB.fill(0); let HN = 0;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (d[i * 4 + 3] < 128) { V[i] = -1; continue; }
          const lum = LUM[i] + SHARP * (LUM[i] - LUMB[i]);
          const base = clamp((lum - B.lo) / span, 0, 1);
          const loc = clamp(0.5 + (lum - LOC[i]) / (span * 0.9), 0, 1);
          const v0 = clamp(base * (1 - LOCAL) + loc * LOCAL, 0, 1);
          V[i] = v0; HB[Math.min(255, (v0 * 255) | 0)]++; HN++;
        }
      }
      for (let k = 0, acc = 0; k < 256; k++) { acc += HB[k]; CDF[k] = HN ? acc / HN : 0; }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (V[i] < 0) continue;
          let v = V[i] * (1 - EQ) + CDF[Math.min(255, (V[i] * 255) | 0)] * EQ;
          v = Math.pow(v, GAMMA);
          const idx = Math.max(1, clamp(Math.round(v * top), 0, top));
          let r = CR[i], g = CG[i], b = CB[i];
          const L = 0.299 * r + 0.587 * g + 0.114 * b;
          r = L + (r - L) * SAT; g = L + (g - L) * SAT; b = L + (b - L) * SAT;
          const vc = Math.pow(V[i], GAMMA);
          const T = (COLOR_LIFT + (1 - COLOR_LIFT) * vc) * 255 * COLOR_DIM;
          const k = Math.min(COLOR_GAIN, T / Math.max(L, 12));
          r = clamp(r * k, 0, 255); g = clamp(g * k, 0, 255); b = clamp(b * k, 0, 255);
          BUCKETS[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)].push(x, y, idx);
        }
      }

      const introProgress = introStartRef.current === 0 ? 0 : Math.min(1, (now - introStartRef.current) / 1500);
     const ease = 1 - Math.pow(1 - introProgress, 4); // easeOutQuart
// Siluet hitam solid di belakang karakter, supaya jam di belakangnya tertutup
//c.globalAlpha = introProgress;
//c.fillStyle = "#000";
//for (let y = 0; y < ROWS; y++) {
  //for (let x = 0; x < COLS; x++) {
   // if (V[y * COLS + x] < 0) continue; // sel di luar karakter (background) dilewati
    //c.fillRect(x * cw - 0.5, y * chh - 0.5, cw + 1, chh + 1);
  //}
//}
//c.globalAlpha = 1;
      for (let k = 0; k < 32768; k++) {
        const arr = BUCKETS[k];
        if (!arr.length) continue;
        c.fillStyle = `rgb(${(k >> 10) * 8},${((k >> 5) & 31) * 8},${(k & 31) * 8})`;
        
        for (let n = 0; n < arr.length; n += 3) {
          const cellX = arr[n];
          const cellY = arr[n + 1];
          const charIdx = arr[n + 2];
          
          const targetX = cellX * cw;
          const targetY = cellY * chh;

          if (introProgress < 1) {
            const seed = cellX * 1000 + cellY;
            
            // Titik mulai random di seluruh layar (bukan dari bounding box)
            const startX = hash(seed) * (COLS * cw);
            const startY = hash(seed + 99) * (ROWS * chh);

            // Gambar dari titik random (startX/startY) menuju posisi wajah (targetX/targetY)
            const drawX = startX + (targetX - startX) * ease;
            const drawY = startY + (targetY - startY) * ease;

            c.globalAlpha = Math.min(1, introProgress * 3); // Fade in perlahan
            c.fillText(RAMP[charIdx], drawX, drawY);
          } else {
            c.globalAlpha = 1;
            c.fillText(RAMP[charIdx], targetX, targetY);
          }
        }
      }
      c.globalAlpha = 1;
    };

    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); };
  }, []);

  return (
    <div ref={wrapRef} className="w-full h-full flex items-end justify-center pointer-events-none">
      <canvas ref={cvRef} className="block object-contain" />
    </div>
  );
}
export default memo(LiveAsciiFace);