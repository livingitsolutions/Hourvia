import { domainFailure, success } from './result.js';
import type { Result } from './result.js';

export type EntityKind =
  | 'user'
  | 'workspace'
  | 'membership'
  | 'timeEntry'
  | 'adjustment'
  | 'timesheet'
  | 'project'
  | 'client'
  | 'approval'
  | 'auditEvent';

declare const entityIdBrand: unique symbol;
export type EntityId<Kind extends EntityKind> = string & { readonly [entityIdBrand]: Kind };
export type UserId = EntityId<'user'>;
export type WorkspaceId = EntityId<'workspace'>;
export type MembershipId = EntityId<'membership'>;

export function entityId<Kind extends EntityKind>(value: string, _kind: Kind): Result<EntityId<Kind>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return domainFailure('INVALID_ID', 'Entity identifiers must be UUIDs.');
  }
  return success(value.toLowerCase() as EntityId<Kind>);
}

export interface IdGenerator {
  generate<Kind extends EntityKind>(kind: Kind): EntityId<Kind>;
}
