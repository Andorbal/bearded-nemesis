"""OCR processing for Rock Band 4 results screens using PaddleOCR."""
from .preprocessing import preprocess_image, check_landscape_orientation
from .paddle_extraction import extract_stats
from .models import OcrResult, OcrRequest, ExtractedPlayerStats
from .stars import detect_stars, StarRating
from .regions import StatsCardRegion, PlayerBarSlot, detect_stats_card, detect_player_bar

__all__ = [
    'preprocess_image',
    'check_landscape_orientation',
    'extract_stats',
    'OcrResult',
    'OcrRequest',
    'ExtractedPlayerStats',
    'detect_stars',
    'StarRating',
    'StatsCardRegion',
    'PlayerBarSlot',
    'detect_stats_card',
    'detect_player_bar',
]
