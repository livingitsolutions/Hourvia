import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as schema from '../db/schema.js';
import health from '../netlify/functions/health.mjs';
import { workspaceInput } from '../src/infrastructure/validation/workspace-input.js';
import { SystemClock } from '../src/infrastructure/runtime/system-clock.js';
import { UuidGenerator } from '../src/infrastructure/runtime/uuid-generator.js';
import { entityId } from '../src/domain/shared/identifiers.js';
import { utcInstant } from '../src/domain/shared/time.js';
import { pageFromHash, pages } from '../src/presentation/navigation.js';

describe('foundation adapters', () => {
  it('generates valid UUIDs and UTC instants without persistence', () => {
    expect(entityId(new UuidGenerator().generate('user'), 'user').ok).toBe(true);
    expect(utcInstant(new SystemClock().now()).ok).toBe(true);
  });
  it('validates workspace inputs without accepting client identity or role', () => {
    const input = { name: ' Hourvia ', type: 'BUSINESS', timezone: 'America/New_York' };
    expect(workspaceInput.parse(input).name).toBe('Hourvia');
    expect(workspaceInput.safeParse({ ...input, name: '😀'.repeat(120) }).success).toBe(true);
    expect(workspaceInput.safeParse({ ...input, name: '😀'.repeat(121) }).success).toBe(false);
    for (const field of ['userId', 'ownerId', 'role', 'workspaceId']) {
      expect(workspaceInput.safeParse({ ...input, [field]: 'untrusted' }).success).toBe(false);
    }
  });
  it('exposes all seven placeholder routes and a safe fallback', () => {
    expect(pages).toHaveLength(7);
    for (const page of pages) expect(pageFromHash(`#/${page.id}`)).toBe(page.id);
    expect(pageFromHash('#/unknown')).toBe('dashboard');
    expect(pageFromHash('')).toBe('dashboard');
  });
  it('reports only static foundation status without opening a database', async () => {
    const response = await health(new Request('https://example.test/api/health'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ service: 'hourvia', stage: 'sprint-0', authentication: 'disabled', persistence: 'not-connected' });
  });
  it('handles HEAD and rejects unsupported methods', async () => {
    expect(await (await health(new Request('https://example.test', { method: 'HEAD' }))).text()).toBe('');
    const response = await health(new Request('https://example.test', { method: 'POST' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('proposed schema metadata, not a live database', () => {
  const tenantTables = [schema.memberships, schema.clients, schema.projects, schema.activeTimers, schema.timeEntries, schema.adjustments, schema.timesheets, schema.timesheetEntries, schema.timesheetSubmissions, schema.timesheetSubmissionEntries, schema.approvals, schema.auditEvents];
  it.each(tenantTables.map((table) => [getTableConfig(table).name, table] as const))('requires workspace_id on %s', (_name, table) => {
    const column = getTableConfig(table).columns.find((item) => item.name === 'workspace_id');
    expect(column?.notNull).toBe(true);
  });
  it('defines a lifetime personal-workspace uniqueness index', () => {
    const index = getTableConfig(schema.workspaces).indexes.find((item) => item.config.name === 'one_personal_workspace_per_user');
    expect(index?.config.unique).toBe(true);
    expect(index?.config.where).toBeDefined();
  });
  it('defines concurrent timer exclusion as a composite primary key', () => {
    const primary = getTableConfig(schema.activeTimers).primaryKeys[0];
    expect(primary?.columns.map((column) => column.name)).toEqual(['workspace_id', 'user_id']);
  });
  it('defines tenant-safe project and entry relationships', () => {
    const keys = getTableConfig(schema.timeEntries).foreignKeys.map((key) => key.reference());
    expect(keys.some((key) => key.columns.map((column) => column.name).join(',') === 'workspace_id,project_id')).toBe(true);
    expect(keys.some((key) => key.columns.map((column) => column.name).join(',') === 'workspace_id,user_id')).toBe(true);
  });
  it('retains separate immutable submission-version keys for historical snapshots', () => {
    const primary = getTableConfig(schema.timesheetSubmissionEntries).primaryKeys[0];
    expect(primary?.columns.map((column) => column.name)).toEqual(['workspace_id', 'timesheet_id', 'submission_version', 'time_entry_id']);
  });
});

describe('architecture dependency direction', () => {
  function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(path) && !path.endsWith('.test.ts') ? [path] : [];
    });
  }
  it.each(['domain', 'application'])('keeps %s independent of framework and adapters', (layer) => {
    for (const path of sourceFiles(`src/${layer}`)) {
      const source = readFileSync(path, 'utf8');
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)];
      for (const [, specifier] of imports) {
        expect(specifier, path).toMatch(/^\./);
        const target = resolve(path, '..', specifier!);
        expect(target, path).not.toMatch(/\/(infrastructure|presentation|db)\//);
        if (layer === 'domain') expect(target, path).not.toMatch(/\/application\//);
      }
    }
  });
  it('keeps server-only adapters out of the browser import graph', () => {
    for (const path of sourceFiles('src/presentation')) {
      const source = readFileSync(path, 'utf8');
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)];
      for (const [, specifier] of imports) {
        if (specifier?.startsWith('.')) {
          expect(resolve(path, '..', specifier), path).toContain('/src/presentation/');
        } else {
          expect(specifier, path).toMatch(/^react(?:-dom)?(?:\/|$)/);
        }
      }
    }
  });
});
