// hooks/useFaceLandmarks.ts
"use client";

import { useCallback, useState } from "react";
import { FaceLandmarker, ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

if (typeof window !== "undefined") {
  const w = window as unknown as { __mpInfoFiltered?: boolean };
  if (!w.__mpInfoFiltered) {
    w.__mpInfoFiltered = true;
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      // 🟢 Saring agar error WebGL Tauri tidak memicu overlay merah Next.js
      if (
        msg.startsWith("INFO:") || 
        msg.includes("E1102") || 
        msg.includes("kGpuService") || 
        msg.includes("emscripten_webgl")
      ) return;
      
      origError(...args);
    };
  }
}
export type Landmark = { x: number; y: number; z: number };

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let imageSegmenterPromise: Promise<ImageSegmenter> | null = null;

async function getLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, 
          delegate: "CPU" // 🟢 Paksa CPU
        },
        runningMode: "IMAGE", numFaces: 1,
      });
    })();
  }
  return faceLandmarkerPromise;
}

async function getSegmenter() {
  if (!imageSegmenterPromise) {
    imageSegmenterPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`, 
          delegate: "CPU" // 🟢 Paksa CPU
        },
        runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false,
      });
    })();
  }
  return imageSegmenterPromise;
}

export function useFaceLandmarks() {
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [mask, setMask] = useState<Uint8Array | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const detect = useCallback(async (image: HTMLImageElement) => {
    setIsDetecting(true);
    try {
      const landmarker = await getLandmarker();
      const segmenter = await getSegmenter();
      await new Promise((r) => setTimeout(r, 50)); // 🟢 beri jeda agar UI sempat render sebelum inferensi

      if (!image.complete || image.naturalWidth === 0) throw new Error("Gambar belum siap.");

      const faceResult = landmarker.detect(image);
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        setLandmarks(faceResult.faceLandmarks[0]);
      } else {
        setLandmarks(null);
      }

      const segmentResult = segmenter.segment(image);
      const rawMask = segmentResult.categoryMask?.getAsUint8Array();
      if (rawMask) setMask(rawMask);

    } catch (err: any) {
      const msg = err?.message || "";
      
      // 🟢 Filter error khusus Tauri/WebKitGTK agar console tidak merah
      if (msg.includes("kGpuService") || msg.includes("emscripten_webgl")) {
        console.warn("[MediaPipe] WebGL tidak didukung di Tauri/WebKitGTK. Wajah akan statis.");
      } else if (!msg.includes("XNNPACK")) {
        console.error("MediaPipe Error:", err);
      }
    } finally {
      setIsDetecting(false);
    }
  }, []);

  return { landmarks, mask, isDetecting, detect };
}