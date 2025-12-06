"""Image preprocessing for OCR."""
import cv2
import numpy as np
from typing import Optional, Tuple


def convert_to_grayscale(img: np.ndarray) -> np.ndarray:
    """
    Convert image to grayscale.

    Args:
        img: BGR color image from cv2.imread

    Returns:
        Grayscale image
    """
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def enhance_contrast(img: np.ndarray, clip_limit: float = 3.0, tile_grid_size: Tuple[int, int] = (8, 8)) -> np.ndarray:
    """
    Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization).

    Args:
        img: Grayscale image
        clip_limit: Threshold for contrast limiting
        tile_grid_size: Size of grid for histogram equalization

    Returns:
        Contrast-enhanced image
    """
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    return clahe.apply(img)


def denoise_image(img: np.ndarray) -> np.ndarray:
    """
    Apply denoising to reduce image noise.

    Args:
        img: Grayscale image

    Returns:
        Denoised image
    """
    # Non-local means denoising - good for photographs
    return cv2.fastNlMeansDenoising(img, h=10, templateWindowSize=7, searchWindowSize=21)


def detect_screen_corners(img: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect the four corners of the TV screen in the image.
    Uses edge detection and contour finding.

    Args:
        img: Color image

    Returns:
        Array of 4 corners [(x1,y1), (x2,y2), (x3,y3), (x4,y4)] or None if detection fails
    """
    # Convert to grayscale
    gray = convert_to_grayscale(img)

    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Edge detection
    edges = cv2.Canny(blurred, 50, 150)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    # Sort contours by area (descending)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    # Look for largest quadrilateral
    for contour in contours[:10]:  # Check top 10 largest contours
        # Approximate contour to polygon
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        # If we have 4 vertices, we found a quadrilateral
        if len(approx) == 4:
            # Reshape to (4, 2)
            return approx.reshape(4, 2)

    return None


def order_corners(corners: np.ndarray) -> np.ndarray:
    """
    Order corners in consistent order: top-left, top-right, bottom-right, bottom-left.

    Args:
        corners: Array of 4 corners (any order)

    Returns:
        Ordered corners
    """
    # Calculate center point
    center = corners.mean(axis=0)

    # Sort by angle from center
    angles = np.arctan2(corners[:, 1] - center[1], corners[:, 0] - center[0])
    sorted_indices = np.argsort(angles)

    # Rotate so top-left is first
    # Top-left should have smallest x+y sum
    ordered = corners[sorted_indices]
    sums = ordered[:, 0] + ordered[:, 1]
    start_idx = np.argmin(sums)

    return np.roll(ordered, -start_idx, axis=0)


def correct_perspective(img: np.ndarray, corners: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Apply perspective correction to straighten the image.

    Args:
        img: Color image
        corners: Optional pre-detected corners. If None, will auto-detect.

    Returns:
        Perspective-corrected image
    """
    # Auto-detect corners if not provided
    if corners is None:
        corners = detect_screen_corners(img)

    # If no corners detected, return original
    if corners is None:
        return img

    # Order corners consistently
    corners = order_corners(corners)

    # Calculate dimensions of output image
    # Use maximum width and height from the quadrilateral
    widths = [
        np.linalg.norm(corners[0] - corners[1]),  # top
        np.linalg.norm(corners[2] - corners[3]),  # bottom
    ]
    heights = [
        np.linalg.norm(corners[0] - corners[3]),  # left
        np.linalg.norm(corners[1] - corners[2]),  # right
    ]

    max_width = int(max(widths))
    max_height = int(max(heights))

    # Define destination points for perspective transform
    dst_corners = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype=np.float32)

    # Calculate perspective transform matrix
    corners_float = corners.astype(np.float32)
    matrix = cv2.getPerspectiveTransform(corners_float, dst_corners)

    # Apply perspective warp
    warped = cv2.warpPerspective(img, matrix, (max_width, max_height))

    return warped


def normalize_size(img: np.ndarray, target_width: int = 1920) -> np.ndarray:
    """
    Resize image to standard width while maintaining aspect ratio.

    Args:
        img: Input image
        target_width: Target width in pixels

    Returns:
        Resized image
    """
    h, w = img.shape[:2]
    aspect_ratio = h / w
    target_height = int(target_width * aspect_ratio)

    return cv2.resize(img, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)


def check_landscape_orientation(img: np.ndarray) -> bool:
    """
    Check if image is in landscape orientation.

    Args:
        img: Image array

    Returns:
        True if landscape (width > height), False if portrait
    """
    h, w = img.shape[:2]
    return w > h


def preprocess_image(image_path: str) -> Tuple[Optional[np.ndarray], Optional[str]]:
    """
    Full preprocessing pipeline for Rock Band screenshot.

    Pipeline:
    1. Load image
    2. Validate landscape orientation
    3. Detect and correct perspective (if needed)
    4. Normalize size
    5. Convert to grayscale
    6. Enhance contrast
    7. Denoise

    Args:
        image_path: Path to screenshot file

    Returns:
        Tuple of (preprocessed grayscale image, error message).
        On success: (image, None)
        On failure: (None, error message)
    """
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        return None, f"Failed to load image: {image_path}"

    # Validate landscape orientation
    if not check_landscape_orientation(img):
        h, w = img.shape[:2]
        return None, f"Image must be in landscape orientation (width > height). Got {w}x{h} (portrait). Please rotate the image and try again."

    # Correct perspective
    corrected = correct_perspective(img)

    # Normalize to standard size (makes OCR more consistent)
    normalized = normalize_size(corrected, target_width=1920)

    # Convert to grayscale
    gray = convert_to_grayscale(normalized)

    # Enhance contrast
    enhanced = enhance_contrast(gray)

    # Denoise
    denoised = denoise_image(enhanced)

    return denoised, None
