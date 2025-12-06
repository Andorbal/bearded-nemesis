import { compareTwoStrings } from 'string-similarity';
import * as userRepo from '../repositories/userRepository.js';
import type { User } from '@bearded-nemesis/shared';

const SIMILARITY_THRESHOLD = 0.7; // 70% similarity required

/**
 * Normalize gamertag for comparison.
 * Handles common OCR errors: 0/O, 1/l/I, etc.
 */
function normalizeGamertag(gamertag: string): string {
  return gamertag
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .trim();
}

/**
 * Find user by gamertag with fuzzy matching.
 *
 * Handles OCR errors and typos by using string similarity matching.
 *
 * @param extractedGamertag - Gamertag extracted from OCR
 * @returns Matched user or null if no match found
 */
export async function findUserByGamertag(
  extractedGamertag: string
): Promise<User | null> {
  // Get all users with gamertags
  const users = await userRepo.findUsersWithGamertags();

  if (users.length === 0) {
    return null;
  }

  const normalized = normalizeGamertag(extractedGamertag);

  // Find best match
  let bestMatch: User | null = null;
  let bestSimilarity = 0;

  for (const user of users) {
    if (!user.xboxGamertag) continue;

    const userNormalized = normalizeGamertag(user.xboxGamertag);

    // First check for exact match (normalized)
    if (normalized === userNormalized) {
      return user;
    }

    // Then check similarity
    const similarity = compareTwoStrings(normalized, userNormalized);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = user;
    }
  }

  // Return match if above threshold
  if (bestSimilarity >= SIMILARITY_THRESHOLD) {
    return bestMatch;
  }

  return null;
}

/**
 * Match multiple extracted gamertags to users.
 *
 * Returns array with same length as input, with null for unmatched gamertags.
 *
 * @param extractedGamertags - Array of gamertags from OCR
 * @returns Array of matched users (or null for unmatched)
 */
export async function matchGamertags(
  extractedGamertags: string[]
): Promise<(User | null)[]> {
  const matches: (User | null)[] = [];

  for (const gamertag of extractedGamertags) {
    const match = await findUserByGamertag(gamertag);
    matches.push(match);
  }

  return matches;
}

/**
 * Get the similarity threshold (for testing).
 */
export function getSimilarityThreshold(): number {
  return SIMILARITY_THRESHOLD;
}
