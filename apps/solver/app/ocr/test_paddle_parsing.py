"""Unit tests for PaddleOCR parsing functions (no model download required)."""
import pytest
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.ocr.paddle_extraction import (
    parse_accuracy,
    parse_difficulty,
    parse_score,
    parse_multiplier,
    extract_performance_stats,
)


class TestParseAccuracy:
    def test_standard_percentage(self):
        assert parse_accuracy("96%") == 96.0
        assert parse_accuracy("100%") == 100.0
        assert parse_accuracy("0%") == 0.0

    def test_with_spaces(self):
        assert parse_accuracy("96 %") == 96.0
        assert parse_accuracy(" 96%") == 96.0

    def test_in_larger_text(self):
        assert parse_accuracy("Accuracy: 96%") == 96.0
        assert parse_accuracy("You scored 85% accuracy") == 85.0

    def test_invalid(self):
        assert parse_accuracy("no percentage") is None
        assert parse_accuracy("150%") is None  # Out of range
        assert parse_accuracy("") is None


class TestParseDifficulty:
    def test_standard_difficulties(self):
        assert parse_difficulty("EXPERT") == "expert"
        assert parse_difficulty("Hard") == "hard"
        assert parse_difficulty("MEDIUM") == "medium"
        assert parse_difficulty("easy") == "easy"

    def test_ocr_errors(self):
        assert parse_difficulty("EXP £ RT") == "expert"
        assert parse_difficulty("EXP€RT") == "expert"
        assert parse_difficulty("MED|UM") == "medium"

    def test_in_context(self):
        assert parse_difficulty("Difficulty: EXPERT") == "expert"

    def test_invalid(self):
        assert parse_difficulty("unknown") is None
        assert parse_difficulty("") is None


class TestParseScore:
    def test_simple_numbers(self):
        assert parse_score("185160") == 185160
        assert parse_score("50000") == 50000

    def test_with_commas(self):
        assert parse_score("185,160") == 185160
        assert parse_score("1,234,567") == 1234567

    def test_with_periods_as_thousands(self):
        assert parse_score("185.160") == 185160

    def test_with_spaces(self):
        assert parse_score(" 185160 ") == 185160

    def test_in_context(self):
        assert parse_score("Score: 185,160") == 185160

    def test_invalid(self):
        assert parse_score("no numbers") is None
        assert parse_score("") is None


class TestParseMultiplier:
    def test_standard_decimal(self):
        assert parse_multiplier("4.70") == 4.70
        assert parse_multiplier("3.35") == 3.35
        assert parse_multiplier("2.5") == 2.5

    def test_with_comma_as_decimal(self):
        assert parse_multiplier("4,70") == 4.70

    def test_in_context(self):
        assert parse_multiplier("Avg Multiplier: 4.70") == 4.70

    def test_invalid(self):
        assert parse_multiplier("no decimal") is None
        assert parse_multiplier("") is None


class TestExtractPerformanceStats:
    def test_all_fields(self):
        text = """
        PERFORMANCE
        Longest Streak: 356
        Notes Hit: 1529
        Notes Missed: 50
        Avg. Multiplier: 3.35
        """
        lines = [l.strip() for l in text.strip().split('\n') if l.strip()]

        stats = extract_performance_stats(text, lines)

        assert stats.get('longest_streak') == 356
        assert stats.get('notes_hit') == 1529
        assert stats.get('notes_missed') == 50
        assert stats.get('avg_multiplier') == 3.35

    def test_partial_fields(self):
        text = "Longest Streak 100 Notes Hit 500"
        lines = [text]

        stats = extract_performance_stats(text, lines)

        assert stats.get('longest_streak') == 100
        assert stats.get('notes_hit') == 500
        assert stats.get('notes_missed') is None
        assert stats.get('avg_multiplier') is None

    def test_alternative_formats(self):
        text = "streak 200 notes hit 800 missed 10 multiplier 4.5"
        lines = [text]

        stats = extract_performance_stats(text, lines)

        assert stats.get('longest_streak') == 200
        assert stats.get('notes_hit') == 800
        assert stats.get('notes_missed') == 10
        assert stats.get('avg_multiplier') == 4.5


class TestRealOcrOutput:
    """Tests using realistic OCR output patterns."""

    def test_typical_rb4_performance_section(self):
        # Simulated OCR output from a real screenshot
        text = """
        96% EXPERT
        High score!
        185,160
        PERFORMANCE
        Longest Streak 356
        Notes Hit 1529
        Notes Missed 50
        Avg. Multiplier 3.35
        """
        lines = [l.strip() for l in text.strip().split('\n') if l.strip()]

        stats = extract_performance_stats(text, lines)

        assert stats.get('longest_streak') == 356
        assert stats.get('notes_hit') == 1529
        assert stats.get('notes_missed') == 50
        assert stats.get('avg_multiplier') == 3.35

    def test_ocr_with_noise(self):
        # OCR sometimes introduces extra characters
        text = """
        |ongest Streak: 356
        Notes H1t: 1529
        Notes M1ssed: 50
        Avg Mult1plier: 3.35
        """
        lines = [l.strip() for l in text.strip().split('\n') if l.strip()]

        # Our parser should handle common OCR errors
        stats = extract_performance_stats(text, lines)

        # Even with OCR errors, we should extract some values
        # The exact handling depends on the patterns we've coded
        assert stats.get('longest_streak') is not None or stats.get('notes_hit') is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
