"""Test PaddleOCR on a single image."""
import os
import sys
import time

os.environ['PADDLEOCR_DET_MODEL_DIR'] = '/opt/paddleocr-models/en_PP-OCRv3_det_infer'
os.environ['PADDLEOCR_REC_MODEL_DIR'] = '/opt/paddleocr-models/en_PP-OCRv3_rec_infer'
os.environ['PADDLEOCR_CLS_MODEL_DIR'] = '/opt/paddleocr-models/ch_ppocr_mobile_v2.0_cls_infer'

sys.path.insert(0, '.')
from app.ocr.paddle_extraction import extract_stats

image_path = '../docs/example-screenshots/IMG_1816.jpeg'
print(f"Processing {image_path}...")

start = time.time()
result = extract_stats(image_path)
elapsed = time.time() - start

print(f"\nTime: {elapsed:.2f}s")
print(f"Success: {result.success}")
print(f"Song Title: {result.song_title}")
print(f"Band Score: {result.band_score}")

if result.players:
    p = result.players[0]
    print(f"Gamertag: {p.gamertag}")
    print(f"Accuracy: {p.accuracy_pct}%")
    print(f"Difficulty: {p.difficulty}")
    print(f"Score: {p.score}")
    print(f"Stars: {p.stars_earned} (gold: {p.gold_stars})")
    print(f"Streak: {p.longest_streak}")
    print(f"Notes Hit: {p.notes_hit}")
    print(f"Notes Missed: {p.notes_missed}")
    print(f"Avg Multiplier: {p.avg_multiplier}")

if result.errors:
    print(f"Errors: {result.errors}")
