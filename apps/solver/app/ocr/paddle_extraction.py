"""Text extraction and parsing using PaddleOCR."""
import os
import re
import cv2
import numpy as np
from typing import Optional, List, Tuple, Dict, Any
from paddleocr import PaddleOCR
from .preprocessing import check_landscape_orientation, normalize_size
from .regions import (
    detect_stats_card,
    detect_player_bar,
    detect_active_player_slot,
    extract_region,
    find_song_title_region,
    StatsCardRegion,
    PlayerBarSlot,
)
from .models import ExtractedPlayerStats, OcrResult
from .stars import detect_stars

# Initialize PaddleOCR with pre-downloaded models
_ocr_instance: Optional[PaddleOCR] = None


def get_ocr() -> PaddleOCR:
    """Get or create PaddleOCR instance."""
    global _ocr_instance
    if _ocr_instance is None:
        # PaddleOCR 2.8 with PaddlePaddle 2.x (stable on ARM64)
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            use_gpu=False,
            det_model_dir=os.environ.get('PADDLEOCR_DET_MODEL_DIR'),
            rec_model_dir=os.environ.get('PADDLEOCR_REC_MODEL_DIR'),
            cls_model_dir=os.environ.get('PADDLEOCR_CLS_MODEL_DIR'),
            show_log=False,
        )
    return _ocr_instance


def ocr_image(img: np.ndarray) -> List[Tuple[List, Tuple[str, float]]]:
    """
    Run PaddleOCR on an image.

    Args:
        img: BGR color image

    Returns:
        List of (bounding_box, (text, confidence)) tuples
    """
    ocr = get_ocr()
    result = ocr.ocr(img, cls=True)

    if result is None or len(result) == 0 or result[0] is None:
        return []

    return result[0]


def get_all_text(ocr_results: List[Tuple[List, Tuple[str, float]]]) -> str:
    """Combine all OCR text into a single string."""
    if not ocr_results:
        return ""
    return " ".join([line[1][0] for line in ocr_results])


def get_text_lines(ocr_results: List[Tuple[List, Tuple[str, float]]]) -> List[str]:
    """Get OCR text as list of lines."""
    if not ocr_results:
        return []
    return [line[1][0] for line in ocr_results]


def find_text_near_label(
    ocr_results: List[Tuple[List, Tuple[str, float]]],
    label_pattern: str,
    max_distance: int = 100
) -> Optional[str]:
    """
    Find text that appears near a label.

    Args:
        ocr_results: PaddleOCR results
        label_pattern: Regex pattern for the label
        max_distance: Maximum horizontal pixel distance

    Returns:
        Text near the label, or None
    """
    label_match = None
    label_box = None

    for result in ocr_results:
        box, (text, conf) = result
        if re.search(label_pattern, text, re.IGNORECASE):
            label_match = text
            label_box = box
            break

    if label_box is None:
        return None

    # Get center-right of label box
    label_right = max(p[0] for p in label_box)
    label_center_y = sum(p[1] for p in label_box) / 4

    # Find text to the right of the label on the same line
    best_match = None
    best_distance = float('inf')

    for result in ocr_results:
        box, (text, conf) = result
        if text == label_match:
            continue

        box_left = min(p[0] for p in box)
        box_center_y = sum(p[1] for p in box) / 4

        # Check if on same horizontal line
        if abs(box_center_y - label_center_y) < 30:
            distance = box_left - label_right
            if 0 < distance < max_distance and distance < best_distance:
                best_distance = distance
                best_match = text

    return best_match


