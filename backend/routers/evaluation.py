"""
Evaluation Router
Uses local Ollama LLM to evaluate interview answers.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import json
from difflib import SequenceMatcher  # ✅ NEW

router = APIRouter()

OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "mistral"


class EvaluationRequest(BaseModel):
    question: str
    answer: str
    expected_keywords: list[str] = []
    difficulty: str = "medium"
    job_role: str = "Software Engineer"


class EvaluationResponse(BaseModel):
    correctness_score: float
    clarity_score: float
    depth_score: float
    overall_score: float
    strengths: list[str]
    weaknesses: list[str]
    missing_keywords: list[str]
    detailed_feedback: str
    model_answer_summary: str
    improvement_tips: list[str]


# ✅ NEW HELPER
def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


async def call_ollama(prompt: str, system: str = "") -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 800},
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")
        except httpx.ConnectError:
            raise HTTPException(503, "Ollama is not running. Run: ollama serve")


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_answer(req: EvaluationRequest):
    """Evaluate a candidate's answer using local LLM."""

    # ─────────── PRE-CHECK (🔥 IMPORTANT) ───────────

    sim = similarity(req.question, req.answer)
    word_count = len(req.answer.split())

    # ❌ Case 1: Repeating the question
    if sim > 0.7:
        return EvaluationResponse(
            correctness_score=0.1,
            clarity_score=0.3,
            depth_score=0.1,
            overall_score=0.15,
            strengths=["Attempted to respond"],
            weaknesses=["Repeated the question instead of answering"],
            missing_keywords=req.expected_keywords[:3],
            detailed_feedback="The response largely repeats the question and does not provide a meaningful answer.",
            model_answer_summary="A proper answer should explain the concept clearly with examples.",
            improvement_tips=[
                "Do not repeat the question",
                "Explain the concept in your own words",
                "Provide examples or steps"
            ]
        )

    # ❌ Case 2: Too short answer
    if word_count < 5:
        return EvaluationResponse(
            correctness_score=0.1,
            clarity_score=0.2,
            depth_score=0.1,
            overall_score=0.1,
            strengths=["Tried to answer"],
            weaknesses=["Answer too short and lacks substance"],
            missing_keywords=req.expected_keywords[:3],
            detailed_feedback="The answer is too short to evaluate and lacks sufficient detail.",
            model_answer_summary="A good answer should be structured and contain key points.",
            improvement_tips=[
                "Speak for at least 2–3 sentences",
                "Add explanation",
                "Avoid one-line answers"
            ]
        )

    # ─────────── NORMAL LLM FLOW ───────────

    keywords_str = ", ".join(req.expected_keywords) if req.expected_keywords else "N/A"

    system_prompt = (
        "You are a senior technical interviewer evaluating candidates. "
        "Be fair but rigorous. Respond only with valid JSON."
    )

    user_prompt = f"""Evaluate this interview answer carefully.

Role: {req.job_role}
Difficulty: {req.difficulty}
Question: {req.question}
Candidate's Answer: {req.answer}
Expected Keywords: {keywords_str}

Score each dimension from 0.0 to 1.0:
- correctness: Is the answer factually accurate?
- clarity: Is it well-structured and easy to understand?
- depth: Does it go beyond surface-level?

Respond ONLY with this JSON:
{{
  "correctness_score": 0.0,
  "clarity_score": 0.0,
  "depth_score": 0.0,
  "overall_score": 0.0,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "missing_keywords": ["keyword1"],
  "detailed_feedback": "Detailed paragraph explaining the evaluation",
  "model_answer_summary": "What an ideal answer would cover",
  "improvement_tips": ["tip1", "tip2", "tip3"]
}}"""

    raw = await call_ollama(user_prompt, system_prompt)

    try:
        clean = raw.strip()
        if "```" in clean:
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]

        data = json.loads(clean.strip())

        # Clamp scores
        for key in ["correctness_score", "clarity_score", "depth_score", "overall_score"]:
            data[key] = max(0.0, min(1.0, float(data.get(key, 0.5))))

        # Recalculate overall if needed
        if data["overall_score"] == 0.0:
            data["overall_score"] = round(
                0.4 * data["correctness_score"]
                + 0.3 * data["clarity_score"]
                + 0.3 * data["depth_score"],
                2
            )

        return EvaluationResponse(**data)

    except (json.JSONDecodeError, KeyError, TypeError):
        return EvaluationResponse(
            correctness_score=0.5,
            clarity_score=0.5,
            depth_score=0.5,
            overall_score=0.5,
            strengths=["Attempted the question"],
            weaknesses=["Could not fully evaluate the answer"],
            missing_keywords=req.expected_keywords[:3],
            detailed_feedback="The answer was received but could not be fully evaluated. Please try again.",
            model_answer_summary="A good answer would cover the key concepts clearly and with examples.",
            improvement_tips=["Be more specific", "Use examples", "Structure your answer clearly"]
        )


@router.post("/final-report")
async def generate_final_report(
    evaluations: list[EvaluationResponse],
    face_scores: list[float],
    voice_scores: list[float]
):
    if not evaluations:
        raise HTTPException(400, "No evaluations provided")

    avg_correctness = sum(e.correctness_score for e in evaluations) / len(evaluations)
    avg_clarity = sum(e.clarity_score for e in evaluations) / len(evaluations)
    avg_depth = sum(e.depth_score for e in evaluations) / len(evaluations)
    avg_overall = sum(e.overall_score for e in evaluations) / len(evaluations)
    avg_face = sum(face_scores) / len(face_scores) if face_scores else 0.5
    avg_voice = sum(voice_scores) / len(voice_scores) if voice_scores else 0.5

    communication_score = round((avg_clarity * 0.4 + avg_face * 0.3 + avg_voice * 0.3), 2)
    confidence_score = round((avg_face * 0.5 + avg_voice * 0.3 + avg_clarity * 0.2), 2)

    return {
        "technical_score": round(avg_correctness, 2),
        "clarity_score": round(avg_clarity, 2),
        "depth_score": round(avg_depth, 2),
        "overall_score": round(avg_overall, 2),
        "communication_score": communication_score,
        "confidence_score": confidence_score,
        "questions_answered": len(evaluations),
    }