import { describe, expect, it } from 'vitest';
import { entityId } from './identifiers.js';
import { failure, success } from './result.js';
import { durationSeconds, ianaTimezone, utcInstant } from './time.js';

describe('shared contracts', () => {
  it('normalizes valid UUIDs', () => {
    expect(entityId('A0000000-0000-4000-8000-000000000001', 'user')).toEqual(success('a0000000-0000-4000-8000-000000000001'));
  });
  it.each(['', 'user-1', '00000000-0000-0000-0000-000000000000'])('rejects invalid UUID %s', (value) => {
    expect(entityId(value, 'workspace').ok).toBe(false);
  });
  it('preserves discriminated, frozen results and errors', () => {
    const result = failure({ code: 'INVALID_ID', message: 'Invalid' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.error)).toBe(true);
    expect(success(42)).toEqual({ ok: true, value: 42 });
  });
  it('accepts a canonical UTC instant, including leap day', () => {
    expect(utcInstant('2024-02-29T23:59:59.123Z').ok).toBe(true);
  });
  it.each(['2026-02-30T12:00:00.000Z', '2026-02-29T12:00:00.000Z', '2026-10-14T12:00:00+00:00', '2026-10-14', '2026-10-14T12:00:00Z', '2026-10-14T25:00:00.000Z'])('rejects invalid or noncanonical timestamp %s', (value) => {
    expect(utcInstant(value).ok).toBe(false);
  });
  it.each(['UTC', 'Etc/UTC', 'America/New_York', 'Asia/Kolkata'])('preserves reporting timezone %s', (value) => {
    expect(ianaTimezone(value)).toEqual(success(value));
  });
  it.each(['Not/AZone', '', '+05:30', 'EST'])('rejects ambiguous timezone %s', (value) => {
    expect(ianaTimezone(value).ok).toBe(false);
  });
  it.each([0, 1, 3600, 2_147_483_647])('accepts canonical duration %i seconds', (value) => {
    expect(durationSeconds(value)).toEqual(success(value));
  });
  it.each([-1, 1.1, NaN, Infinity, 2_147_483_648])('rejects invalid duration %s', (value) => {
    expect(durationSeconds(value).ok).toBe(false);
  });
});
