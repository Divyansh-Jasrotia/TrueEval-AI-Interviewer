import { useState, useRef, useEffect, useCallback } from "react";
import WebcamView from "../components/WebcamView";
import QuestionCard from "../components/QuestionCard";
import AnswerFeedback from "../components/AnswerFeedback";
import { useRecorder } from "../hooks/useRecorder";
import { useMediaPipe } from "../hooks/useMediaPipe";
import {
  generateQuestion,
  transcribeAudio,
  evaluateAnswer,
  analyzeAudio,
  analyzeFace,
  getFinalReport,
  getNextDifficulty,
} from "../utils/api";

const PHASE = {
  LOADING_QUESTION: "loading_question",
  ASKING: "asking",
  RECORDING: "recording",
  PROCESSING: "processing",
  FEEDBACK: "feedback",
  DONE: "done",
};

export default function InterviewPage({ config, onFinish }) {
  // FIX: Freeze config into a ref on first render so it never changes identity.
  // If the parent re-renders and passes a new config object reference,
  // loadQuestion would be recreated and the useEffect would re-fire mid-session,
  // causing the question to refresh unexpectedly while recording.
  const configRef = useRef(config);

  const [phase, setPhase] = useState(PHASE.LOADING_QUESTION);
  const [questionNum, setQuestionNum] = useState(1);
  const [difficulty, setDifficulty] = useState("easy");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [voiceData, setVoiceData] = useState(null);
  const [status, setStatus] = useState("Initializing...");
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState(null);

  // Accumulated data across all questions
  const allEvaluations = useRef([]);
  const allFaceScores = useRef([]);
  const allVoiceScores = useRef([]);
  const prevQuestions = useRef([]);
  const timerRef = useRef(null);
  const startRef = useRef(null); // Date.now() anchor for accurate timer
  const audioBlob = useRef(null);

  const videoRef = useRef(null);
  const { startRecording, stopRecording, isRecording } = useRecorder();
  const { startTracking, stopTracking } = useMediaPipe(videoRef);

  // ── Timer (FIX 1: Date-anchored — no drift/skipping) ──
  const startTimer = useCallback(() => {
    setTimer(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500); // poll every 500ms — catches every second reliably
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  // ── Load next question ──
  const loadQuestion = useCallback(async (qNum, diff) => {
    setPhase(PHASE.LOADING_QUESTION);
    setStatus("🧠 Generating question...");
    setEvaluation(null);
    setTranscript("");
    setVoiceData(null);

    try {
      const q = await generateQuestion({
        topic: configRef.current.topic,
        difficulty: diff,
        question_number: qNum,
        previous_questions: prevQuestions.current,
        job_role: configRef.current.jobRole,
      });
      setCurrentQuestion(q);
      prevQuestions.current.push(q.question);
      setPhase(PHASE.ASKING);
      setStatus("Read the question, then click Record when ready.");
    } catch (err) {
      setError(`Failed to generate question: ${err.message}\n\nMake sure Ollama is running: ollama serve`);
    }
  }, []); // stable — config read from ref, never from closure

  // Initial load
  useEffect(() => {
    loadQuestion(1, "easy");
    return () => clearTimer();
  }, []); // eslint-disable-line

  // ── Start recording ──
  const handleStartRecording = async () => {
    setPhase(PHASE.RECORDING);
    setStatus("🔴 Recording... Click Stop when done.");
    startTimer();
    startTracking();
    await startRecording();
  };

  // ── Stop recording → process ──
  const handleStopRecording = async () => {
    clearTimer();
    setPhase(PHASE.PROCESSING);
    setStatus("⏳ Processing your answer...");
    setError(null);

    // FIX 2: Clear stale blob from previous question, then give MediaRecorder
    // 100ms to flush its final dataavailable chunk before we read the new blob.
    audioBlob.current = null;
    await new Promise((r) => setTimeout(r, 100));
    const blob = await stopRecording();
    audioBlob.current = blob;

    // Stop face tracking regardless — face not visible is OK
    const faceData = stopTracking();

    if (!blob || blob.size < 100) {
      setError("Recording failed — no audio captured. Check microphone permissions.");
      setPhase(PHASE.ASKING);
      return;
    }

    // ── Step 1: Transcribe (this is the critical step) ──
    let text = "";
    try {
      setStatus("🎤 Transcribing speech...");
      const sttResult = await transcribeAudio(blob);
      text = (sttResult.transcript || "").trim();
    } catch (err) {
      setError(`Transcription failed: ${err.message}\n\nMake sure the backend is running and Whisper is installed.`);
      setPhase(PHASE.ASKING);
      return;
    }

    if (!text || text.length < 3) {
      setError("No speech detected. Please speak louder or check your microphone, then try again.");
      setPhase(PHASE.ASKING);
      return;
    }
    setTranscript(text);

    // ── Step 2: Voice analysis (non-critical — never blocks interview) ──
    let voice = null;
    try {
      setStatus("🔊 Analyzing voice...");
      voice = await analyzeAudio(blob);
      setVoiceData(voice);
      if (voice?.voice_score) allVoiceScores.current.push(voice.voice_score);
    } catch {
      // Voice analysis failing is fine — interview continues
      setVoiceData(null);
    }

    // ── Step 3: Face analysis (non-critical — face not visible is OK) ──
    try {
      setStatus("👁️ Scoring behavior...");
      const faceScore = await analyzeFace(faceData);
      if (faceScore?.confidence_score != null) {
        allFaceScores.current.push(faceScore.confidence_score);
      }
    } catch {
      // Face not visible or analysis failed — just skip, don't error
    }

    // ── Step 4: Evaluate answer (critical) ──
    let evalResult = null;
    try {
      setStatus("🧠 Evaluating answer...");
      evalResult = await evaluateAnswer({
        question: currentQuestion.question,
        answer: text,
        expected_keywords: currentQuestion.expected_keywords || [],
        difficulty,
        job_role: configRef.current.jobRole,
      });
      setEvaluation(evalResult);
      allEvaluations.current.push(evalResult);
    } catch (err) {
      setError(`Evaluation failed: ${err.message}\n\nMake sure Ollama is running: ollama serve`);
      setPhase(PHASE.ASKING);
      return;
    }

    // ── Step 5: Adapt difficulty (non-critical) ──
    try {
      const nextDiff = await getNextDifficulty(evalResult.overall_score, difficulty);
      setDifficulty(nextDiff.next_difficulty);
    } catch {
      // Keep current difficulty if this fails
    }

    setPhase(PHASE.FEEDBACK);
    setStatus("✅ Feedback ready!");
  };

  // ── Next question or finish ──
  const handleNext = async () => {
    if (questionNum >= configRef.current.totalQuestions) {
      // Generate final report
      setPhase(PHASE.LOADING_QUESTION);
      setStatus("📊 Generating your final report...");
      try {
        const report = await getFinalReport(
          allEvaluations.current,
          allFaceScores.current,
          allVoiceScores.current
        );
        report.evaluations = allEvaluations.current;
        report.jobRole = configRef.current.jobRole;
        onFinish(report);
      } catch (err) {
        // Build local report if API fails
        const evals = allEvaluations.current;
        const avg = (arr, key) => arr.reduce((s, e) => s + (e[key] || 0), 0) / Math.max(arr.length, 1);
        onFinish({
          technical_score: parseFloat(avg(evals, "correctness_score").toFixed(2)),
          clarity_score: parseFloat(avg(evals, "clarity_score").toFixed(2)),
          depth_score: parseFloat(avg(evals, "depth_score").toFixed(2)),
          overall_score: parseFloat(avg(evals, "overall_score").toFixed(2)),
          communication_score: 0.6,
          confidence_score: allFaceScores.current.length
            ? allFaceScores.current.reduce((a, b) => a + b, 0) / allFaceScores.current.length
            : 0.5,
          strengths: evals.flatMap((e) => e.strengths).slice(0, 4),
          weaknesses: evals.flatMap((e) => e.weaknesses).slice(0, 4),
          improvement_tips: evals.flatMap((e) => e.improvement_tips).slice(0, 4),
          questions_answered: evals.length,
          grade: "Complete",
          evaluations: evals,
          jobRole: configRef.current.jobRole,
        });
      }
    } else {
      const nextNum = questionNum + 1;
      setQuestionNum(nextNum);
      loadQuestion(nextNum, difficulty);
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 500, borderColor: "var(--error)" }}>
          <h2 style={{ color: "var(--error)", marginBottom: 12 }}>Error</h2>
          <pre style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "pre-wrap", marginBottom: 20 }}>{error}</pre>
          <button className="btn" onClick={() => { setError(null); setPhase(PHASE.ASKING); }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)"
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>
          ⬡ TrueEval AI INTERVIEWER
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {phase === PHASE.RECORDING && (
            <span style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>
              <span className="rec-dot" style={{ marginRight: 6 }}></span>
              {formatTime(timer)}
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {configRef.current.jobRole} · {questionNum}/{configRef.current.totalQuestions}
          </span>
          <div className="progress-bar" style={{ width: 120 }}>
            <div className="progress-fill" style={{ width: `${(questionNum / configRef.current.totalQuestions) * 100}%` }} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: 0,
        maxHeight: "calc(100vh - 65px)",
        overflow: "auto"
      }}>

        {/* Left: Question + Feedback */}
        <div style={{ padding: 28, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Status */}
          <div style={{
            padding: "10px 16px", background: "var(--surface2)",
            borderRadius: 8, border: "1px solid var(--border)",
            fontSize: 12, color: "var(--text-muted)"
          }}>
            {status}
          </div>

          {/* Question */}
          {(phase === PHASE.ASKING || phase === PHASE.RECORDING || phase === PHASE.PROCESSING || phase === PHASE.FEEDBACK) && (
            <QuestionCard
              question={currentQuestion}
              questionNumber={questionNum}
              totalQuestions={configRef.current.totalQuestions}
              difficulty={difficulty}
            />
          )}

          {/* Loading skeleton */}
          {phase === PHASE.LOADING_QUESTION && (
            <div className="card" style={{ opacity: 0.5 }}>
              <div style={{ height: 16, background: "var(--surface2)", borderRadius: 4, marginBottom: 12, width: "60%" }} />
              <div style={{ height: 40, background: "var(--surface2)", borderRadius: 4 }} />
            </div>
          )}

          {/* Per-question feedback */}
          {phase === PHASE.FEEDBACK && (
            <AnswerFeedback
              evaluation={evaluation}
              transcript={transcript}
              voiceData={voiceData}
            />
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 8 }}>
            {phase === PHASE.ASKING && (
              <button className="btn btn-primary" onClick={handleStartRecording}>
                🎤 Start Recording
              </button>
            )}
            {phase === PHASE.RECORDING && (
              <button className="btn btn-danger" onClick={handleStopRecording}>
                ⏹ Stop Recording
              </button>
            )}
            {phase === PHASE.PROCESSING && (
              <button className="btn" disabled>
                ⏳ Processing...
              </button>
            )}
            {phase === PHASE.FEEDBACK && (
              <button className="btn btn-primary" onClick={handleNext}>
                {questionNum >= configRef.current.totalQuestions ? "📊 View Final Report" : "→ Next Question"}
              </button>
            )}
          </div>
        </div>

        {/* Right: Webcam + live stats */}
        <div style={{
          padding: 20, borderLeft: "1px solid var(--border)",
          background: "var(--surface)", display: "flex",
          flexDirection: "column", gap: 16, overflowY: "auto"
        }}>
          <WebcamView videoRef={videoRef} isRecording={phase === PHASE.RECORDING} />

          {/* Live metrics during recording */}
          {phase === PHASE.RECORDING && (
            <div className="card fade-in">
              <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>
                Live Analysis
              </div>
              {[
                ["👁 Eye Contact", "Tracking..."],
                ["🔊 Voice", "Recording..."],
                ["🧠 Behavior", "Analyzing..."],
              ].map(([label, val]) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                  fontSize: 12
                }}>
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ color: "var(--accent)" }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Show face score after processing */}
          {phase === PHASE.FEEDBACK && allFaceScores.current.length > 0 && (
            <div className="card fade-in">
              <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>
                Behavior Score
              </div>
              <div style={{
                fontSize: 32, fontWeight: 800,
                color: "var(--accent2)", textAlign: "center", padding: "8px 0"
              }}>
                {Math.round(allFaceScores.current[allFaceScores.current.length - 1] * 100)}%
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Confidence Score
              </div>
            </div>
          )}

          {/* Tips panel */}
          <div style={{
            padding: "14px 16px",
            background: "rgba(0,180,255,0.05)",
            border: "1px solid rgba(0,180,255,0.15)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}>
            <div style={{ color: "var(--accent2)", fontWeight: 600, marginBottom: 8, fontSize: 11, textTransform: "uppercase" }}>
              Interview Tips
            </div>
            • Maintain eye contact with camera<br />
            • Speak clearly at a moderate pace<br />
            • Use specific examples (STAR method)<br />
            • Structure your answer clearly
          </div>
        </div>
      </div>
    </div>
  );
}   