"""
AI Interviewer Backend - FastAPI Application
All models run locally. No paid APIs required.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import questions, evaluation, analysis

app = FastAPI(
    title="AI Interviewer API",
    description="Local AI-powered interview system using Ollama + Whisper + MediaPipe",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(evaluation.router, prefix="/api/evaluation", tags=["Evaluation"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])


@app.get("/")
def root():
    return {"status": "AI Interviewer API running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
