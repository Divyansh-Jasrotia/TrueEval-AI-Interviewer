# ⬡ TrueEval AI Interviewer — Local AI Interview Trainer

A fully local AI-powered interview practice system.
**No paid APIs. No cloud. Everything runs on your machine.**

---

## Tech Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| LLM | Ollama + Mistral | Question generation & answer evaluation |
| Speech-to-Text | OpenAI Whisper (local) | Converts your spoken answer to text |
| Face Analysis | Browser canvas + heuristics | Eye contact, head movement detection |
| Audio Analysis | Librosa | Speaking pace, pauses, voice energy |
| Backend | FastAPI (Python) | REST API server |
| Frontend | React + Vite | Web UI |

---

## Project Structure

```
ai-interviewer/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── requirements.txt         ← Python dependencies
│   └── routers/
│       ├── questions.py         ← LLM question generation
│       ├── evaluation.py        ← LLM answer evaluation + final report
│       └── analysis.py          ← Whisper STT + Librosa + face scoring
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx              ← Root component, page routing
│       ├── index.css            ← Global styles
│       ├── pages/
│       │   ├── LandingPage.jsx  ← Start screen + config
│       │   ├── InterviewPage.jsx← Main interview loop
│       │   └── ReportPage.jsx   ← Final results
│       ├── components/
│       │   ├── WebcamView.jsx   ← Camera preview
│       │   ├── QuestionCard.jsx ← Question display
│       │   └── AnswerFeedback.jsx← Per-question feedback
│       ├── hooks/
│       │   ├── useRecorder.js   ← Microphone recording
│       │   └── useMediaPipe.js  ← Face tracking (canvas-based)
│       └── utils/
│           └── api.js           ← All API calls to backend
│
└── README.md
```

---

## ⚡ Setup Instructions (Step by Step)

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) installed
- ffmpeg installed (required by Whisper)
- A webcam and microphone

---

### Step 1 — Install Ollama and pull a local LLM

```bash
# Install Ollama from https://ollama.com/download
# Then pull Mistral (4GB, runs on CPU too):
ollama pull mistral

# OR use smaller model (1.3GB):
ollama pull tinyllama

# If you have a GPU and want better results:
ollama pull llama3
```

> **Note:** If you use a different model, edit `MODEL_NAME` in both
> `backend/routers/questions.py` and `backend/routers/evaluation.py`.

---

### Step 2 — Install ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html and add to PATH
```

---

### Step 3 — Set up Python backend

```bash
cd ai-interviewer/backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # macOS/Linux
# OR: venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# NOTE: First run downloads Whisper model (~140MB for 'base')
# This is automatic — no manual download needed.
```

**What gets installed:**
- `fastapi` + `uvicorn` — web server
- `openai-whisper` — local speech-to-text
- `librosa` — audio analysis
- `httpx` — calls to local Ollama

---

### Step 4 — Set up React frontend

```bash
cd ai-interviewer/frontend

npm install
```

---

## ▶ Running the Application

You need **3 terminals** running simultaneously:

### Terminal 1 — Start Ollama (LLM server)
```bash
ollama serve
# Ollama runs at http://localhost:11434
```

### Terminal 2 — Start Python backend
```bash
cd ai-interviewer/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
# API runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Terminal 3 — Start React frontend
```bash
cd ai-interviewer/frontend
npm run dev
# UI runs at http://localhost:3000
```

Then open **http://localhost:3000** in your browser.

---

## Sample Test Flow

1. Open http://localhost:3000
2. Click **"Check Backend"** — should show ✓ Backend online
3. Select Job Role: `Software Engineer`
4. Select Questions: `5`
5. Click **"▶ Start Interview"**
6. Read the question shown on screen
7. Click **"🎤 Start Recording"** and speak your answer
8. Click **"⏹ Stop Recording"**
9. Wait ~10-30 seconds for:
   - Whisper to transcribe your speech
   - Librosa to analyze your voice
   - Canvas to score your face/eye contact
   - Ollama to evaluate your answer
10. Read the detailed feedback
11. Click **"→ Next Question"** (difficulty adapts based on your score)
12. After all questions → **"📊 View Final Report"**
13. See your full breakdown: Technical, Clarity, Depth, Communication, Confidence

---

## Customization

### Change LLM model
Edit `MODEL_NAME` in `backend/routers/questions.py` and `backend/routers/evaluation.py`:
```python
MODEL_NAME = "llama3"        # Better quality
MODEL_NAME = "tinyllama"     # Faster, smaller
MODEL_NAME = "codellama"     # For coding interviews
```

### Change Whisper model size
Edit in `backend/routers/analysis.py`:
```python
model = whisper.load_model("tiny")    # Fastest, ~75MB
model = whisper.load_model("base")    # Default, ~140MB
model = whisper.load_model("small")   # Better accuracy, ~460MB
model = whisper.load_model("medium")  # Best quality, ~1.5GB
```

### Add more job roles
Edit the `JOB_ROLES` and `TOPICS` arrays in `frontend/src/pages/LandingPage.jsx`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Ollama is not running` | Run `ollama serve` in a terminal |
| `ffmpeg not found` | Install ffmpeg (see Step 2) |
| `Transcription failed` | Check microphone permissions in browser |
| `CORS error` | Make sure backend runs on port 8000 |
| `Camera not showing` | Allow camera access in browser popup |
| Whisper very slow | Use `tiny` model or reduce audio length |
| LLM returns no JSON | Switch to larger model (mistral > tinyllama) |

---

## Performance Notes

- **Whisper base** transcribes ~30s audio in ~5-15 seconds on CPU
- **Mistral via Ollama** generates a question in ~5-20 seconds on CPU
- On a GPU, everything runs 5-10x faster
- Whisper model downloads once and is cached locally (`~/.cache/whisper/`)
- Ollama models are stored in `~/.ollama/models/`

---

## Viva Demo Script

1. **Show the landing page** — explain local-only architecture
2. **Start interview** — show webcam + question loading
3. **Record an answer** — speak for 20-30 seconds
4. **Show processing** — explain Whisper, Librosa, LLM pipeline
5. **Show feedback** — transcript, scores, strengths/weaknesses
6. **Show adaptive difficulty** — next question is harder/easier
7. **Show final report** — all metrics, per-question breakdown
8. **Show backend API docs** at http://localhost:8000/docs

**Key points to emphasize:**
- Zero API costs — all models run locally
- Privacy — audio/video never leaves the machine
- Adaptive — difficulty changes based on performance
- Multi-modal — text + voice + face analysis combined

---

## Architecture Diagram

```
Browser (React)
    │
    ├── Webcam → Canvas analysis → Face/eye metrics
    ├── Microphone → MediaRecorder → Audio blob
    │
    ▼
FastAPI Backend (localhost:8000)
    │
    ├── /api/analysis/transcribe    → Whisper (local STT)
    ├── /api/analysis/analyze-audio → Librosa (voice metrics)
    ├── /api/analysis/analyze-face  → Scoring algorithm
    ├── /api/questions/generate     → Ollama LLM
    ├── /api/evaluation/evaluate    → Ollama LLM
    └── /api/evaluation/final-report→ Aggregate scoring
         │
         ▼
    Ollama (localhost:11434)
         │
         └── Mistral / LLaMA (local model files)
```
