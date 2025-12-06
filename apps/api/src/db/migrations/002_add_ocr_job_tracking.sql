-- Add OCR processing status to playthrough_songs
ALTER TABLE playthrough_songs ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE playthrough_songs ADD COLUMN IF NOT EXISTS ocr_error TEXT;
ALTER TABLE playthrough_songs ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMPTZ;

-- Valid statuses: pending, processing, completed, failed
-- pending = screenshot uploaded, waiting for OCR
-- processing = OCR in progress
-- completed = OCR succeeded, stats saved
-- failed = OCR failed, can be retried

-- Index for finding pending/processing jobs
CREATE INDEX IF NOT EXISTS idx_playthrough_songs_ocr_status
ON playthrough_songs(ocr_status) WHERE ocr_status IN ('pending', 'processing');
