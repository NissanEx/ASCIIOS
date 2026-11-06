// hooks/useBodyPose.ts
"use client";

import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let posePromise: Promise<PoseLandmarker> | null = null;

export function getPose() {
  if (!posePromise) {
    posePromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          delegate: "CPU"
        },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    })();
  }
  return posePromise;
}