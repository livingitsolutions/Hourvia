import { describe, expect, it } from 'vitest';
import { changeMembershipStatus, createMembership } from './membership.js';
import type { MembershipRole, MembershipStatus } from './membership.js';
import { archiveWorkspace } from './workspace.js';
import { earlier, later, makeWorkspace, memberId, membershipId, now, ownerId, unwrap, workspaceId } from '../../../tests/fixtures.js';

describe('Membership', () => {
  it('creates the personal workspace owner membership', () => {
    const membership = unwrap(createMembership({ id: membershipId, workspace: makeWorkspace('PERSONAL'), userId: ownerId, role: 'OWNER', now }));
    expect(membership).toMatchObject({ workspaceId, userId: ownerId, role: 'OWNER', status: 'ACTIVE' });
    expect(Object.isFrozen(membership)).toBe(true);
  });
  it.each(['ADMIN', 'MEMBER', 'VIEWER'] as const)('permits a business %s membership', (role) => {
    expect(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role, now }).ok).toBe(true);
  });
  it.each(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const)('rejects other users in a personal workspace as %s', (role) => {
    expect(createMembership({ id: membershipId, workspace: makeWorkspace('PERSONAL'), userId: memberId, role, now }).ok).toBe(false);
  });
  it('rejects mismatched owner identities and roles', () => {
    expect(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role: 'OWNER', now }).ok).toBe(false);
    expect(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: ownerId, role: 'ADMIN', now }).ok).toBe(false);
  });
  it('rejects runtime-invalid roles and creation before the workspace', () => {
    expect(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role: 'ROOT' as MembershipRole, now }).ok).toBe(false);
    expect(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role: 'MEMBER', now: earlier }).ok).toBe(false);
  });
  it('rejects membership creation in archived workspaces', () => {
    const archived = unwrap(archiveWorkspace(makeWorkspace(), later));
    expect(createMembership({ id: membershipId, workspace: archived, userId: memberId, role: 'MEMBER', now: later }).ok).toBe(false);
  });
  it('supports immutable suspend, reactivate, and terminal removal', () => {
    const active = unwrap(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role: 'MEMBER', now }));
    const suspended = unwrap(changeMembershipStatus(active, 'SUSPENDED', later));
    expect(active.status).toBe('ACTIVE');
    const reactivated = unwrap(changeMembershipStatus(suspended, 'ACTIVE', later));
    const removed = unwrap(changeMembershipStatus(reactivated, 'REMOVED', later));
    expect(removed.status).toBe('REMOVED');
    expect(changeMembershipStatus(removed, 'ACTIVE', later).ok).toBe(false);
    expect(Object.isFrozen(removed)).toBe(true);
  });
  it('rejects backwards, duplicate, and runtime-invalid transitions', () => {
    const membership = unwrap(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: memberId, role: 'MEMBER', now }));
    expect(changeMembershipStatus(membership, 'SUSPENDED', earlier).ok).toBe(false);
    expect(changeMembershipStatus(membership, 'ACTIVE', later).ok).toBe(false);
    expect(changeMembershipStatus(membership, 'PENDING' as MembershipStatus, later).ok).toBe(false);
  });
  it.each(['SUSPENDED', 'REMOVED'] as const)('protects owner from %s', (status) => {
    const owner = unwrap(createMembership({ id: membershipId, workspace: makeWorkspace(), userId: ownerId, role: 'OWNER', now }));
    expect(changeMembershipStatus(owner, status, later)).toMatchObject({ ok: false, error: { code: 'OWNER_PROTECTED' } });
  });
});
