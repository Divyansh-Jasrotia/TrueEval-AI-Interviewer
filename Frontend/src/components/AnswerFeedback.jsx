function ScoreBar({ label, value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--warn)" : "var(--error)";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.8s ease",
        }} />
      </div>
    </div>
  );
}

export default function AnswerFeedback({ evaluation, transcript, voiceData }) {
  if (!evaluation) return null;

  return (
    <div className="card fade-in" style={{ marginTop: 16 }}>
      <h3 style={{
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
        color: "var(--text-muted)", textTransform: "uppercase",
        letterSpacing: "0.1em", marginBottom: 20
      }}>
        Answer Feedback
      </h3>

      {/* Transcript */}
      {transcript && (
        <div style={{
          padding: "12px 16px",
          background: "var(--surface2)",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "var(--text)",
          lineHeight: 1.6,
          fontStyle: "italic",
          border: "1px solid var(--border)"
        }}>
          <span style={{ color: "var(--accent2)", fontStyle: "normal", fontWeight: 600, fontSize: 11 }}>
            YOUR ANSWER ›
          </span>{" "}
          {transcript}
        </div>
      )}

      {/* Scores */}
      <div style={{ marginBottom: 16 }}>
        <ScoreBar label="Correctness" value={evaluation.correctness_score} />
        <ScoreBar label="Clarity" value={evaluation.clarity_score} />
        <ScoreBar label="Depth" value={evaluation.depth_score} />
      </div>

      {/* Voice metrics */}
      {voiceData && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8, marginBottom: 16
        }}>
          {[
            ["Speaking Rate", `${voiceData.speaking_rate}/s`],
            ["Pause Ratio", `${Math.round(voiceData.pause_ratio * 100)}%`],
            ["Voice Score", `${Math.round(voiceData.voice_score * 100)}%`],
          ].map(([label, val]) => (
            <div key={label} style={{
              textAlign: "center", padding: "10px 8px",
              background: "var(--surface2)", borderRadius: 8,
              border: "1px solid var(--border)"
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent2)", marginBottom: 2 }}>
                {val}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed feedback */}
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
        {evaluation.detailed_feedback}
      </p>

      {/* Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
            ✓ Strengths
          </div>
          {evaluation.strengths?.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 8 }}>
              • {s}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--error)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
            ✗ Weaknesses
          </div>
          {evaluation.weaknesses?.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 8 }}>
              • {w}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
