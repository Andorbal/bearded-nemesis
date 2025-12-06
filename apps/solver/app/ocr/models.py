"""Data models for OCR extraction."""
from typing import List, Optional
from pydantic import BaseModel, Field


class ExtractedPlayerStats(BaseModel):
    """Statistics extracted for one player."""
    gamertag: str
    accuracy_pct: Optional[float] = None
    difficulty: Optional[str] = None
    score: Optional[int] = None
    stars_earned: Optional[int] = Field(None, ge=0, le=5)  # 0-5 stars
    gold_stars: Optional[bool] = None  # True if gold stars (perfect/near-perfect)
    longest_streak: Optional[int] = None
    notes_hit: Optional[int] = None
    notes_missed: Optional[int] = None
    avg_multiplier: Optional[float] = None


class OcrResult(BaseModel):
    """Complete OCR extraction result."""
    success: bool
    song_title: Optional[str] = None
    band_score: Optional[int] = None
    players: List[ExtractedPlayerStats] = []
    errors: List[str] = []
    raw_text: Optional[str] = None  # For debugging


class OcrRequest(BaseModel):
    """Request to OCR endpoint."""
    image_path: str


class OcrJobStatus(BaseModel):
    """Status of an OCR processing job."""
    job_id: str
    status: str  # pending, processing, completed, failed
    image_path: str
    result: Optional[OcrResult] = None
    created_at: str
    completed_at: Optional[str] = None
