import type { WorkspaceId, UserId } from '../../domain/shared/identifiers.js';
import { failure, success } from '../../domain/shared/result.js';
import type { Result } from '../../domain/shared/result.js';
import type { Membership, MembershipRole } from '../../domain/workspace-membership/membership.js';
import type { Workspace } from '../../domain/workspace-membership/workspace.js';
import type { AuthenticationError, AuthenticationProvider } from '../identity/authentication.js';

export type Permission = 'workspace:read' | 'workspace:manage' | 'time:write:own' | 'timesheet:submit:own' | 'timesheet:approve' | 'reports:read:all';
export type AuthorizationError = Readonly<{
  code: 'FORBIDDEN' | 'AUTHORIZATION_UNAVAILABLE';
  message: string;
}>;
export type AuthorizedWorkspace = Readonly<{ workspace: Workspace; membership: Membership }>;

export interface WorkspaceAccessRepository {
  findWorkspace(workspaceId: WorkspaceId): Promise<Workspace | null>;
  findMembership(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | null>;
}

export interface WorkspaceAuthorization {
  authorize(credential: string | null, workspaceId: WorkspaceId, permission: Permission): Promise<Result<AuthorizedWorkspace, AuthenticationError | AuthorizationError>>;
}

const permissions: Readonly<Record<MembershipRole, readonly Permission[]>> = Object.freeze({
  OWNER: ['workspace:read', 'workspace:manage', 'time:write:own', 'timesheet:submit:own', 'timesheet:approve', 'reports:read:all'],
  ADMIN: ['workspace:read', 'workspace:manage', 'time:write:own', 'timesheet:submit:own', 'timesheet:approve', 'reports:read:all'],
  MEMBER: ['workspace:read', 'time:write:own', 'timesheet:submit:own'],
  VIEWER: ['workspace:read'],
});

export class MembershipAuthorization implements WorkspaceAuthorization {
  constructor(
    private readonly authentication: AuthenticationProvider,
    private readonly repository: WorkspaceAccessRepository,
  ) {}

  async authorize(credential: string | null, workspaceId: WorkspaceId, permission: Permission): Promise<Result<AuthorizedWorkspace, AuthenticationError | AuthorizationError>> {
    try {
      const principal = await this.authentication.authenticate(credential);
      if (!principal.ok) return principal;
      const workspace = await this.repository.findWorkspace(workspaceId);
      const membership = await this.repository.findMembership(workspaceId, principal.value.userId);
      if (!workspace || workspace.id !== workspaceId || workspace.archivedAt || !membership ||
          membership.workspaceId !== workspaceId || membership.userId !== principal.value.userId ||
          membership.status !== 'ACTIVE' || !permissions[membership.role]?.includes(permission) ||
          ((membership.role === 'OWNER') !== (membership.userId === workspace.ownerId)) ||
          (workspace.type === 'PERSONAL' && membership.role !== 'OWNER')) {
        return failure({ code: 'FORBIDDEN', message: 'Workspace access is not permitted.' });
      }
      return success(Object.freeze({ workspace, membership }));
    } catch {
      return failure({ code: 'AUTHORIZATION_UNAVAILABLE', message: 'Workspace authorization is unavailable.' });
    }
  }
}
