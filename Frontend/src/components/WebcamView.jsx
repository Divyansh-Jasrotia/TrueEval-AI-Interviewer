import { useEffect, useRef } from "react";

export default function WebcamView({ videoRef, isRecording }) {
  const localRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        streamRef.current = stream;
        const vid = videoRef?.current || localRef.current;
        if (vid) {
          vid.srcObject = stream;
          vid.play().catch(() => {});
        }
      } catch (e) {
        console.warn("Camera access denied:", e);
      }
    };
    startCam();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  return (
    <div style={{
      position: "relative",
      borderRadius: 12,
      overflow: "hidden",
      border: isRecording
        ? "2px solid var(--error)"
        : "1px solid var(--border)",
      background: "#000",
      transition: "border-color 0.3s",
      boxShadow: isRecording ? "0 0 20px rgba(248,81,73,0.2)" : "none",
    }}>
      <video
        ref={videoRef || localRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          display: "block",
          transform: "scaleX(-1)", // Mirror effect
          aspectRatio: "4/3",
          objectFit: "cover",
        }}
      />

      {/* Recording overlay */}
      {isRecording && (
        <div style={{
          position: "absolute", top: 12, left: 12,
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.7)", padding: "6px 12px",
          borderRadius: 100, backdropFilter: "blur(4px)"
        }}>
          <span className="rec-dot"></span>
          <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 600, letterSpacing: "0.1em" }}>
            REC
          </span>
        </div>
      )}

      {/* Face tracking indicator */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        background: "rgba(0,0,0,0.7)", padding: "6px 10px",
        borderRadius: 100, backdropFilter: "blur(4px)",
        fontSize: 10, color: "var(--accent)", letterSpacing: "0.05em"
      }}>
        👁 TRACKING
      </div>
    </div>
  );
}
