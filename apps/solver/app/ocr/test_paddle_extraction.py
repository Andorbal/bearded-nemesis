"""Test script for PaddleOCR extraction against example screenshots."""
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import json

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.ocr.paddle_extraction import extract_stats
from app.ocr.models import OcrResult


# Example screenshots directory
SCREENSHOTS_DIR = Path(__file__).parent.parent.parent.parent.parent / "docs" / "example-screenshots"

# Fields to extract and their categories
# band_score excluded - not critical for the application
EASY_FIELDS = ['song_title', 'accuracy_pct', 'difficulty', 'gamertag']
HARD_FIELDS = ['longest_streak', 'notes_hit', 'notes_missed', 'avg_multiplier']
ALL_FIELDS = EASY_FIELDS + HARD_FIELDS + ['stars_earned', 'score', 'band_score']


def get_field_value(result: OcrResult, field: str) -> Optional[Any]:
    """Get a field value from an OcrResult."""
    if field in ['song_title', 'band_score']:
        return getattr(result, field, None)
    elif result.players:
        player = result.players[0]
        return getattr(player, field, None)
    return None


def format_value(value: Any) -> str:
    """Format a value for display."""
    if value is None:
        return "N/A"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def process_screenshot(image_path: str) -> Dict[str, Any]:
    """
    Process a single screenshot and return extraction results.

    Returns:
        Dictionary with extracted fields, timing, and success status
    """
    start_time = time.time()
    result = extract_stats(image_path)
    elapsed = time.time() - start_time

    extracted = {
        'file': os.path.basename(image_path),
        'success': result.success,
        'time_seconds': round(elapsed, 2),
        'errors': result.errors,
        'raw_text': result.raw_text[:200] if result.raw_text else None,
    }

    # Extract all fields
    for field in ALL_FIELDS:
        extracted[field] = get_field_value(result, field)

    return extracted


def run_all_tests() -> List[Dict[str, Any]]:
    """Run extraction on all screenshots in the example directory."""
    if not SCREENSHOTS_DIR.exists():
        print(f"Error: Screenshots directory not found: {SCREENSHOTS_DIR}")
        return []

    screenshots = sorted(SCREENSHOTS_DIR.glob("*.jpeg")) + sorted(SCREENSHOTS_DIR.glob("*.jpg"))

    if not screenshots:
        print(f"Error: No screenshots found in {SCREENSHOTS_DIR}")
        return []

    print(f"\n{'='*80}")
    print(f"PaddleOCR Extraction Test - {len(screenshots)} screenshots")
    print(f"{'='*80}\n")

    results = []
    for i, screenshot_path in enumerate(screenshots, 1):
        print(f"[{i}/{len(screenshots)}] Processing {screenshot_path.name}...")
        result = process_screenshot(str(screenshot_path))
        results.append(result)

        # Print summary for this image
        print(f"  Time: {result['time_seconds']}s | Success: {result['success']}")
        print(f"  Title: {format_value(result.get('song_title'))}")
        print(f"  Gamertag: {format_value(result.get('gamertag'))}")
        print(f"  Accuracy: {format_value(result.get('accuracy_pct'))}%")
        print(f"  Difficulty: {format_value(result.get('difficulty'))}")
        print(f"  Score: {format_value(result.get('score'))}")
        print(f"  Stars: {format_value(result.get('stars_earned'))}")
        print(f"  Streak: {format_value(result.get('longest_streak'))}")
        print(f"  Notes Hit: {format_value(result.get('notes_hit'))}")
        print(f"  Notes Missed: {format_value(result.get('notes_missed'))}")
        print(f"  Avg Multiplier: {format_value(result.get('avg_multiplier'))}")

        if result['errors']:
            print(f"  Errors: {', '.join(result['errors'])}")
        print()

    return results


