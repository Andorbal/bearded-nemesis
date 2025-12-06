import pytest
import cv2
from pathlib import Path
from .preprocessing import preprocess_image
from .regions import (
    detect_player_columns,
    extract_region,
    PlayerColumn,
    find_song_title_region,
    find_band_score_region,
)


@pytest.fixture
def preprocessed_screenshots():
    """Load and preprocess example screenshots (landscape only)."""
    base_path = Path(__file__).parent.parent.parent.parent.parent / "docs" / "example-screenshots"
    # Only IMG_1816 is landscape orientation
    img, error = preprocess_image(str(base_path / "IMG_1816.jpeg"))
    assert img is not None, f"Failed to preprocess IMG_1816: {error}"
    return {
        "straight": img,
    }


def test_detect_player_columns_single_player(preprocessed_screenshots):
    """Test detection of single player column."""
    img = preprocessed_screenshots["straight"]

    columns = detect_player_columns(img)

    assert len(columns) >= 1, "Should detect at least 1 player column"
    assert len(columns) <= 4, "Should detect at most 4 player columns"

    # Check first column structure
    col = columns[0]
    assert isinstance(col, PlayerColumn)
    assert col.x >= 0 and col.x < img.shape[1]
    assert col.y >= 0 and col.y < img.shape[0]
    assert col.width > 0 and col.width <= img.shape[1]
    assert col.height > 0 and col.height <= img.shape[0]


def test_detect_player_columns_all_examples(preprocessed_screenshots):
    """Test column detection on all landscape examples."""
    for name, img in preprocessed_screenshots.items():
        columns = detect_player_columns(img)
        print(f"{name}: detected {len(columns)} columns")

        assert len(columns) >= 1, f"Should detect at least 1 column in {name}"

        # Columns should be ordered left to right
        if len(columns) > 1:
            for i in range(len(columns) - 1):
                assert columns[i].x < columns[i + 1].x, "Columns should be ordered left to right"


def test_extract_region(preprocessed_screenshots):
    """Test extracting a region from image."""
    img = preprocessed_screenshots["straight"]

    # Extract arbitrary region
    region = extract_region(img, x=100, y=100, width=200, height=50)

    assert region is not None, "Should extract region"
    assert region.shape == (50, 200), "Should match requested dimensions"


def test_find_song_title_region(preprocessed_screenshots):
    """Test finding song title region (top of screen)."""
    img = preprocessed_screenshots["straight"]

    region = find_song_title_region(img)

    assert region is not None, "Should find title region"
    # Title should be in top portion of image
    x, y, w, h = region
    assert y < img.shape[0] * 0.3, "Title should be in top 30% of image"
    assert w > img.shape[1] * 0.3, "Title should span significant width"


def test_find_band_score_region(preprocessed_screenshots):
    """Test finding band score region (top-right area)."""
    img = preprocessed_screenshots["straight"]

    region = find_band_score_region(img)

    assert region is not None, "Should find band score region"
    x, y, w, h = region
    assert y < img.shape[0] * 0.3, "Band score should be near top"
    assert x > img.shape[1] * 0.3, "Band score should be in right portion"


def test_player_column_regions():
    """Test PlayerColumn region methods."""
    col = PlayerColumn(x=100, y=200, width=300, height=600)

    # Test gamertag region (top of column)
    gt_region = col.gamertag_region()
    assert gt_region[1] == 200, "Should start at column y"
    assert gt_region[3] < 100, "Gamertag should be small height"

    # Test stats region (bottom portion)
    stats_region = col.stats_region()
    assert stats_region[1] > 200, "Stats should be below gamertag"
    assert stats_region[3] > 200, "Stats should take significant height"
