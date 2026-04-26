function ScoreGauge({ label, value, color = "var(--accent)" }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderRadius: 12, padding: "20px 16px",
      textAlign: "center"
    }}>
      <div style={{
        fontSize: 36, fontWeight: 800,
        color, marginBottom: 4,
        fontFamily: "var(--font-display)"
      }}>
        {pct}<span style={{ fontSize: 18 }}>%</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div className="progress-bar" style={{ marginTop: 10 }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color, borderRadius: 3,
          transition: "width 1s ease"
        }} />
      </div>
    </div>
  );
}

function ListSection({ title, items, color, icon }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{
        fontSize: 11, color, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: 10, display: "flex", alignItems: "center", gap: 6
      }}>
        {icon} {title}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          padding: "8px 12px", marginBottom: 6,
          background: "var(--surface2)",
          borderRadius: 6, fontSize: 13,
          color: "var(--text-muted)",
          borderLeft: `3px solid ${color}`,
          lineHeight: 1.5
        }}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default function ReportPage({ report, onRestart }) {
  if (!report) return null;

  const gradeColors = {
    Excellent: "var(--success)",
    Good: "var(--accent)",
    Average: "var(--warn)",
    "Below Average": "var(--error)",
    "Needs Improvement": "var(--error)",
    Complete: "var(--accent2)"
  };

  const gradeColor = gradeColors[report.grade] || "var(--accent)";

  return (
    <div style={{ minHeight: "100vh", overflowY: "auto" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", position: "sticky", top: 0, zIndex: 10
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>
          ⬡ TrueEval AI INTERVIEWER
        </span>
        <button className="btn" onClick={onRestart}>↩ Start New Interview</button>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Title + Grade */}
        <div className="fade-in" style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 100, height: 100, borderRadius: "50%",
            border: `3px solid ${gradeColor}`,
            boxShadow: `0 0 40px ${gradeColor}40`,
            fontSize: 36, marginBottom: 20, background: "var(--surface)"
          }}>
            {report.grade === "Excellent" ? "🏆" :
             report.grade === "Good" ? "🎯" :
             report.grade === "Average" ? "📊" : "📈"}
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 42,
            fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8
          }}>
            Interview Complete
          </h1>
          <div style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 12 }}>
            {report.jobRole} · {report.questions_answered} questions answered
          </div>
          <span style={{
            display: "inline-block", padding: "8px 24px",
            borderRadius: 100, border: `2px solid ${gradeColor}`,
            color: gradeColor, fontWeight: 700, fontSize: 16,
            background: `${gradeColor}15`,
            fontFamily: "var(--font-display)"
          }}>
            {report.grade}
          </span>
        </div>

        {/* Score grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12, marginBottom: 40
        }}>
          <ScoreGauge label="Technical" value={report.technical_score} color="var(--accent)" />
          <ScoreGauge label="Clarity" value={report.clarity_score} color="var(--accent2)" />
          <ScoreGauge label="Depth" value={report.depth_score} color="var(--warn)" />
          <ScoreGauge label="Communication" value={report.communication_score} color="var(--success)" />
          <ScoreGauge label="Confidence" value={report.confidence_score} color="#b388ff" />
          <ScoreGauge label="Overall" value={report.overall_score} color={gradeColor} />
        </div>

        {/* Strengths / Weaknesses / Tips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
          <ListSection
            title="Strengths"
            items={report.strengths}
            color="var(--success)"
            icon="✓"
          />
          <ListSection
            title="Areas to Improve"
            items={report.weaknesses}
            color="var(--error)"
            icon="△"
          />
        </div>

        <ListSection
          title="Actionable Improvement Tips"
          items={report.improvement_tips}
          color="var(--accent2)"
          icon="💡"
        />

        {/* Per-question breakdown */}
        {report.evaluations?.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20,
              marginBottom: 20, letterSpacing: "-0.02em"
            }}>
              Question-by-Question Breakdown
            </h2>

            {report.evaluations.map((ev, i) => (
              <div key={i} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
                    Question {i + 1}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      ["Correctness", ev.correctness_score],
                      ["Clarity", ev.clarity_score],
                      ["Depth", ev.depth_score],
                    ].map(([label, val]) => (
                      <span key={label} style={{
                        fontSize: 11, padding: "3px 10px",
                        borderRadius: 100, border: "1px solid var(--border)",
                        color: val >= 0.7 ? "var(--success)" : val >= 0.4 ? "var(--warn)" : "var(--error)"
                      }}>
                        {label}: {Math.round(val * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {ev.detailed_feedback}
                </p>
                {ev.model_answer_summary && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px",
                    background: "rgba(0,255,157,0.05)",
                    borderRadius: 6, fontSize: 12,
                    color: "var(--text-muted)",
                    borderLeft: "3px solid var(--accent)"
                  }}>
                    <strong style={{ color: "var(--accent)" }}>Ideal answer: </strong>
                    {ev.model_answer_summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-primary" onClick={onRestart} style={{ padding: "16px 48px", fontSize: 15 }}>
            ↩ Practice Again
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-dim)" }}>
            Review the per-question breakdown above to understand where to focus your preparation.
          </p>
        </div>
      </div>
    </div>
  );
}
