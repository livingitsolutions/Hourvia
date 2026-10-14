import type { UserId, WorkspaceId } from '../shared/identifiers.js';
import { domainFailure, success } from '../shared/result.js';
import type { Result } from '../shared/result.js';
import type { IanaTimezone, UtcInstant } from '../shared/time.js';

export type WorkspaceType = 'PERSONAL' | 'BUSINESS';
export type Workspace = Readonly<{
  id: WorkspaceId;
  type: WorkspaceType;
  ownerId: UserId;
  name: string;
  timezone: IanaTimezone;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
  archivedAt: UtcInstant | null;
}>;

export type CreateWorkspace = Readonly<{
  id: WorkspaceId;
  type: WorkspaceType;
  ownerId: UserId;
  name: string;
  timezone: IanaTimezone;
  now: UtcInstant;
}>;

export function createWorkspace(input: CreateWorkspace): Result<Workspace> {
  const name = input.name.trim();
  if (!name || [...name].length > 120) {
    return domainFailure('INVALID_NAME', 'Workspace names must contain 1–120 characters.');
  }
  if (input.type !== 'PERSONAL' && input.type !== 'BUSINESS') {
    return domainFailure('INVALID_WORKSPACE', 'Workspace type must be PERSONAL or BUSINESS.');
  }
  return success(Object.freeze({
    id: input.id,
    type: input.type,
    ownerId: input.ownerId,
    name,
    timezone: input.timezone,
    createdAt: input.now,
    updatedAt: input.now,
    archivedAt: null,
  }));
}

export function renameWorkspace(workspace: Workspace, name: string, now: UtcInstant): Result<Workspace> {
  if (workspace.archivedAt || now < workspace.updatedAt) {
    return domainFailure('INVALID_TRANSITION', 'Archived workspaces or backwards timestamps cannot be updated.');
  }
  const normalized = name.trim();
  if (!normalized || [...normalized].length > 120) {
    return domainFailure('INVALID_NAME', 'Workspace names must contain 1–120 characters.');
  }
  return success(Object.freeze({ ...workspace, name: normalized, updatedAt: now }));
}

export function archiveWorkspace(workspace: Workspace, now: UtcInstant): Result<Workspace> {
  if (workspace.archivedAt || now < workspace.updatedAt) {
    return domainFailure('INVALID_TRANSITION', 'A workspace can be archived once with a nondecreasing timestamp.');
  }
  return success(Object.freeze({ ...workspace, archivedAt: now, updatedAt: now }));
}
