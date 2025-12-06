import pytest
import cv2
import numpy as np
from pathlib import Path
from .preprocessing import (
    preprocess_image,
    convert_to_grayscale,
    enhance_contrast,
    denoise_image,
    correct_perspective,
    detect_screen_corners,
    check_landscape_orientation,
)


@pytest.fixture
def example_screenshots():
    """Load the example screenshots with their paths."""
    base_path = Path(__file__).parent.parent.parent.parent.parent / "docs" / "example-screenshots"
    return {
        "angled_1": str(base_path / "IMG_1814.jpeg"),  # portrait
        "angled_2": str(base_path / "IMG_1815.jpeg"),  # portrait
        "straight": str(base_path / "IMG_1816.jpeg"),  # landscape
    }


def test_convert_to_grayscale(example_screenshots):
    """Test grayscale conversion."""
    img = cv2.imread(example_screenshots["straight"])
    assert img is not None, "Failed to load test image"

    gray = convert_to_grayscale(img)

    assert len(gray.shape) == 2, "Should be 2D array (grayscale)"
    assert gray.dtype == np.uint8, "Should be uint8"
    assert gray.shape[0] > 0 and gray.shape[1] > 0, "Should have dimensions"


def test_enhance_contrast(example_screenshots):
    """Test contrast enhancement using CLAHE."""
    img = cv2.imread(example_screenshots["straight"])
    gray = convert_to_grayscale(img)

    enhanced = enhance_contrast(gray)

    assert enhanced.shape == gray.shape, "Shape should be preserved"
    assert enhanced.dtype == np.uint8, "Should be uint8"
    # Enhanced image should have different histogram
    assert not np.array_equal(enhanced, gray), "Should modify the image"


def test_denoise_image(example_screenshots):
    """Test noise reduction."""
    img = cv2.imread(example_screenshots["straight"])
    gray = convert_to_grayscale(img)

    denoised = denoise_image(gray)

    assert denoised.shape == gray.shape, "Shape should be preserved"
    assert denoised.dtype == np.uint8, "Should be uint8"


def test_detect_screen_corners_straight(example_screenshots):
    """Test corner detection on straight-on photo."""
    img = cv2.imread(example_screenshots["straight"])

    corners = detect_screen_corners(img)

    if corners is not None:
        assert corners.shape == (4, 2), "Should return 4 corners with (x, y)"
        # Corners should be within image bounds
        h, w = img.shape[:2]
        assert np.all(corners[:, 0] >= 0) and np.all(corners[:, 0] < w)
        assert np.all(corners[:, 1] >= 0) and np.all(corners[:, 1] < h)


def test_detect_screen_corners_angled(example_screenshots):
    """Test corner detection on angled photo."""
    img = cv2.imread(example_screenshots["angled_1"])

    corners = detect_screen_corners(img)

    if corners is not None:
        assert corners.shape == (4, 2), "Should return 4 corners with (x, y)"


def test_correct_perspective_straight(example_screenshots):
    """Test perspective correction on straight photo (should be minimal)."""
    img = cv2.imread(example_screenshots["straight"])

    corrected = correct_perspective(img)

    assert corrected is not None, "Should return corrected image"
    assert len(corrected.shape) == 3, "Should be color image"
    # Should be roughly same size or normalized
    assert corrected.shape[0] > 500 and corrected.shape[1] > 500


def test_check_landscape_orientation():
    """Test landscape orientation detection."""
    # Create test images
    landscape = np.zeros((100, 200, 3), dtype=np.uint8)  # 200x100, landscape
    portrait = np.zeros((200, 100, 3), dtype=np.uint8)   # 100x200, portrait
    square = np.zeros((100, 100, 3), dtype=np.uint8)     # 100x100, square

    assert check_landscape_orientation(landscape) is True, "Should detect landscape"
    assert check_landscape_orientation(portrait) is False, "Should detect portrait"
    assert check_landscape_orientation(square) is False, "Square should not be landscape"


def test_preprocess_rejects_portrait_images(example_screenshots):
    """Test that portrait images are rejected with clear error message."""
    img_path = example_screenshots["angled_1"]  # This is a portrait image

    processed, error = preprocess_image(img_path)

    assert processed is None, "Should reject portrait image"
    assert error is not None, "Should return error message"
    assert "landscape" in error.lower(), "Error should mention landscape requirement"
    assert "portrait" in error.lower(), "Error should mention portrait orientation"
    print(f"Portrait rejection error: {error}")


def test_preprocess_image_full_pipeline(example_screenshots):
    """Test full preprocessing pipeline on landscape image."""
    img_path = example_screenshots["straight"]  # This is the landscape image

    processed, error = preprocess_image(img_path)

    assert processed is not None, f"Should return processed image, got error: {error}"
    assert error is None, "Should not return error for landscape image"
    assert len(processed.shape) == 2, "Should be grayscale"
    assert processed.dtype == np.uint8, "Should be uint8"
    # Should be normalized to reasonable size (1920 width target)
    assert 800 < processed.shape[0] < 2000, f"Height should be normalized, got {processed.shape[0]}"
    assert 1800 < processed.shape[1] < 2000, f"Width should be ~1920, got {processed.shape[1]}"


def test_preprocess_landscape_images_only(example_screenshots):
    """Test preprocessing succeeds on landscape images and fails on portrait."""
    # Portrait images should fail
    for name in ["angled_1", "angled_2"]:
        processed, error = preprocess_image(example_screenshots[name])
        assert processed is None, f"{name} is portrait and should be rejected"
        assert error is not None, f"{name} should have error message"
        print(f"{name}: rejected with error: {error}")

    # Landscape image should succeed
    processed, error = preprocess_image(example_screenshots["straight"])
    assert processed is not None, f"straight is landscape and should succeed, got error: {error}"
    assert error is None, "straight should not have error"
    print(f"straight: shape={processed.shape}, dtype={processed.dtype}")
