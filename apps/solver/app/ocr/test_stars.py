"""Tests for star detection and gold star classification."""
import numpy as np
import pytest
from app.ocr.stars import detect_stars, _detect_gold_stars, StarRating


def test_detect_gold_stars_returns_python_types():
    """
    Test that _detect_gold_stars returns Python native types, not numpy types.

    This is critical for FastAPI/Pydantic serialization. Numpy types like
    numpy.bool_ cannot be serialized by Pydantic and will cause 500 errors.
    """
    # Create a simple test image with some color variation
    img = np.random.randint(0, 255, (100, 500, 3), dtype=np.uint8)

    is_gold, confidence = _detect_gold_stars(img)

    # These assertions will fail if numpy types are returned
    assert isinstance(is_gold, bool), f"Expected bool, got {type(is_gold)}"
    assert not isinstance(is_gold, np.bool_), f"Got numpy.bool_ instead of Python bool"

    assert isinstance(confidence, float), f"Expected float, got {type(confidence)}"
    assert not isinstance(confidence, np.floating), f"Got numpy float instead of Python float"


def test_detect_stars_returns_python_types():
    """
    Test that detect_stars returns a StarRating with Python native types.
    """
    # Create a simple test image
    img = np.random.randint(0, 255, (100, 500, 3), dtype=np.uint8)

    result = detect_stars(img)

    assert isinstance(result, StarRating)
    assert isinstance(result.count, int), f"Expected int, got {type(result.count)}"
    assert not isinstance(result.count, np.integer), f"Got numpy integer instead of Python int"

    assert isinstance(result.is_gold, bool), f"Expected bool, got {type(result.is_gold)}"
    assert not isinstance(result.is_gold, np.bool_), f"Got numpy.bool_ instead of Python bool"

    assert isinstance(result.confidence, float), f"Expected float, got {type(result.confidence)}"
    assert not isinstance(result.confidence, np.floating), f"Got numpy float instead of Python float"


def test_star_rating_serialization():
    """
    Test that StarRating can be safely converted to dict for JSON serialization.
    """
    from dataclasses import asdict

    # Create a simple test image
    img = np.random.randint(0, 255, (100, 500, 3), dtype=np.uint8)

    result = detect_stars(img)

    # This should not raise any serialization errors
    result_dict = asdict(result)

    # Verify all values are Python native types
    assert isinstance(result_dict['count'], int)
    assert isinstance(result_dict['is_gold'], bool)
    assert isinstance(result_dict['confidence'], float)
