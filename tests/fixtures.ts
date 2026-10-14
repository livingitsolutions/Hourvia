import { entityId } from '../src/domain/shared/identifiers.js';
import type { Result } from '../src/domain/shared/result.js';
import { ianaTimezone, utcInstant } from '../src/domain/shared/time.js';
import { createWorkspace } from '../src/domain/workspace-membership/workspace.js';
import type { WorkspaceType } from '../src/domain/workspace-membership/workspace.js';

export function unwrap<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) throw new Error('Expected a successful fixture.');
  return result.value;
}

export const ownerId = unwrap(entityId('10000000-0000-4000-8000-000000000001', 'user'));
export const memberId = unwrap(entityId('10000000-0000-4000-8000-000000000002', 'user'));
export const workspaceId = unwrap(entityId('20000000-0000-4000-8000-000000000001', 'workspace'));
export const otherWorkspaceId = unwrap(entityId('20000000-0000-4000-8000-000000000002', 'workspace'));
export const membershipId = unwrap(entityId('30000000-0000-4000-8000-000000000001', 'membership'));
export const now = unwrap(utcInstant('2026-10-14T12:00:00.000Z'));
export const later = unwrap(utcInstant('2026-10-14T13:00:00.000Z'));
export const earlier = unwrap(utcInstant('2026-10-14T11:00:00.000Z'));
export const timezone = unwrap(ianaTimezone('America/New_York'));

export function makeWorkspace(type: WorkspaceType = 'BUSINESS') {
  return unwrap(createWorkspace({ id: workspaceId, ownerId, name: 'Living IT Solutions', type, timezone, now }));
}
