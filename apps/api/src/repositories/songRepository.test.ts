import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../db/pool.js';
import * as songRepo from './songRepository.js';

describe('songRepository', () => {
  const testSong = {
    id: 99999,
    slug: 'test-song-artist',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    year: 2020,
    durationMs: 180000,
    bpm: 120,
    genre: 'Rock',
    difficultyDrums: 3,
    difficultyGuitar: 4,
    difficultyBass: 2,
    difficultyVocals: 3,
    difficultyKeys: 0,
  };

  beforeEach(async () => {
    await pool.query('DELETE FROM songs WHERE id = $1', [testSong.id]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM songs WHERE id = $1', [testSong.id]);
    await pool.end();
  });

  it('should create a song', async () => {
    const song = await songRepo.create(testSong);

    expect(song.id).toBe(testSong.id);
    expect(song.title).toBe('Test Song');
    expect(song.artist).toBe('Test Artist');
    expect(song.difficultyDrums).toBe(3);
  });

  it('should find song by id', async () => {
    await songRepo.create(testSong);

    const song = await songRepo.findById(testSong.id);
    expect(song).not.toBeNull();
    expect(song?.title).toBe('Test Song');
  });

  it('should find song by slug', async () => {
    await songRepo.create(testSong);

    const song = await songRepo.findBySlug('test-song-artist');
    expect(song).not.toBeNull();
    expect(song?.title).toBe('Test Song');
  });

  it('should return null for non-existent song', async () => {
    const song = await songRepo.findById(999999);
    expect(song).toBeNull();
  });

  it('should search songs by title', async () => {
    await songRepo.create(testSong);

    const songs = await songRepo.search({ query: 'Test' });
    expect(songs.length).toBeGreaterThan(0);
    expect(songs.some(s => s.id === testSong.id)).toBe(true);
  });

  it('should search songs by artist', async () => {
    await songRepo.create(testSong);

    const songs = await songRepo.search({ query: 'Test Artist' });
    expect(songs.length).toBeGreaterThan(0);
    expect(songs.some(s => s.id === testSong.id)).toBe(true);
  });

  it('should filter songs by difficulty', async () => {
    await songRepo.create(testSong);

    const songs = await songRepo.search({ minDifficulty: 3, maxDifficulty: 5, instrument: 'drums', limit: 5000 });
    expect(songs.some(s => s.id === testSong.id)).toBe(true);

    const noSongs = await songRepo.search({ minDifficulty: 6, maxDifficulty: 7, instrument: 'drums', limit: 5000 });
    expect(noSongs.some(s => s.id === testSong.id)).toBe(false);
  });

  it('should batch fetch songs by IDs', async () => {
    const song1 = await songRepo.create({
      id: 99997,
      slug: 'batch-test-1',
      title: 'Batch Test 1',
      artist: 'Test Artist',
    });

    const song2 = await songRepo.create({
      id: 99998,
      slug: 'batch-test-2',
      title: 'Batch Test 2',
      artist: 'Test Artist',
    });

    const songMap = await songRepo.findByIds([99997, 99998, testSong.id]);

    expect(songMap.size).toBe(2); // testSong.id not created yet
    expect(songMap.get(99997)?.title).toBe('Batch Test 1');
    expect(songMap.get(99998)?.title).toBe('Batch Test 2');

    // Cleanup
    await pool.query('DELETE FROM songs WHERE id IN ($1, $2)', [99997, 99998]);
  });

  it('should handle empty array in batch fetch', async () => {
    const songMap = await songRepo.findByIds([]);
    expect(songMap.size).toBe(0);
  });
});
