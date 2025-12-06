"""Region detection and layout analysis for Rock Band results screen."""
import cv2
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass


# TODO: Add support for multi-player screens (2-4 players)
# The layout may differ with multiple players showing side-by-side stats.
# Will need example screenshots to implement this properly.


@dataclass
class StatsCardRegion:
    """
    Represents the detected stats card region in a single-player results screen.

    The Rock Band 4 single-player results screen has a central stats card containing:
    - Instrument icon (with optional "PRO" label) + accuracy percentage
    - Difficulty level (EASY, MEDIUM, HARD, EXPERT)
    - Optional "High score!" indicator
    - Player score
    - 5 stars (can be regular or gold)
    - PERFORMANCE section with detailed stats
    """
    x: int
    y: int
    width: int
    height: int

    def icon_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for instrument icon (contains PRO label if applicable).
        Located at top-left of the actual stats card content.

        Note: The detected card region includes ~8% header with band info,
        so actual content percentages are offset by that.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.15),
            self.y + int(self.height * 0.22),
            int(self.width * 0.15),
            int(self.height * 0.06)
        )

    def accuracy_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for accuracy percentage (e.g., "96%").
        Located to the right of the instrument icon.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.32),
            self.y + int(self.height * 0.22),
            int(self.width * 0.28),
            int(self.height * 0.06)
        )

    def difficulty_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for difficulty level (EXPERT, HARD, etc.).
        Located below the accuracy.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.22),
            self.y + int(self.height * 0.29),
            int(self.width * 0.40),
            int(self.height * 0.04)
        )

    def score_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for player score.
        Located in the middle section of the card.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.22),
            self.y + int(self.height * 0.40),
            int(self.width * 0.45),
            int(self.height * 0.06)
        )

    def stars_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for star rating (5 stars, regular or gold).
        Located below the score.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.12),
            self.y + int(self.height * 0.47),
            int(self.width * 0.75),
            int(self.height * 0.10)
        )

    def performance_region(self) -> Tuple[int, int, int, int]:
        """
        Get region for PERFORMANCE stats section.
        Contains: Longest Streak, Notes Hit, Notes Missed, Avg Multiplier.
        Located at bottom of stats card.

        Returns:
            Tuple of (x, y, width, height)
        """
        return (
            self.x + int(self.width * 0.12),
            self.y + int(self.height * 0.60),
            int(self.width * 0.80),
            int(self.height * 0.38)
        )


@dataclass
class PlayerBarSlot:
    """
    Represents a player slot in the bottom player bar.

    The player bar shows up to 4 slots, each containing either:
    - A gamertag (for connected players)
    - "CONNECT CONTROLLER" text (for empty slots)
    """
    x: int
    y: int
    width: int
    height: int
    slot_index: int  # 0-3, left to right

    def gamertag_region(self) -> Tuple[int, int, int, int]:
        """Get the region where gamertag text appears."""
        return (
            self.x + int(self.width * 0.1),
            self.y + int(self.height * 0.1),
            int(self.width * 0.8),
            int(self.height * 0.5)
        )


