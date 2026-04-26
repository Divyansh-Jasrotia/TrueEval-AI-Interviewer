const BASE = "http://localhost:8000/api";

/** Generate an interview question */
export async function generateQuestion(params) {
  const res = await fetch(`${BASE}/questions/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Question generation failed: ${res.statusText}`);
  return res.json();
}

/** Transcribe audio blob using local Whisper */
export async function transcribeAudio(blob) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  const res = await fetch(`${BASE}/analysis/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.statusText}`);
  return res.json();
}

/** Evaluate an answer with the local LLM */
export async function evaluateAnswer(params) {
  const res = await fetch(`${BASE}/evaluation/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Evaluation failed: ${res.statusText}`);
  return res.json();
}

/** Analyze audio for voice metrics */
export async function analyzeAudio(blob) {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");
  const res = await fetch(`${BASE}/analysis/analyze-audio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return null; // Non-fatal
  return res.json();
}

/** Score face/behavior data */
export async function analyzeFace(faceData) {
  const res = await fetch(`${BASE}/analysis/analyze-face`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(faceData),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Generate final report */
export async function getFinalReport(evaluations, faceScores, voiceScores) {
  const res = await fetch(`${BASE}/evaluation/final-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluations, face_scores: faceScores, voice_scores: voiceScores }),
  });
  if (!res.ok) throw new Error("Final report failed");
  return res.json();
}

/** Get next adaptive difficulty */
export async function getNextDifficulty(score, currentDifficulty) {
  const res = await fetch(
    `${BASE}/questions/next-difficulty?score=${score}&current_difficulty=${currentDifficulty}`,
    { method: "POST" }
  );
  if (!res.ok) return { next_difficulty: currentDifficulty };
  return res.json();
}
