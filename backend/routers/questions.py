"""
Questions Router
Generates interview questions using Ollama (Mistral/LLaMA locally).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json

router = APIRouter()

OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "mistral"  # Change to "llama3" or any locally pulled model


class QuestionRequest(BaseModel):
    topic: str = "software engineering"
    difficulty: str = "medium"   # easy | medium | hard
    question_number: int = 1
    previous_questions: list[str] = []
    job_role: str = "Software Engineer"


class QuestionResponse(BaseModel):
    question: str
    category: str
    expected_keywords: list[str]
    difficulty: str
    tips: str


async def call_ollama(prompt: str, system: str = "") -> str:
    """Call local Ollama instance."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 500,
        }
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="Ollama is not running. Please start it with: ollama serve"
            )


@router.post("/generate", response_model=QuestionResponse)
async def generate_question(req: QuestionRequest):
    """Generate a dynamic interview question using local LLM."""

    prev = "\n".join(req.previous_questions) if req.previous_questions else "None"
    system_prompt = (
        "You are an expert technical interviewer. "
        "Always respond with valid JSON only. No extra text."
    )
    user_prompt = f"""Generate one interview question for a {req.job_role} role.

Topic: {req.topic}
Difficulty: {req.difficulty}
Question number: {req.question_number}
Previously asked questions (do NOT repeat):
{prev}

Respond with JSON in this exact format:
{{
  "question": "The interview question text",
  "category": "technical|behavioral|situational|problem-solving",
  "expected_keywords": ["keyword1", "keyword2", "keyword3"],
  "difficulty": "{req.difficulty}",
  "tips": "Brief tip for what a good answer looks like"
}}"""

    raw = await call_ollama(user_prompt, system_prompt)

    # Extract JSON from response
    try:
        # Strip markdown code blocks if present
        clean = raw.strip()
        if "```" in clean:
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        data = json.loads(clean.strip())
        return QuestionResponse(**data)
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        # Fallback question if parsing fails
        return QuestionResponse(
            question=f"Tell me about your experience with {req.topic}.",
            category="technical",
            expected_keywords=[req.topic, "experience", "projects"],
            difficulty=req.difficulty,
            tips="Describe specific projects and technologies you have used."
        )


@router.post("/next-difficulty")
async def decide_next_difficulty(score: float, current_difficulty: str):
    """Adaptive difficulty: raise/lower based on answer score."""
    levels = ["easy", "medium", "hard"]
    idx = levels.index(current_difficulty) if current_difficulty in levels else 1
    if score >= 0.75:
        idx = min(idx + 1, 2)
    elif score < 0.4:
        idx = max(idx - 1, 0)
    return {"next_difficulty": levels[idx]}