def parse_accuracy(text: str) -> Optional[float]:
    """Parse accuracy percentage from text."""
    # Look for percentage patterns: "99%", "%99", "99 %"
    # Also handle decimal like "99.5%"
    patterns = [
        r'(\d{1,3}(?:\.\d+)?)\s*%',  # "99%" or "99.5%"
        r'%\s*(\d{1,3}(?:\.\d+)?)',  # "%99" or "% 99.5"
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                acc = float(match.group(1))
                if 0 <= acc <= 100:
                    return acc
            except ValueError:
                pass
    return None


def parse_difficulty(text: str) -> Optional[str]:
    """Parse difficulty level from text."""
    text_lower = text.lower()

    # Direct matches
    for diff in ["expert", "hard", "medium", "easy"]:
        if diff in text_lower:
            return diff

    # Handle OCR errors
    if re.search(r'exp\s*[^a-z]*\s*rt', text_lower):
        return "expert"
    if re.search(r'med\s*[^a-z]*\s*um', text_lower):
        return "medium"

    return None


def parse_score(text: str) -> Optional[int]:
    """Parse score from text (removes commas, periods)."""
    # Remove commas, periods, spaces
    cleaned = re.sub(r'[,.\s]', '', text)

    # Extract number
    match = re.search(r'(\d+)', cleaned)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass
    return None


def parse_multiplier(text: str) -> Optional[float]:
    """Parse multiplier value (e.g., '4.70', '3.35')."""
    # Look for decimal pattern
    match = re.search(r'(\d+)[.,](\d+)', text)
    if match:
        try:
            return float(f"{match.group(1)}.{match.group(2)}")
        except ValueError:
            pass
    return None


def extract_song_title(ocr_results: List[Tuple[List, Tuple[str, float]]], img_height: int) -> Optional[str]:
    """
    Extract song title from OCR results.

    The song title appears at the top of the screen, typically in larger font.
    We look for text that isn't UI labels and has song-like characteristics.
    """
    # Common UI text to skip
    ui_keywords = [
        'band', 'score', 'stars', 'connect', 'controller', 'player',
        'performance', 'notes', 'streak', 'multiplier', 'hit', 'missed',
        'expert', 'hard', 'medium', 'easy', 'pro', 'high', 'next', 'replay',
        'dlc', 'recommendations', 'see dlc',
    ]

    title_candidates = []

    for result in ocr_results:
        box, (text, conf) = result
        text_lower = text.lower().strip()

        # Skip very short text
        if len(text) < 4:
            continue

        # Skip common UI text
        is_ui = False
        for keyword in ui_keywords:
            if keyword in text_lower:
                is_ui = True
                break
        if is_ui:
            continue

        # Skip "Song X of Y" patterns (these are progress indicators, not titles)
        if re.match(r'^song\s+\d+\s+of\s+\d+$', text_lower):
            continue

        # Skip numbers/scores (e.g., "186,480")
        if re.match(r'^[\d,.\s%]+$', text):
            continue

        # Skip percentage patterns (e.g., "%66", "99%")
        if re.match(r'^%?\d+%?$', text):
            continue

        # Get position info
        y_pos = min(p[1] for p in box)
        x_pos = min(p[0] for p in box)

        # Song titles are in the top portion of the screen (roughly top 30%)
        if y_pos > img_height * 0.30:
            continue

        # Song titles tend to be in the center-right area
        title_candidates.append((y_pos, x_pos, text, conf))

    if not title_candidates:
        return None

    # Prefer text that is:
    # 1. Higher up on the screen (lower y_pos)
    # 2. Longer (song titles tend to be longer than UI labels)
    # 3. Higher confidence
    title_candidates.sort(key=lambda x: (x[0], -len(x[2]), -x[3]))

    return title_candidates[0][2].strip() if title_candidates else None


def extract_band_score(ocr_results: List[Tuple[List, Tuple[str, float]]], img_width: int, img_height: int) -> Optional[int]:
    """
    Extract band score from OCR results.

    Band score is typically in the top-right area, near the song title.
    It's a large number (typically 100k+) displayed prominently.
    """
    candidates = []

    for result in ocr_results:
        box, (text, conf) = result
        x_pos = min(p[0] for p in box)
        y_pos = min(p[1] for p in box)

        # Top portion of screen (band score is near song title at top)
        if y_pos < img_height * 0.30:
            # Check if it's a large number (band scores are typically 30k+)
            score = parse_score(text)
            if score and score >= 30000:
                # Prefer scores in the right half of screen
                priority = 1 if x_pos > img_width * 0.4 else 0
                candidates.append((priority, y_pos, score))

    if candidates:
        # Sort by priority (right side first), then by y position (topmost)
        candidates.sort(key=lambda x: (-x[0], x[1]))
        return candidates[0][2]

    return None


def extract_gamertag(
    color_img: np.ndarray,
    slots: List[PlayerBarSlot],
    active_slot: Optional[int] = None
) -> Optional[str]:
    """Extract gamertag from player bar using PaddleOCR."""

    def try_extract_from_slot(slot: PlayerBarSlot) -> Optional[str]:
        gt_region = slot.gamertag_region()
        gt_img = extract_region(color_img, *gt_region)
        if gt_img is None or gt_img.size == 0:
            return None

        results = ocr_image(gt_img)
        if not results:
            return None

        # Get the most confident text
        best_text = max(results, key=lambda x: x[1][1])[1][0]

        # Clean up
        cleaned = re.sub(r'[^a-zA-Z0-9\s\-_]', '', best_text)
        cleaned = cleaned.strip()

        # Skip "CONNECT CONTROLLER" type text
        if len(cleaned) < 2:
            return None
        if 'connect' in cleaned.lower():
            return None
        if 'controller' in cleaned.lower():
            return None

        return cleaned

    # Try active slot first
    if active_slot is not None and 0 <= active_slot < len(slots):
        gamertag = try_extract_from_slot(slots[active_slot])
        if gamertag:
            return gamertag

    # Try all slots
    for slot in slots:
        gamertag = try_extract_from_slot(slot)
        if gamertag:
            return gamertag

    return None


def parse_comma_number(text: str) -> Optional[int]:
    """Parse a number that may have commas (e.g., '1,521' -> 1521)."""
    # Match numbers with optional commas - use greedy \d+ to get all digits
    # Pattern: digits optionally followed by comma+digits groups
    match = re.search(r'(\d+(?:,\d+)*)', text)
    if match:
        try:
            return int(match.group(1).replace(',', ''))
        except ValueError:
            pass
    return None


def extract_performance_stats(
    full_text: str,
    text_lines: List[str]
) -> Dict[str, Any]:
    """
    Extract performance stats from the OCR text.

    Looks for:
    - Longest Streak: <number>
    - Notes Hit: <number>
    - Notes Missed: <number>
    - Avg. Multiplier: <decimal>
    """
    stats = {}

    # Combine approaches: search full text and individual lines

    # Longest Streak - look for pattern like "Streak: 358" or "Longest Streak: 358"
    streak_match = re.search(r'(?:longest\s*)?streak[:\s]*(\d+(?:,\d+)*)', full_text, re.IGNORECASE)
    if streak_match:
        stats['longest_streak'] = int(streak_match.group(1).replace(',', ''))

    # Notes Hit - look for "Notes Hit: 1,521" pattern
    # Handle comma-separated numbers
    hit_match = re.search(r'notes?\s*hit[:\s]*(\d+(?:,\d+)*)', full_text, re.IGNORECASE)
    if not hit_match:
        hit_match = re.search(r'(\d+(?:,\d+)*)\s*notes?\s*hit(?!\s*missed)', full_text, re.IGNORECASE)
    if hit_match:
        stats['notes_hit'] = int(hit_match.group(1).replace(',', ''))

    # Notes Missed - look for "Notes Missed: 50" pattern
    missed_match = re.search(r'(?:notes?\s*)?missed[:\s]*(\d+(?:,\d+)*)', full_text, re.IGNORECASE)
    if not missed_match:
        missed_match = re.search(r'(\d+(?:,\d+)*)\s*(?:notes?\s*)?missed', full_text, re.IGNORECASE)
    if missed_match:
        stats['notes_missed'] = int(missed_match.group(1).replace(',', ''))

    # Avg Multiplier - look for "Avg. Multiplier: 3.35" pattern
    mult_match = re.search(r'(?:avg\.?\s*)?multiplier[:\s]*(\d+[.,]\d+)', full_text, re.IGNORECASE)
    if not mult_match:
        mult_match = re.search(r'(\d+[.,]\d+)\s*(?:avg\.?\s*)?multiplier', full_text, re.IGNORECASE)
    if mult_match:
        mult_str = mult_match.group(1).replace(',', '.')
        try:
            stats['avg_multiplier'] = float(mult_str)
        except ValueError:
            pass

    # Alternative: scan lines for these values
    for line in text_lines:
        line_lower = line.lower()

        if 'longest_streak' not in stats and 'streak' in line_lower:
            num = parse_comma_number(line)
            if num:
                stats['longest_streak'] = num

        if 'notes_hit' not in stats and 'hit' in line_lower and 'miss' not in line_lower:
            num = parse_comma_number(line)
            if num:
                stats['notes_hit'] = num

        if 'notes_missed' not in stats and 'miss' in line_lower:
            num = parse_comma_number(line)
            if num:
                stats['notes_missed'] = num

        if 'avg_multiplier' not in stats and 'multi' in line_lower:
            mult_match = re.search(r'(\d+[.,]\d+)', line)
            if mult_match:
                mult_str = mult_match.group(1).replace(',', '.')
                try:
                    stats['avg_multiplier'] = float(mult_str)
                except ValueError:
                    pass

    return stats


def extract_stats_from_card(
    color_img: np.ndarray,
    stats_card: StatsCardRegion
) -> ExtractedPlayerStats:
    """
    Extract statistics from the stats card region using PaddleOCR.
    """
    stats = ExtractedPlayerStats(gamertag="Unknown")

    try:
        # Extract the stats card region
        card_img = extract_region(
            color_img,
            stats_card.x,
            stats_card.y,
            stats_card.width,
            stats_card.height
        )
        if card_img is None:
            return stats

        # Run OCR on the card
        ocr_results = ocr_image(card_img)
        full_text = get_all_text(ocr_results)
        text_lines = get_text_lines(ocr_results)

        # Parse accuracy
        acc = parse_accuracy(full_text)
        if acc is not None:
            stats.accuracy_pct = acc

        # Parse difficulty
        diff = parse_difficulty(full_text)
        if diff is not None:
            stats.difficulty = diff

        # Parse player score
        # Look for large numbers (5-6 digits) that aren't streak/notes
        score_candidates = re.findall(r'\b(\d{1,3}[,.]?\d{3})\b', full_text)
        for candidate in score_candidates:
            score_val = parse_score(candidate)
            if score_val and score_val >= 10000:
                stats.score = score_val
                break

        # If we didn't find score, try looking for patterns with "score"
        if stats.score is None:
            score_match = re.search(r'score[:\s]*(\d{1,3}[,.\s]?\d{3})', full_text, re.IGNORECASE)
            if score_match:
                stats.score = parse_score(score_match.group(1))

        # Parse performance stats
        perf_stats = extract_performance_stats(full_text, text_lines)
        stats.longest_streak = perf_stats.get('longest_streak')
        stats.notes_hit = perf_stats.get('notes_hit')
        stats.notes_missed = perf_stats.get('notes_missed')
        stats.avg_multiplier = perf_stats.get('avg_multiplier')

        # Extract stars using color-based detection
        card_h = card_img.shape[0]
        stars_portion = card_img[int(card_h * 0.35):int(card_h * 0.60), :]
        if stars_portion.size > 0:
            star_result = detect_stars(stars_portion)
            stats.stars_earned = star_result.count
            stats.gold_stars = star_result.is_gold

    except Exception as e:
        print(f"Error extracting stats from card: {e}")

    return stats


def extract_stats(image_path: str) -> OcrResult:
    """
    Full OCR extraction pipeline for Rock Band screenshot using PaddleOCR.

    Args:
        image_path: Path to screenshot file

    Returns:
        OcrResult with extracted data
    """
    result = OcrResult(success=False)
    errors = []

    try:
        # Load original color image
        color_img = cv2.imread(image_path)
        if color_img is None:
            errors.append(f"Failed to load image: {image_path}")
            result.errors = errors
            return result

        # Check landscape orientation
        if not check_landscape_orientation(color_img):
            # Try to auto-rotate portrait images
            color_img = cv2.rotate(color_img, cv2.ROTATE_90_CLOCKWISE)

        # Resize image for faster OCR - 1920px is optimal balance
        color_img = normalize_size(color_img, target_width=1920)
        img_height, img_width = color_img.shape[:2]

        # Run OCR on resized image for title and band score
        full_ocr_results = ocr_image(color_img)
        full_text = get_all_text(full_ocr_results)

        # Store raw text for debugging
        result.raw_text = full_text

        # Extract song title
        song_title = extract_song_title(full_ocr_results, img_height)
        if song_title:
            result.song_title = song_title
        else:
            errors.append("Could not extract song title")

        # Extract band score
        band_score = extract_band_score(full_ocr_results, img_width, img_height)
        if band_score:
            result.band_score = band_score

        # Detect stats card
        stats_card = detect_stats_card(color_img)
        if stats_card is None:
            errors.append("Could not detect stats card region")

        # Detect player bar and active slot
        player_slots = detect_player_bar(color_img)
        active_slot = detect_active_player_slot(color_img, player_slots)

        # Extract player stats - try region-based first, then full-image fallback
        players = []
        player_stats = ExtractedPlayerStats(gamertag="Unknown")

        # Try region-based extraction from stats card
        if stats_card is not None:
            player_stats = extract_stats_from_card(color_img, stats_card)

        # Parse from full image OCR for any missing fields
        full_text_lines = get_text_lines(full_ocr_results)

        # Accuracy from full text if not found in card
        if player_stats.accuracy_pct is None:
            acc = parse_accuracy(full_text)
            if acc is not None:
                player_stats.accuracy_pct = acc

        # Difficulty from full text if not found in card
        if player_stats.difficulty is None:
            diff = parse_difficulty(full_text)
            if diff is not None:
                player_stats.difficulty = diff

        # Performance stats from full text if not found in card
        if player_stats.longest_streak is None or player_stats.notes_hit is None:
            perf_stats = extract_performance_stats(full_text, full_text_lines)
            if player_stats.longest_streak is None:
                player_stats.longest_streak = perf_stats.get('longest_streak')
            if player_stats.notes_hit is None:
                player_stats.notes_hit = perf_stats.get('notes_hit')
            if player_stats.notes_missed is None:
                player_stats.notes_missed = perf_stats.get('notes_missed')
            if player_stats.avg_multiplier is None:
                player_stats.avg_multiplier = perf_stats.get('avg_multiplier')

        # Score from full text if not found in card
        if player_stats.score is None:
            # Look for large numbers in the text that could be scores
            score_candidates = re.findall(r'\b(\d{1,3}[,.]?\d{3})\b', full_text)
            for candidate in score_candidates:
                score_val = parse_score(candidate)
                if score_val and score_val >= 10000:
                    player_stats.score = score_val
                    break

        # Extract gamertag from player bar
        gamertag = extract_gamertag(color_img, player_slots, active_slot)
        if gamertag:
            player_stats.gamertag = gamertag
        else:
            # Try to find gamertag in full OCR text
            # Look for text that looks like a gamertag (not UI text)
            ui_keywords = ['connect', 'controller', 'performance', 'score', 'expert',
                          'hard', 'medium', 'easy', 'notes', 'streak', 'multiplier',
                          'hit', 'missed', 'high', 'band']
            for ocr_result in full_ocr_results:
                box, (text, conf) = ocr_result
                cleaned = re.sub(r'[^a-zA-Z0-9\s\-_]', '', text).strip()
                if len(cleaned) >= 3:
                    is_ui = any(kw in cleaned.lower() for kw in ui_keywords)
                    if not is_ui and not cleaned.isdigit():
                        # Check if it's in the center-bottom area (gamertag position)
                        y_pos = min(p[1] for p in box)
                        x_pos = min(p[0] for p in box)
                        if y_pos > img_height * 0.50 and x_pos > img_width * 0.25:
                            player_stats.gamertag = cleaned
                            break

        players.append(player_stats)

        result.players = players

        # Mark as success if we extracted at least one player
        result.success = len(players) > 0
        result.errors = errors if errors else []

        return result

    except Exception as e:
        result.errors = [f"OCR extraction failed: {str(e)}"]
        return result
