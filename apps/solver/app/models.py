from pydantic import BaseModel, Field
from typing import Literal, Optional
from enum import Enum


class Instrument(str, Enum):
    DRUMS = "drums"
    GUITAR = "guitar"
    BASS = "bass"
    VOCALS = "vocals"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class RatingAggregation(str, Enum):
    AVERAGE = "average"
    MINIMUM = "minimum"
    MAXIMUM = "maximum"


class ObjectiveType(str, Enum):
    PLAY_RATING = "play_rating"
    SONG_RATING = "song_rating"
    DISCOVERY = "discovery"
    COMBINED = "combined"


class SongCandidate(BaseModel):
    """A song that could be included in the setlist"""
    song_id: int
    duration_ms: Optional[int] = None
    bpm: Optional[int] = None
    difficulty: int  # For the relevant instrument(s)
    times_played: int = 0  # Total times played by any player
    last_played_days_ago: Optional[int] = None  # None if never played


class PlayerRating(BaseModel):
    """Ratings for a single player"""
    user_id: int
    play_rating: Optional[float] = None  # Average play rating (1-5) for this song+instrument
    song_rating: Optional[float] = None  # Song rating (1-5) independent of instrument


class SongWithRatings(BaseModel):
    """Song candidate with ratings from all players"""
    song: SongCandidate
    ratings: list[PlayerRating]


class BuilderConstraints(BaseModel):
    """Constraints for setlist generation"""
    song_count_min: Optional[int] = Field(default=None, ge=1)
    song_count_max: Optional[int] = Field(default=None, ge=1)
    max_duration_minutes: Optional[int] = Field(default=None, ge=1)
    min_avg_play_rating: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    min_avg_song_rating: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    difficulty_min: Optional[int] = Field(default=None, ge=0, le=7)
    difficulty_max: Optional[int] = Field(default=None, ge=0, le=7)
    unplayed_minimum: Optional[int] = Field(default=None, ge=0)
    avoid_played_within_days: Optional[int] = Field(default=None, ge=0)
    bpm_min: Optional[int] = Field(default=None, ge=1)
    bpm_max: Optional[int] = Field(default=None, ge=1)
    required_song_ids: list[int] = Field(default_factory=list)
    excluded_song_ids: list[int] = Field(default_factory=list)


class SolveRequest(BaseModel):
    """Request to solve for optimal setlist"""
    candidates: list[SongWithRatings]
    objective: ObjectiveType
    rating_aggregation: RatingAggregation
    constraints: BuilderConstraints
    # Weights for combined objective (only used when objective=combined)
    weight_play_rating: float = Field(default=0.4, ge=0.0, le=1.0)
    weight_song_rating: float = Field(default=0.3, ge=0.0, le=1.0)
    weight_discovery: float = Field(default=0.3, ge=0.0, le=1.0)


class SolveResponse(BaseModel):
    """Response with selected song IDs in optimal order"""
    selected_song_ids: list[int]
    status: Literal["optimal", "feasible", "infeasible"]
    objective_value: Optional[float] = None
    message: Optional[str] = None