def detect_stats_card(img: np.ndarray) -> Optional[StatsCardRegion]:
    """
    Detect the central stats card in a single-player results screen.

    Uses color-based detection to find the blue UI card border.

    Args:
        img: BGR color image (not grayscale)

    Returns:
        StatsCardRegion if found, None otherwise
    """
    height, width = img.shape[:2]

    # Convert to HSV for color detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Detect blue UI elements (Rock Band uses cyan/blue for UI borders)
    # Blue hue is around 90-130 in OpenCV HSV
    lower_blue = np.array([85, 50, 50])
    upper_blue = np.array([135, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)

    # Use edge detection to find the card border
    edges = cv2.Canny(blue_mask, 50, 150)

    # Dilate to connect edge segments
    kernel = np.ones((5, 5), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return _estimate_stats_card_region(height, width)

    # Look for a rectangular contour that could be the stats card
    # The stats card is a vertical rectangle in the center-left of screen
    best_contour = None
    best_score = 0

    target_center_x = width * 0.30  # Stats card is typically left of center
    target_center_y = height * 0.45  # Middle of screen vertically

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h

        # Skip small regions
        if area < (width * height * 0.01):
            continue

        # Skip regions that are too wide or too short
        if w > width * 0.5:
            continue
        if h < height * 0.3:
            continue

        # The stats card should be taller than wide (aspect ratio > 1)
        aspect = h / max(w, 1)
        if aspect < 0.8:
            continue

        # Calculate center of this contour
        cx = x + w / 2
        cy = y + h / 2

        # Score based on:
        # 1. Proximity to expected center position
        # 2. Appropriate aspect ratio (taller than wide)
        # 3. Size (larger is better, but not too large)
        pos_score = 1.0 / (1 + abs(cx - target_center_x) / width + abs(cy - target_center_y) / height)
        aspect_score = min(aspect, 2.0) / 2.0  # Cap at 2.0
        size_score = min(area / (width * height * 0.15), 1.0)

        score = pos_score * aspect_score * size_score

        if score > best_score:
            best_score = score
            best_contour = contour

    if best_contour is not None:
        x, y, w, h = cv2.boundingRect(best_contour)
        return StatsCardRegion(x=x, y=y, width=w, height=h)

    # Fall back to estimate based on typical Rock Band layout
    return _estimate_stats_card_region(height, width)


def _estimate_stats_card_region(height: int, width: int) -> StatsCardRegion:
    """
    Estimate stats card region based on typical Rock Band layout.

    Used as fallback when color detection fails.

    The stats card in Rock Band 4 single-player results:
    - Horizontally: roughly 15-45% of screen width (left of center)
    - Vertically: roughly 22-78% of screen height (below title, above player bar)
    """
    return StatsCardRegion(
        x=int(width * 0.15),
        y=int(height * 0.22),
        width=int(width * 0.30),
        height=int(height * 0.56)
    )


def detect_player_bar(img: np.ndarray) -> List[PlayerBarSlot]:
    """
    Detect player slots in the bottom player bar.

    Args:
        img: BGR color image

    Returns:
        List of PlayerBarSlot objects (up to 4)
    """
    height, width = img.shape[:2]

    # Player bar is at the bottom ~12% of the screen
    bar_top = int(height * 0.88)
    bar_height = height - bar_top

    # Divide into 4 equal slots
    slot_width = width // 4

    slots = []
    for i in range(4):
        slots.append(PlayerBarSlot(
            x=i * slot_width,
            y=bar_top,
            width=slot_width,
            height=bar_height,
            slot_index=i
        ))

    return slots


def detect_active_player_slot(img: np.ndarray, slots: List[PlayerBarSlot]) -> Optional[int]:
    """
    Detect which player slot is active (has a gamertag, not "CONNECT CONTROLLER").

    In single-player, only one slot will have actual player info.

    Args:
        img: BGR color image
        slots: List of PlayerBarSlot objects

    Returns:
        Index of active slot (0-3), or None if detection fails
    """
    # For single player, we look for the slot that appears different
    # (has gamertag text instead of "CONNECT CONTROLLER")

    # Simple heuristic: active slot often has different brightness/color
    # due to highlighting

    best_slot = None
    best_brightness = 0

    for slot in slots:
        region = extract_region(img, slot.x, slot.y, slot.width, slot.height)
        if region is None:
            continue

        # Convert to grayscale and check average brightness
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)

        if brightness > best_brightness:
            best_brightness = brightness
            best_slot = slot.slot_index

    return best_slot


def find_song_title_region(img: np.ndarray) -> Tuple[int, int, int, int]:
    """
    Find region containing song title.

    Args:
        img: Image (grayscale or color)

    Returns:
        Tuple of (x, y, width, height)
    """
    height, width = img.shape[:2]

    # Song title is in the top area, center-left
    return (
        int(width * 0.15),
        int(height * 0.02),
        int(width * 0.50),
        int(height * 0.08)
    )


def find_band_score_region(img: np.ndarray) -> Tuple[int, int, int, int]:
    """
    Find region containing band score (top-right area).

    Args:
        img: Image (grayscale or color)

    Returns:
        Tuple of (x, y, width, height)
    """
    height, width = img.shape[:2]

    # Band score is in top-right
    return (
        int(width * 0.55),
        int(height * 0.02),
        int(width * 0.40),
        int(height * 0.10)
    )


def extract_region(img: np.ndarray, x: int, y: int, width: int, height: int) -> Optional[np.ndarray]:
    """
    Extract a rectangular region from image with bounds checking.

    Args:
        img: Source image (grayscale or color)
        x: Left coordinate
        y: Top coordinate
        width: Region width
        height: Region height

    Returns:
        Extracted region or None if invalid bounds
    """
    img_h, img_w = img.shape[:2]

    # Clamp to image bounds
    x = max(0, min(x, img_w - 1))
    y = max(0, min(y, img_h - 1))
    x2 = max(x + 1, min(x + width, img_w))
    y2 = max(y + 1, min(y + height, img_h))

    if x2 <= x or y2 <= y:
        return None

    return img[y:y2, x:x2]


# Keep old PlayerColumn for backwards compatibility during transition
@dataclass
class PlayerColumn:
    """
    DEPRECATED: Use StatsCardRegion instead.

    Represents a detected player column in the results screen.
    Kept for backwards compatibility.
    """
    x: int
    y: int
    width: int
    height: int

    def gamertag_region(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.width, int(self.height * 0.15))

    def accuracy_region(self) -> Tuple[int, int, int, int]:
        y_offset = int(self.height * 0.15)
        return (self.x, self.y + y_offset, self.width, int(self.height * 0.1))

    def difficulty_region(self) -> Tuple[int, int, int, int]:
        y_offset = int(self.height * 0.25)
        return (self.x, self.y + y_offset, self.width, int(self.height * 0.08))

    def score_region(self) -> Tuple[int, int, int, int]:
        y_offset = int(self.height * 0.35)
        return (self.x, self.y + y_offset, self.width, int(self.height * 0.1))

    def stars_region(self) -> Tuple[int, int, int, int]:
        y_offset = int(self.height * 0.45)
        return (self.x, self.y + y_offset, self.width, int(self.height * 0.12))

    def stats_region(self) -> Tuple[int, int, int, int]:
        y_offset = int(self.height * 0.6)
        return (self.x, self.y + y_offset, self.width, int(self.height * 0.4))


def detect_player_columns(img: np.ndarray, max_columns: int = 4) -> List[PlayerColumn]:
    """
    DEPRECATED: Use detect_stats_card() instead.

    Detect player columns in the results screen.
    Kept for backwards compatibility.
    """
    height, width = img.shape[:2]

    # Return a single column covering the stats card area
    return [PlayerColumn(
        x=int(width * 0.15),
        y=int(height * 0.25),
        width=int(width * 0.35),
        height=int(height * 0.50)
    )]
