const CATEGORY_COLORS = {
  technical: "badge-blue",
  behavioral: "badge-green",
  situational: "badge-yellow",
  "problem-solving": "badge-accent",
};

export default function QuestionCard({ question, questionNumber, totalQuestions, difficulty }) {
  if (!question) return null;

  return (
    <div className="card fade-in" style={{ borderColor: "var(--accent)", borderWidth: 1 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <span className={`badge ${CATEGORY_COLORS[question.category] || "badge-accent"}`}>
            {question.category}
          </span>
          <span className={`badge ${
            difficulty === "hard" ? "badge-red" :
            difficulty === "easy" ? "badge-green" : "badge-yellow"
          }`}>
            {difficulty}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
          Q{questionNumber} / {totalQuestions}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div
          className="progress-fill"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question text */}
      <p style={{
        fontSize: 18,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        lineHeight: 1.5,
        color: "var(--text)",
        marginBottom: 16,
      }}>
        {question.question}
      </p>

      {/* Tips */}
      {question.tips && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(0,255,157,0.05)",
          border: "1px solid rgba(0,255,157,0.15)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>💡 Tip: </span>
          {question.tips}
        </div>
      )}
    </div>
  );
}
