"""
Analysis Router
- Speech-to-Text via local Whisper
- Audio analysis via Librosa
- Face/behavior analysis via MediaPipe (frame-based from frontend data)
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import tempfile
import os
import json

router = APIRouter()

# ─── Whisper model singleton ──────────────────────────────────────────────────
# Load once at startup, reuse across all requests.
# Reloading every request causes memory build-up and 500s on the 2nd+ call.
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            _whisper_model = whisper.load_model("base")
        except ImportError:
            raise HTTPException(
                500,
                "Whisper not installed. Run: pip install openai-whisper"
            )
        except Exception as e:
            raise HTTPException(500, f"Failed to load Whisper model: {str(e)}")
    return _whisper_model


# ─── Speech to Text ──────────────────────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    model = get_whisper_model()

    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        result = model.transcribe(tmp_path, fp16=False)
        transcript = result["text"].strip()
        language = result.get("language", "en")

        return {
            "transcript": transcript,
            "language": language,
            "segments": len(result.get("segments", [])),
            "status": "success"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


# ─── Audio Analysis ──────────────────────────────────────────────────────────

@router.post("/analyze-audio")
async def analyze_audio(audio: UploadFile = File(...)):
    try:
        import librosa
        import numpy as np
    except ImportError:
        raise HTTPException(
            500,
            "Librosa not installed. Run: pip install librosa soundfile"
        )

    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        y, sr = librosa.load(tmp_path, sr=None, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        if duration < 0.5:
            return _empty_audio_result()

        onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
        speaking_rate = round(len(onsets) / max(duration, 1), 2)

        frame_length = 2048
        hop_length = 512
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        silence_threshold = 0.01
        silent_frames = (rms < silence_threshold).sum()
        total_frames = len(rms)
        pause_ratio = round(float(silent_frames / total_frames), 3)

        mean_rms = float(rms.mean())
        energy_normalized = round(min(mean_rms * 10, 1.0), 3)

        pace_score = 1.0 - min(abs(speaking_rate - 3.5) / 3.5, 1.0)
        pause_score = 1.0 - min(pause_ratio * 2, 1.0)
        energy_score = min(energy_normalized * 2, 1.0)

        voice_score = round(
            0.35 * pace_score + 0.35 * pause_score + 0.30 * energy_score,
            3
        )

        return {
            "duration_seconds": round(duration, 2),
            "speaking_rate": speaking_rate,
            "pause_ratio": pause_ratio,
            "energy_level": energy_normalized,
            "voice_score": voice_score
        }

    except Exception as e:
        raise HTTPException(500, f"Audio analysis failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def _empty_audio_result():
    return {
        "duration_seconds": 0,
        "speaking_rate": 0,
        "pause_ratio": 1.0,
        "energy_level": 0,
        "voice_score": 0.1,
    }


# ─── Face Analysis ────────────────────────────────────────────────────────────
#
# Scoring philosophy:
#   - If face is not visible for most of the session → score tanks hard.
#     MediaPipe returns no landmarks when face is absent, so eye_contact_ratio
#     and face_detected_ratio will both be near 0 in that case.
#   - eye_contact_ratio and face_detected_ratio are the two most reliable
#     signals. Weight them heavily.
#   - A realistic good score for an attentive candidate is ~65–80%.
#     A score of 90%+ should only be achievable with near-perfect metrics.
#
# Expected realistic ranges:
#   No face visible at all   →  5–15%
#   Face visible, poor eye contact → 25–45%
#   Face visible, average    →  45–65%
#   Face visible, good       →  65–80%
#   Near perfect             →  80–90%  (hard cap at 90%)

class FaceDataRequest(BaseModel):
    eye_contact_ratio: float        # 0–1: fraction of frames with gaze toward camera
    face_detected_ratio: float      # 0–1: fraction of frames a face was detected
    head_movement_count: int        # total significant head movements
    blink_rate: float               # blinks per minute
    session_duration_seconds: float


@router.post("/analyze-face")
async def analyze_face(data: FaceDataRequest):

    fdr = max(0.0, min(data.face_detected_ratio, 1.0))
    ecr = max(0.0, min(data.eye_contact_ratio, 1.0))

    # ── Hard gate: if face barely detected, everything else is meaningless ──
    # When fdr < 0.3 the landmark data is unreliable — return a low score
    # directly rather than computing bogus sub-scores from bad data.
    if fdr < 0.30:
        return {
            "eye_contact_score": 0.0,
            "presence_score": round(fdr, 3),
            "movement_score": 0.0,
            "blink_score": 0.0,
            "confidence_score": round(max(0.05, fdr * 0.3), 3),
            "feedback": ["Face not visible — please ensure your face is clearly in frame"],
        }

    # ── Presence score (face_detected_ratio) ──
    # Steep drop-off: being out of frame is the most penalised behaviour.
    if fdr >= 0.95:
        presence_score = 1.0
    elif fdr >= 0.85:
        presence_score = 0.75
    elif fdr >= 0.70:
        presence_score = 0.50
    elif fdr >= 0.50:
        presence_score = 0.30
    else:
        presence_score = 0.10

    # ── Eye contact score ──
    # Scale non-linearly: low ratios stay low, you must sustain contact to score well.
    if ecr >= 0.80:
        eye_contact_score = 1.0
    elif ecr >= 0.60:
        eye_contact_score = 0.75
    elif ecr >= 0.40:
        eye_contact_score = 0.50
    elif ecr >= 0.20:
        eye_contact_score = 0.25
    else:
        eye_contact_score = 0.05

    # ── Head movement score ──
    max_ok_movements = max(data.session_duration_seconds / 8, 5)
    movement_ratio = data.head_movement_count / max_ok_movements
    if movement_ratio <= 1.0:
        movement_score = 1.0 - (movement_ratio * 0.3)   # up to -0.3 for lots of movement
    else:
        movement_score = max(0.0, 0.7 - (movement_ratio - 1.0) * 0.4)

    # ── Blink score ──
    blink = data.blink_rate
    if 12 <= blink <= 20:
        blink_score = 1.0      # ideal natural range
    elif 8 <= blink < 12 or 20 < blink <= 28:
        blink_score = 0.65
    elif 4 <= blink < 8 or 28 < blink <= 40:
        blink_score = 0.35
    else:
        blink_score = 0.10     # staring or blinking excessively

    # ── Weighted composite ──
    # Presence + eye contact dominate (70% combined).
    # Movement and blink are secondary signals.
    raw_score = (
        0.40 * eye_contact_score +
        0.30 * presence_score +
        0.18 * movement_score +
        0.12 * blink_score
    )

    # ── Penalty for partial face visibility ──
    # Even if fdr passed the hard gate, low fdr still hurts.
    if fdr < 0.60:
        raw_score *= 0.70
    elif fdr < 0.75:
        raw_score *= 0.85

    # ── Clamp: hard cap at 0.90, minimum 0.05 ──
    confidence_score = round(max(0.05, min(raw_score, 0.90)), 3)

    return {
        "eye_contact_score": round(eye_contact_score, 3),
        "presence_score": round(presence_score, 3),
        "movement_score": round(movement_score, 3),
        "blink_score": round(blink_score, 3),
        "confidence_score": confidence_score,
        "feedback": _face_feedback(data, ecr, fdr, movement_score),
    }


def _face_feedback(data, eye, fdr, movement_score):
    notes = []

    if fdr < 0.50:
        notes.append("Face not clearly visible for most of the session — sit closer to camera")
    elif fdr < 0.80:
        notes.append("Face was partially out of frame — keep your face centred")

    if eye < 0.25:
        notes.append("Very little eye contact — look directly at the camera lens")
    elif eye < 0.50:
        notes.append("Try to maintain more eye contact with the camera")
    elif eye >= 0.75:
        notes.append("Good eye contact maintained")

    if movement_score < 0.50:
        notes.append("Excessive head movement — try to stay still while speaking")

    if data.blink_rate < 6:
        notes.append("Very low blink rate — you may appear tense; relax your eyes")
    elif data.blink_rate > 35:
        notes.append("High blink rate detected — try to stay calm and focused")

    return notes if notes else ["Good overall body language"]