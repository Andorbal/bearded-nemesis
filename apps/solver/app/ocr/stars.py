"""Star detection and gold star classification for Rock Band results screen."""
import cv2
import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass


@dataclass
class StarRating:
    """Represents the star rating from a Rock Band results screen."""
    count: int  # Number of stars earned (0-5)
    is_gold: bool  # True if gold stars (perfect/near-perfect performance)
    confidence: float  # Confidence score for the detection (0.0-1.0)


def detect_stars(img: np.ndarray) -> StarRating:
    """
    Detect star count and whether they are gold stars.

    Gold stars in Rock Band 4 have a distinctive rainbow/iridescent glow
    around them, while regular stars appear more uniform gray/silver.

    Args:
        img: BGR color image of the stars region

    Returns:
        StarRating with count, is_gold flag, and confidence
    """
    if img is None or img.size == 0:
        return StarRating(count=0, is_gold=False, confidence=0.0)

    # Count stars by detecting circular shapes
    star_count = _count_stars(img)

    # Detect if stars are gold (have rainbow glow)
    is_gold, gold_confidence = _detect_gold_stars(img)

    # Overall confidence based on star detection clarity
    confidence = min(1.0, star_count / 5.0) if star_count > 0 else 0.0

    return StarRating(
        count=star_count,
        is_gold=is_gold,
        confidence=confidence * gold_confidence
    )


def _count_stars(img: np.ndarray) -> int:
    """
    Count the number of stars in the image.

    Stars appear as circular shapes with a star pattern inside.

    Args:
        img: BGR color image

    Returns:
        Number of stars detected (0-5)
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Use Hough Circle detection to find star circles
    height, width = img.shape[:2]

    # Estimate star size based on image dimensions
    # Stars typically take up about 15-20% of the region width each
    min_radius = int(width * 0.06)
    max_radius = int(width * 0.12)

    # Detect circles
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=int(width * 0.12),  # Minimum distance between circle centers
        param1=50,
        param2=30,
        minRadius=min_radius,
        maxRadius=max_radius
    )

    if circles is not None:
        return min(5, len(circles[0]))

    # Fallback: try edge detection and contour counting
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter contours by size and circularity
    star_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 100:  # Too small
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue

        # Circularity = 4π * area / perimeter²
        circularity = 4 * np.pi * area / (perimeter * perimeter)

        if circularity > 0.5:  # Reasonably circular
            star_contours.append(contour)

    return min(5, len(star_contours))


def _detect_gold_stars(img: np.ndarray) -> Tuple[bool, float]:
    """
    Detect whether the stars are gold stars based on rainbow/iridescent glow.

    Gold stars have a distinctive colorful glow (rainbow effect) around them,
    while regular stars appear more monochromatic (gray/silver/blue).

    Args:
        img: BGR color image of stars region

    Returns:
        Tuple of (is_gold, confidence)
    """
    if img is None or img.size == 0:
        return False, 0.0

    # Convert to HSV for color analysis
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Extract the hue channel
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

    # Gold stars have high color variance (rainbow = many different hues)
    # Regular stars are mostly one color (blue/gray)

    # Only analyze pixels with decent saturation and brightness
    # (ignore dark/desaturated background pixels)
    mask = (saturation > 30) & (value > 50)

    if np.sum(mask) < 100:  # Not enough colored pixels
        return False, 0.5

    # Get hue values of colored pixels
    hue_values = hue[mask]

    # Calculate hue diversity
    # Gold stars will have hues spread across the spectrum (0-180 in OpenCV)
    hue_std = np.std(hue_values)
    hue_range = np.ptp(hue_values)  # Peak to peak (max - min)

    # Count distinct hue regions (bins)
    hist, _ = np.histogram(hue_values, bins=18, range=(0, 180))
    active_bins = np.sum(hist > np.max(hist) * 0.1)

    # Gold star indicators:
    # 1. High hue standard deviation (colors spread out)
    # 2. Large hue range (covers many colors)
    # 3. Multiple active hue bins (distinct color regions)

    # Thresholds determined empirically from Rock Band 4 screenshots
    # Gold stars show rainbow glow which creates high hue diversity
    is_gold = (
        hue_std > 20 and  # Significant hue variation (lowered from 25)
        hue_range > 50 and  # Covers at least ~1/3 of hue spectrum
        active_bins >= 4  # At least 4 distinct color regions
    )

    # Calculate confidence based on how strongly the indicators match
    confidence_factors = [
        min(1.0, hue_std / 40),  # Normalize to ~40 as strong indicator
        min(1.0, hue_range / 100),  # Normalize to ~100 as strong indicator
        min(1.0, active_bins / 6)  # Normalize to 6 bins as strong indicator
    ]
    confidence = np.mean(confidence_factors)

    # Convert numpy types to Python native types for JSON serialization
    # FastAPI/Pydantic cannot serialize numpy.bool_ or numpy.float64
    return bool(is_gold), float(confidence)


def analyze_star_colors(img: np.ndarray) -> dict:
    """
    Analyze the color distribution in the stars region.

    Useful for debugging and understanding star detection.

    Args:
        img: BGR color image

    Returns:
        Dictionary with color analysis metrics
    """
    if img is None or img.size == 0:
        return {"error": "Empty image"}

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]

    # Mask for colored pixels
    mask = (saturation > 30) & (value > 50)

    if np.sum(mask) < 100:
        return {
            "colored_pixels": int(np.sum(mask)),
            "error": "Not enough colored pixels"
        }

    hue_values = hue[mask]

    # Hue histogram
    hist, bin_edges = np.histogram(hue_values, bins=18, range=(0, 180))
    active_bins = np.sum(hist > np.max(hist) * 0.1)

    # Color names for hue ranges (approximate)
    color_names = [
        "red", "orange", "yellow", "yellow-green", "green", "green-cyan",
        "cyan", "cyan-blue", "blue", "blue-purple", "purple", "magenta",
        "magenta-red", "red", "red", "red", "red", "red"
    ]

    # Find dominant colors
    dominant_bins = np.argsort(hist)[-3:][::-1]
    dominant_colors = [color_names[i] for i in dominant_bins if hist[i] > 0]

    return {
        "colored_pixels": int(np.sum(mask)),
        "hue_mean": float(np.mean(hue_values)),
        "hue_std": float(np.std(hue_values)),
        "hue_range": float(np.ptp(hue_values)),
        "active_hue_bins": int(active_bins),
        "dominant_colors": dominant_colors,
        "saturation_mean": float(np.mean(saturation[mask])),
        "value_mean": float(np.mean(value[mask])),
    }
