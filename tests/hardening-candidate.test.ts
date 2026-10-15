import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offline migration baseline and quarantine', () => {
  it('preserves the recorded applied SQL and snapshot fingerprints', () => {
    for (const [file, fingerprint] of Object.entries({
      'migration.sql': 'e0d7439b120175b4cff1fd890af2ba9ccb8e3ec6030d4f5ca992ff9c43f96e8e',
      'snapshot.json': '0aee1b8a6b37ec228074537c6b2442836095722b909f282034991b10bb31e12c',
    })) {
      expect(createHash('sha256').update(readFileSync(`netlify/database/migrations/20261014193353_wise_hawkeye/${file}`)).digest('hex')).toBe(fingerprint);
    }
  });
  it('leaves only the applied baseline in the automatic migration directory', () => {
    expect(readdirSync('netlify/database/migrations')).toEqual(['20261014193353_wise_hawkeye']);
  });
});
