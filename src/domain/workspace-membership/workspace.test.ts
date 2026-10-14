import { describe, expect, it } from 'vitest';
import { archiveWorkspace, createWorkspace, renameWorkspace } from './workspace.js';
import type { WorkspaceType } from './workspace.js';
import { earlier, later, makeWorkspace, now, ownerId, timezone, unwrap, workspaceId } from '../../../tests/fixtures.js';

describe('Workspace', () => {
  it.each(['PERSONAL', 'BUSINESS'] as const)('creates a %s workspace with global owner and UTC metadata', (type) => {
    const workspace = makeWorkspace(type);
    expect(workspace).toMatchObject({ id: workspaceId, ownerId, timezone, type, createdAt: now, updatedAt: now, archivedAt: null });
    expect(Object.isFrozen(workspace)).toBe(true);
  });
  it('normalizes the workspace name', () => {
    const result = createWorkspace({ id: workspaceId, ownerId, timezone, type: 'BUSINESS', name: '  Hourvia  ', now });
    expect(unwrap(result).name).toBe('Hourvia');
  });
  it.each(['', '   ', 'x'.repeat(121)])('rejects an invalid name', (name) => {
    expect(createWorkspace({ id: workspaceId, ownerId, timezone, type: 'PERSONAL', name, now })).toMatchObject({ ok: false, error: { code: 'INVALID_NAME' } });
  });
  it.each(['x'.repeat(120), '😀'.repeat(120)])('counts Unicode code points consistently with PostgreSQL character length', (name) => {
    expect(createWorkspace({ id: workspaceId, ownerId, timezone, type: 'BUSINESS', name, now }).ok).toBe(true);
    expect(renameWorkspace(makeWorkspace(), name, later).ok).toBe(true);
  });
  it('rejects runtime-invalid workspace type', () => {
    expect(createWorkspace({ id: workspaceId, ownerId, timezone, type: 'TEAM' as WorkspaceType, name: 'Valid', now }).ok).toBe(false);
  });
  it('renames without mutating the original', () => {
    const original = makeWorkspace();
    const renamed = unwrap(renameWorkspace(original, '  New name  ', later));
    expect(renamed).toMatchObject({ name: 'New name', updatedAt: later, createdAt: now });
    expect(original.name).toBe('Living IT Solutions');
    expect(Object.isFrozen(renamed)).toBe(true);
  });
  it('rejects backwards update timestamps', () => {
    expect(renameWorkspace(makeWorkspace(), 'New name', earlier).ok).toBe(false);
    expect(archiveWorkspace(makeWorkspace(), earlier).ok).toBe(false);
  });
  it('archives without deleting history and forbids further mutation', () => {
    const original = makeWorkspace();
    const archived = unwrap(archiveWorkspace(original, later));
    expect(archived.archivedAt).toBe(later);
    expect(original.archivedAt).toBeNull();
    expect(archiveWorkspace(archived, later).ok).toBe(false);
    expect(renameWorkspace(archived, 'New name', later).ok).toBe(false);
  });
});
