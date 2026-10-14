import type { Clock, UtcInstant } from '../../domain/shared/time.js';

export class SystemClock implements Clock {
  now(): UtcInstant {
    return new Date().toISOString() as UtcInstant;
  }
}
