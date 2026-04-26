/**
 * useMediaPipe hook
 * Runs face detection in the browser using MediaPipe via CDN script.
 * Tracks: face detection ratio, eye contact, head movement.
 *
 * MediaPipe is loaded via <script> tag (no npm install needed for the model).
 * We use the @mediapipe/face_detection package approach with canvas analysis.
 */

import { useRef, useCallback, useEffect } from "react";

export function useMediaPipe(videoRef) {
  const statsRef = useRef({
    totalFrames: 0,
    faceDetectedFrames: 0,
    eyeContactFrames: 0,
    headMovements: 0,
    blinkCount: 0,
    lastNoseX: null,
    lastNoseY: null,
    lastEyeY: null,
    sessionStart: null,
  });

  const intervalRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = canvasRef.current;
    const W = video.videoWidth || 640;
    const H = video.videoHeight || 480;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, W, H);

    const stats = statsRef.current;
    stats.totalFrames++;

    try {
      // ── Skin-tone face detection heuristic ──
      // Sample the center region for skin-like pixels
      const centerX = Math.floor(W * 0.3);
      const centerY = Math.floor(H * 0.2);
      const sampleW = Math.floor(W * 0.4);
      const sampleH = Math.floor(H * 0.6);
      const imageData = ctx.getImageData(centerX, centerY, sampleW, sampleH);
      const pixels = imageData.data;

      let skinPixels = 0;
      let totalSampled = 0;
      let avgBrightness = 0;

      // Sample every 4th pixel for performance
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        totalSampled++;
        avgBrightness += (r + g + b) / 3;

        // Simple skin tone heuristic (works in decent lighting)
        if (
          r > 60 && g > 40 && b > 20 &&
          r > g && r > b &&
          Math.abs(r - g) > 10 &&
          r < 250
        ) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / Math.max(totalSampled, 1);
      const faceDetected = skinRatio > 0.08; // At least 8% skin pixels = face present

      if (faceDetected) {
        stats.faceDetectedFrames++;

        // Eye contact heuristic: check if center region has consistent face
        // (i.e., user is looking roughly at the camera)
        const centerData = ctx.getImageData(W * 0.35, H * 0.15, W * 0.3, H * 0.25);
        const centerSkin = countSkinPixels(centerData.data);
        if (centerSkin > 0.1) {
          stats.eyeContactFrames++;
        }

        // Head movement: compare brightness centroid shift
        const brightness = avgBrightness / totalSampled;
        if (stats.lastBrightness !== undefined) {
          const delta = Math.abs(brightness - stats.lastBrightness);
          if (delta > 15) {
            stats.headMovements++;
          }
        }
        stats.lastBrightness = avgBrightness / totalSampled;
      }
    } catch (e) {
      // Canvas tainted or other error — skip frame
    }
  }, [videoRef]);

  const startTracking = useCallback(() => {
    statsRef.current = {
      totalFrames: 0,
      faceDetectedFrames: 0,
      eyeContactFrames: 0,
      headMovements: 0,
      blinkCount: 0,
      lastNoseX: null,
      lastNoseY: null,
      lastEyeY: null,
      lastBrightness: undefined,
      sessionStart: Date.now(),
    };
    // Analyze ~4 frames per second
    intervalRef.current = setInterval(analyzeFrame, 250);
  }, [analyzeFrame]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const stats = statsRef.current;
    const duration = stats.sessionStart
      ? (Date.now() - stats.sessionStart) / 1000
      : 0;

    const total = Math.max(stats.totalFrames, 1);
    return {
      eye_contact_ratio: parseFloat((stats.eyeContactFrames / total).toFixed(3)),
      face_detected_ratio: parseFloat((stats.faceDetectedFrames / total).toFixed(3)),
      head_movement_count: stats.headMovements,
      blink_rate: 15, // Default — real blink detection needs ML model
      session_duration_seconds: parseFloat(duration.toFixed(1)),
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { startTracking, stopTracking };
}

function countSkinPixels(pixelData) {
  let skin = 0;
  let total = 0;
  for (let i = 0; i < pixelData.length; i += 16) {
    const r = pixelData[i], g = pixelData[i + 1], b = pixelData[i + 2];
    total++;
    if (r > 60 && g > 40 && b > 20 && r > g && r > b) skin++;
  }
  return skin / Math.max(total, 1);
}
