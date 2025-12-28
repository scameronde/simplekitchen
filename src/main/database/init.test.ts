import { describe, it, expect, afterAll } from 'vitest';
import { rawDb, closeDatabase } from './init';

afterAll(() => {
  closeDatabase();
});

describe('Database Durability Configuration', () => {
  it('should have WAL journal mode enabled (or memory for in-memory DB)', () => {
    const result = rawDb.pragma('journal_mode', true) as string;
    // In-memory databases use 'memory' journal mode, file-based use 'wal'
    expect(['wal', 'memory']).toContain(result.toLowerCase());
  });

  it('should have FULL synchronous mode enabled', () => {
    const result = rawDb.pragma('synchronous', true) as number;
    // FULL = 2, NORMAL = 1, OFF = 0
    expect(result).toBe(2);
  });

  it('should have reasonable cache size', () => {
    const result = rawDb.pragma('cache_size', true) as number;
    expect(Math.abs(result)).toBeGreaterThan(1000); // At least some caching
  });

  it('should use memory for temp storage', () => {
    const result = rawDb.pragma('temp_store', true) as number;
    // MEMORY = 2, FILE = 1, DEFAULT = 0
    expect(result).toBe(2);
  });
});
