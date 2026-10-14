import { domainFailure, success } from './result.js';
import type { Result } from './result.js';

declare const utcBrand: unique symbol;
declare const timezoneBrand: unique symbol;
declare const secondsBrand: unique symbol;

export type UtcInstant = string & { readonly [utcBrand]: true };
export type IanaTimezone = string & { readonly [timezoneBrand]: true };
export type DurationSeconds = number & { readonly [secondsBrand]: true };

export interface Clock {
  now(): UtcInstant;
}

export function utcInstant(value: string): Result<UtcInstant> {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return domainFailure('INVALID_TIMESTAMP', 'Use a canonical UTC ISO instant with millisecond precision.');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return domainFailure('INVALID_TIMESTAMP', 'The UTC instant must be a valid calendar date.');
  }
  return success(value as UtcInstant);
}

export function ianaTimezone(value: string): Result<IanaTimezone> {
  if (value !== 'UTC' && !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) {
    return domainFailure('INVALID_TIMEZONE', 'Use an IANA timezone identifier.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return success(value as IanaTimezone);
  } catch {
    return domainFailure('INVALID_TIMEZONE', 'The IANA timezone is not recognized.');
  }
}

export function durationSeconds(value: number): Result<DurationSeconds> {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    return domainFailure('INVALID_DURATION', 'Duration must be nonnegative integer seconds within PostgreSQL integer range.');
  }
  return success(value as DurationSeconds);
}