def calculate_accuracy(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate accuracy metrics for the extraction results."""
    total = len(results)
    if total == 0:
        return {}

    metrics = {
        'total_images': total,
        'successful_extractions': sum(1 for r in results if r['success']),
        'avg_time_seconds': round(sum(r['time_seconds'] for r in results) / total, 2),
        'field_extraction_rates': {},
    }

    # Calculate extraction rate for each field
    for field in ALL_FIELDS:
        extracted_count = sum(1 for r in results if r.get(field) is not None)
        rate = (extracted_count / total) * 100
        metrics['field_extraction_rates'][field] = {
            'count': extracted_count,
            'rate': round(rate, 1),
        }

    # Calculate category rates
    easy_rates = [metrics['field_extraction_rates'][f]['rate'] for f in EASY_FIELDS if f in metrics['field_extraction_rates']]
    hard_rates = [metrics['field_extraction_rates'][f]['rate'] for f in HARD_FIELDS if f in metrics['field_extraction_rates']]

    metrics['easy_fields_avg_rate'] = round(sum(easy_rates) / len(easy_rates), 1) if easy_rates else 0
    metrics['hard_fields_avg_rate'] = round(sum(hard_rates) / len(hard_rates), 1) if hard_rates else 0

    return metrics


def print_summary(metrics: Dict[str, Any]):
    """Print a summary of the extraction results."""
    print(f"\n{'='*80}")
    print("EXTRACTION SUMMARY")
    print(f"{'='*80}\n")

    print(f"Total images processed: {metrics['total_images']}")
    print(f"Successful extractions: {metrics['successful_extractions']}")
    print(f"Average processing time: {metrics['avg_time_seconds']}s per image\n")

    print("Field Extraction Rates:")
    print("-" * 50)

    # Easy fields
    print("\nEASY FIELDS (target: 90%):")
    for field in EASY_FIELDS:
        if field in metrics['field_extraction_rates']:
            data = metrics['field_extraction_rates'][field]
            status = "PASS" if data['rate'] >= 90 else "FAIL"
            print(f"  {field:20s}: {data['rate']:5.1f}% ({data['count']}/{metrics['total_images']}) [{status}]")

    print(f"\n  Average: {metrics['easy_fields_avg_rate']}%")

    # Hard fields
    print("\nHARD FIELDS (target: 75%):")
    for field in HARD_FIELDS:
        if field in metrics['field_extraction_rates']:
            data = metrics['field_extraction_rates'][field]
            status = "PASS" if data['rate'] >= 75 else "FAIL"
            print(f"  {field:20s}: {data['rate']:5.1f}% ({data['count']}/{metrics['total_images']}) [{status}]")

    print(f"\n  Average: {metrics['hard_fields_avg_rate']}%")

    # Other fields
    print("\nOTHER FIELDS:")
    for field in ['stars_earned', 'score']:
        if field in metrics['field_extraction_rates']:
            data = metrics['field_extraction_rates'][field]
            print(f"  {field:20s}: {data['rate']:5.1f}% ({data['count']}/{metrics['total_images']})")

    # Overall assessment
    print(f"\n{'='*80}")
    print("OVERALL ASSESSMENT")
    print(f"{'='*80}")

    easy_pass = metrics['easy_fields_avg_rate'] >= 90
    hard_pass = metrics['hard_fields_avg_rate'] >= 75
    time_pass = metrics['avg_time_seconds'] < 3.0

    print(f"Easy fields >= 90%: {'PASS' if easy_pass else 'FAIL'} ({metrics['easy_fields_avg_rate']}%)")
    print(f"Hard fields >= 75%: {'PASS' if hard_pass else 'FAIL'} ({metrics['hard_fields_avg_rate']}%)")
    print(f"Processing time < 3s: {'PASS' if time_pass else 'FAIL'} ({metrics['avg_time_seconds']}s)")

    if easy_pass and hard_pass and time_pass:
        print("\n*** ALL CRITERIA MET ***")
    else:
        print("\n*** SOME CRITERIA NOT MET ***")


def main():
    """Main entry point."""
    results = run_all_tests()

    if results:
        metrics = calculate_accuracy(results)
        print_summary(metrics)

        # Save detailed results to JSON
        output_file = Path(__file__).parent / "paddle_test_results.json"
        with open(output_file, 'w') as f:
            json.dump({
                'results': results,
                'metrics': metrics,
            }, f, indent=2)
        print(f"\nDetailed results saved to: {output_file}")


if __name__ == '__main__':
    main()
