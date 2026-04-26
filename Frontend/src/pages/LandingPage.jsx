import { useState } from "react";

const JOB_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Product Manager",
  "System Design Architect",
  "Full Stack Developer",
];

const TOPICS = {
  "Software Engineer": "software engineering",
  "Frontend Developer": "frontend development, React, CSS",
  "Backend Developer": "backend systems, APIs, databases",
  "Data Scientist": "data science, statistics, machine learning",
  "Machine Learning Engineer": "machine learning, deep learning, MLOps",
  "DevOps Engineer": "DevOps, CI/CD, cloud infrastructure",
  "Product Manager": "product management, strategy, user stories",
  "System Design Architect": "system design, scalability, architecture",
  "Full Stack Developer": "full stack development, JavaScript, databases",
};

export default function LandingPage({ config, setConfig, onStart }) {
  const [checking, setChecking] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);

  const checkBackend = async () => {
    setChecking(true);
    try {
      const r = await fetch("http://localhost:8000/health");
      if (r.ok) {
        setBackendStatus("ok");
      } else {
        setBackendStatus("error");
      }
    } catch {
      setBackendStatus("error");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 40px", borderBottom: "1px solid var(--border)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, background: "var(--accent)",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span style={{ fontSize: 18 }}>⬡</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
              TrueEval AI INTERVIEWER
            </span>
          </div>
          <span className="badge badge-accent">v1.0 • Local AI</span>
        </header>

        {/* Hero */}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>
          <div style={{ maxWidth: 700, width: "100%" }}>

            {/* Title */}
            <div className="fade-in" style={{ marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "4px 14px", border: "1px solid var(--accent)",
                borderRadius: 100, fontSize: 11, color: "var(--accent)",
                fontWeight: 600, letterSpacing: "0.1em", marginBottom: 24,
                textTransform: "uppercase"
              }}>
                <span className="rec-dot" style={{ background: "var(--accent)" }}></span>
                All models run locally • Zero API costs
              </div>

              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6vw, 72px)",
                fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em",
                marginBottom: 20
              }}>
                AI-Powered<br />
                <span style={{ color: "var(--accent)" }}>Interview</span> Trainer
              </h1>

              <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>
                Practice with an AI interviewer powered by local LLMs, Whisper speech recognition,
                and real-time face analysis. No data leaves your machine.
              </p>
            </div>

            {/* Tech stack badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 40 }}>
              {[
                ["🧠", "Ollama + Mistral"],
                ["🎤", "Whisper STT"],
                ["👁️", "MediaPipe"],
                ["🔊", "Librosa"],
                ["⚡", "FastAPI"],
              ].map(([icon, label]) => (
                <span key={label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", background: "var(--surface2)",
                  border: "1px solid var(--border)", borderRadius: 100,
                  fontSize: 12, color: "var(--text-muted)"
                }}>
                  {icon} {label}
                </span>
              ))}
            </div>

            {/* Config card */}
            <div className="card fade-in" style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 24, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Configure Your Session
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Job Role
                  </label>
                  <select
                    value={config.jobRole}
                    onChange={(e) => setConfig({
                      ...config,
                      jobRole: e.target.value,
                      topic: TOPICS[e.target.value] || "software engineering"
                    })}
                  >
                    {JOB_ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    No. of Questions
                  </label>
                  <select
                    value={config.totalQuestions}
                    onChange={(e) => setConfig({ ...config, totalQuestions: +e.target.value })}
                  >
                    {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Topic Focus
                </label>
                <input
                  value={config.topic}
                  onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                  placeholder="e.g. React, system design, Python..."
                />
              </div>
            </div>

            {/* Backend check */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button className="btn" onClick={checkBackend} disabled={checking}>
                {checking ? "Checking..." : "Check Backend"}
              </button>
              {backendStatus === "ok" && (
                <span style={{ color: "var(--success)", fontSize: 13 }}>✓ Backend online</span>
              )}
              {backendStatus === "error" && (
                <span style={{ color: "var(--error)", fontSize: 13 }}>✗ Backend offline — run: uvicorn main:app</span>
              )}
            </div>

            {/* Start button */}
            <button className="btn btn-primary" onClick={onStart} style={{ padding: "16px 40px", fontSize: 15 }}>
              ▶ Start Interview
            </button>

            {/* Requirements note */}
            <p style={{ marginTop: 20, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
              Requires: Ollama running locally • Python backend started • Camera + microphone access
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
