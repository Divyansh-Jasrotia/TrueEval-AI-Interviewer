/**
 * useRecorder hook
 * Records audio from the microphone and returns a Blob (webm/opus).
 */

import { useRef, useState, useCallback, useEffect } from "react";

export function useRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null); // FIX: track stream separately for cleanup
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  // FIX: stop mic if component unmounts while recording (e.g. page change)
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    // FIX: stop any previous stream before starting a new one —
    // this is what causes the "stuck mic" and stale blob on 2nd recording
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream; // save ref for cleanup

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access.");
      console.error("Recording error:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        // FIX: stop tracks via streamRef (more reliable than recorder.stream)
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return { startRecording, stopRecording, isRecording, error };
}