import * as fs from 'fs/promises';
import * as path from 'path';

const SCREENSHOTS_DIR = process.env.SCREENSHOT_PATH || '../../screenshots';

/**
 * Generate screenshot filename path.
 *
 * @param playthroughId - The playthrough ID
 * @param position - Song position in the setlist
 * @returns Full path to screenshot file
 */
export function generateScreenshotPath(playthroughId: number, position: number): string {
  const timestamp = Date.now();
  const filename = `playthrough_${playthroughId}_song_${position}_${timestamp}.jpg`;
  return path.join(SCREENSHOTS_DIR, filename);
}

/**
 * Save screenshot buffer to disk.
 *
 * @param buffer - Image data buffer
 * @param filepath - Destination path
 */
export async function saveScreenshot(buffer: Buffer, filepath: string): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });

  // Write file
  await fs.writeFile(filepath, buffer);
}

/**
 * Delete screenshot file.
 *
 * @param filepath - Path to screenshot to delete
 */
export async function deleteScreenshot(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath);
  } catch {
    // Ignore errors (file may not exist)
  }
}

/**
 * Check if a screenshot exists.
 *
 * @param filepath - Path to check
 * @returns true if file exists
 */
export async function screenshotExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the screenshots directory path (for use in tests).
 */
export function getScreenshotsDir(): string {
  return SCREENSHOTS_DIR;
}

/**
 * Convert filesystem screenshot path to HTTP URL path.
 *
 * @param filepath - Full filesystem path to screenshot
 * @returns URL path for accessing the screenshot via HTTP (e.g., /screenshots/filename.jpg)
 */
export function getScreenshotUrl(filepath: string): string {
  const filename = path.basename(filepath);
  return `/screenshots/${filename}`;
}
