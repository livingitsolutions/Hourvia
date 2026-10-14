import type { MembershipId, UserId, WorkspaceId } from '../shared/identifiers.js';
import { domainFailure, success } from '../shared/result.js';
import type { Result } from '../shared/result.js';
import type { UtcInstant } from '../shared/time.js';
import type { Workspace } from './workspace.js';

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type Membership = Readonly<{
  id: MembershipId;
  workspaceId: WorkspaceId;
  userId: UserId;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}>;

export function createMembership(input: Readonly<{
  id: MembershipId;
  workspace: Workspace;
  userId: UserId;
  role: MembershipRole;
  now: UtcInstant;
}>): Result<Membership> {
  const { workspace, userId, role } = input;
  if (workspace.archivedAt || input.now < workspace.createdAt) {
    return domainFailure('INVALID_MEMBERSHIP', 'Membership requires a live workspace and a valid creation timestamp.');
  }
  if (!['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    return domainFailure('INVALID_MEMBERSHIP', 'Membership role is invalid.');
  }
  if ((role === 'OWNER') !== (userId === workspace.ownerId)) {
    return domainFailure('INVALID_MEMBERSHIP', 'The owner membership must match the workspace owner.');
  }
  if (workspace.type === 'PERSONAL' && (userId !== workspace.ownerId || role !== 'OWNER')) {
    return domainFailure('INVALID_MEMBERSHIP', 'A personal workspace permits only its owner membership.');
  }
  return success(Object.freeze({
    id: input.id,
    workspaceId: workspace.id,
    userId,
    role,
    status: 'ACTIVE',
    createdAt: input.now,
    updatedAt: input.now,
  }));
}

export function changeMembershipStatus(membership: Membership, status: MembershipStatus, now: UtcInstant): Result<Membership> {
  if (membership.role === 'OWNER' && status !== 'ACTIVE') {
    return domainFailure('OWNER_PROTECTED', 'Owner suspension or removal requires a separate atomic ownership-transfer policy.');
  }
  if (!['ACTIVE', 'SUSPENDED', 'REMOVED'].includes(status) || membership.status === 'REMOVED' || status === membership.status || now < membership.updatedAt) {
    return domainFailure('INVALID_TRANSITION', 'Membership transition is invalid or uses a backwards timestamp.');
  }
  return success(Object.freeze({ ...membership, status, updatedAt: now }));
}
