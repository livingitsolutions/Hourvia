import { describe, expect, it, vi } from 'vitest';
import { MembershipAuthorization } from './authorization.js';
import type { Permission, WorkspaceAccessRepository } from './authorization.js';
import type { AuthenticationProvider } from '../identity/authentication.js';
import { failure, success } from '../../domain/shared/result.js';
import { createMembership } from '../../domain/workspace-membership/membership.js';
import type { Membership, MembershipRole } from '../../domain/workspace-membership/membership.js';
import { DisabledAuthentication } from '../../infrastructure/authentication/disabled-authentication.js';
import { makeWorkspace, memberId, membershipId, now, otherWorkspaceId, ownerId, unwrap, workspaceId } from '../../../tests/fixtures.js';

function setup(role: MembershipRole = 'MEMBER') {
  const workspace = makeWorkspace();
  const userId = role === 'OWNER' ? ownerId : memberId;
  const membership = unwrap(createMembership({ id: membershipId, workspace, userId, role, now }));
  const authentication: AuthenticationProvider = { authenticate: vi.fn(async () => success({ userId })) };
  const repository: WorkspaceAccessRepository = {
    findWorkspace: vi.fn(async () => workspace),
    findMembership: vi.fn(async () => membership),
  };
  return { service: new MembershipAuthorization(authentication, repository), authentication, repository, membership };
}

describe('workspace authorization', () => {
  it('derives identity from the provider and queries server-side membership', async () => {
    const { service, authentication, repository } = setup();
    expect((await service.authorize('test-credential', workspaceId, 'time:write:own')).ok).toBe(true);
    expect(authentication.authenticate).toHaveBeenCalledWith('test-credential');
    expect(repository.findMembership).toHaveBeenCalledWith(workspaceId, memberId);
  });
  it.each([
    ['OWNER', 'workspace:manage', true], ['ADMIN', 'timesheet:approve', true],
    ['MEMBER', 'workspace:manage', false], ['MEMBER', 'reports:read:all', false],
    ['MEMBER', 'timesheet:submit:own', true], ['VIEWER', 'time:write:own', false],
    ['VIEWER', 'workspace:read', true],
  ] as const)('checks permission %s / %s', async (role, permission, allowed) => {
    expect((await setup(role).service.authorize(null, workspaceId, permission)).ok).toBe(allowed);
  });
  it('does not query memberships when unauthenticated', async () => {
    const { service, authentication, repository } = setup();
    vi.mocked(authentication.authenticate).mockResolvedValue(failure({ code: 'UNAUTHENTICATED', message: 'Not authenticated.' }));
    expect(await service.authorize(null, workspaceId, 'workspace:read')).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });
  it('fails closed for disabled authentication', async () => {
    const { repository } = setup();
    const service = new MembershipAuthorization(new DisabledAuthentication(), repository);
    expect(await service.authorize('client-claims-owner', workspaceId, 'workspace:manage')).toMatchObject({ ok: false, error: { code: 'AUTHENTICATION_UNAVAILABLE' } });
  });
  it.each(['SUSPENDED', 'REMOVED'] as const)('rejects a %s membership', async (status) => {
    const { service, repository, membership } = setup();
    vi.mocked(repository.findMembership).mockResolvedValue({ ...membership, status });
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
  });
  it('rejects missing memberships and workspaces', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findMembership).mockResolvedValue(null);
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
    vi.mocked(repository.findWorkspace).mockResolvedValue(null);
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
  });
  it.each([{ workspaceId: otherWorkspaceId }, { userId: ownerId }, { role: 'ROOT' as MembershipRole }])('rejects inconsistent repository membership %j', async (override) => {
    const { service, repository, membership } = setup();
    vi.mocked(repository.findMembership).mockResolvedValue({ ...membership, ...override } as Membership);
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
  });
  it('rejects archived or incorrectly scoped workspaces', async () => {
    const { service, repository } = setup();
    vi.mocked(repository.findWorkspace).mockResolvedValue({ ...makeWorkspace(), archivedAt: now });
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
    vi.mocked(repository.findWorkspace).mockResolvedValue({ ...makeWorkspace(), id: otherWorkspaceId });
    expect((await service.authorize(null, workspaceId, 'workspace:read')).ok).toBe(false);
  });
  it('rejects malformed permission claims', async () => {
    expect((await setup().service.authorize(null, workspaceId, 'ROOT' as Permission)).ok).toBe(false);
  });
  it('fails closed without leaking provider or repository errors', async () => {
    const { service, repository, authentication } = setup();
    vi.mocked(repository.findWorkspace).mockRejectedValue(new Error('internal connection detail'));
    expect(await service.authorize(null, workspaceId, 'workspace:read')).toEqual(failure({ code: 'AUTHORIZATION_UNAVAILABLE', message: 'Workspace authorization is unavailable.' }));
    vi.mocked(authentication.authenticate).mockRejectedValue(new Error('provider internal detail'));
    expect(await service.authorize(null, workspaceId, 'workspace:read')).toMatchObject({ ok: false, error: { code: 'AUTHORIZATION_UNAVAILABLE' } });
  });
});
