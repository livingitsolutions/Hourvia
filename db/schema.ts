import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, uuid, text, timestamp, date, integer, bigint, boolean, jsonb, unique, uniqueIndex, index, check, foreignKey, primaryKey } from 'drizzle-orm/pg-core';

export const workspaceType = pgEnum('workspace_type', ['PERSONAL', 'BUSINESS']);
export const membershipRole = pgEnum('membership_role', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const membershipStatus = pgEnum('membership_status', ['ACTIVE', 'SUSPENDED', 'REMOVED']);
export const timesheetStatus = pgEnum('timesheet_status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
export const approvalDecision = pgEnum('approval_decision', ['APPROVE', 'REJECT', 'REOPEN']);

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string', precision: 3 });

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: instant('created_at').notNull(),
});

export const externalIdentities = pgTable('external_identities', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  issuer: text('issuer').notNull(),
  subject: text('subject').notNull(),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  unique('external_identity_issuer_subject_unique').on(table.issuer, table.subject),
  index('external_identity_user_idx').on(table.userId),
]);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  type: workspaceType('type').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
  archivedAt: instant('archived_at'),
}, (table) => [
  uniqueIndex('one_personal_workspace_per_user').on(table.ownerId).where(sql`${table.type} = 'PERSONAL'`),
  index('workspace_owner_idx').on(table.ownerId),
  check('workspace_name_valid', sql`char_length(btrim(${table.name})) BETWEEN 1 AND 120`),
  check('workspace_timestamps_ordered', sql`${table.updatedAt} >= ${table.createdAt} AND (${table.archivedAt} IS NULL OR ${table.archivedAt} >= ${table.createdAt})`),
]);

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: membershipRole('role').notNull(),
  status: membershipStatus('status').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
}, (table) => [
  unique('membership_workspace_user_unique').on(table.workspaceId, table.userId),
  unique('membership_workspace_id_unique').on(table.workspaceId, table.id),
  uniqueIndex('one_owner_membership_per_workspace').on(table.workspaceId).where(sql`${table.role} = 'OWNER'`),
  index('membership_user_status_idx').on(table.userId, table.status),
  check('membership_owner_active', sql`${table.role} <> 'OWNER' OR ${table.status} = 'ACTIVE'`),
  check('membership_timestamps_ordered', sql`${table.updatedAt} >= ${table.createdAt}`),
]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  archivedAt: instant('archived_at'),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  unique('client_workspace_id_unique').on(table.workspaceId, table.id),
  index('client_workspace_name_idx').on(table.workspaceId, table.name),
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  clientId: uuid('client_id'),
  name: text('name').notNull(),
  billable: boolean('billable').notNull().default(false),
  archivedAt: instant('archived_at'),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  unique('project_workspace_id_unique').on(table.workspaceId, table.id),
  foreignKey({ name: 'project_client_same_workspace', columns: [table.workspaceId, table.clientId], foreignColumns: [clients.workspaceId, clients.id] }),
  index('project_workspace_client_idx').on(table.workspaceId, table.clientId),
]);

export const activeTimers = pgTable('active_timers', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id'),
  startedAt: instant('started_at').notNull(),
  description: text('description').notNull().default(''),
  idempotencyKey: uuid('idempotency_key').notNull(),
}, (table) => [
  primaryKey({ name: 'one_active_timer_per_workspace_user', columns: [table.workspaceId, table.userId] }),
  foreignKey({ name: 'timer_member_same_workspace', columns: [table.workspaceId, table.userId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  foreignKey({ name: 'timer_project_same_workspace', columns: [table.workspaceId, table.projectId], foreignColumns: [projects.workspaceId, projects.id] }),
  unique('timer_idempotency_unique').on(table.workspaceId, table.userId, table.idempotencyKey),
]);

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id'),
  startedAt: instant('started_at').notNull(),
  endedAt: instant('ended_at').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  timezone: text('timezone').notNull(),
  description: text('description').notNull().default(''),
  billable: boolean('billable').notNull().default(false),
  idempotencyKey: uuid('idempotency_key').notNull(),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  unique('entry_workspace_id_unique').on(table.workspaceId, table.id),
  unique('entry_idempotency_unique').on(table.workspaceId, table.userId, table.idempotencyKey),
  foreignKey({ name: 'entry_member_same_workspace', columns: [table.workspaceId, table.userId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  foreignKey({ name: 'entry_project_same_workspace', columns: [table.workspaceId, table.projectId], foreignColumns: [projects.workspaceId, projects.id] }),
  check('entry_duration_valid', sql`${table.endedAt} >= ${table.startedAt} AND ${table.durationSeconds} = floor(extract(epoch FROM (${table.endedAt} - ${table.startedAt}))) AND ${table.durationSeconds} >= 0`),
  index('entry_workspace_user_start_idx').on(table.workspaceId, table.userId, table.startedAt),
  index('entry_workspace_project_start_idx').on(table.workspaceId, table.projectId, table.startedAt),
]);

export const adjustments = pgTable('adjustments', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  timeEntryId: uuid('time_entry_id').notNull(),
  revision: integer('revision').notNull(),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  replacementStartedAt: instant('replacement_started_at').notNull(),
  replacementEndedAt: instant('replacement_ended_at').notNull(),
  replacementDurationSeconds: integer('replacement_duration_seconds').notNull(),
  replacementProjectId: uuid('replacement_project_id'),
  replacementDescription: text('replacement_description').notNull(),
  replacementBillable: boolean('replacement_billable').notNull(),
  voided: boolean('voided').notNull().default(false),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  unique('adjustment_workspace_id_unique').on(table.workspaceId, table.id),
  unique('adjustment_entry_revision_unique').on(table.workspaceId, table.timeEntryId, table.revision),
  foreignKey({ name: 'adjustment_entry_same_workspace', columns: [table.workspaceId, table.timeEntryId], foreignColumns: [timeEntries.workspaceId, timeEntries.id] }),
  foreignKey({ name: 'adjustment_actor_same_workspace', columns: [table.workspaceId, table.requestedBy], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  foreignKey({ name: 'adjustment_project_same_workspace', columns: [table.workspaceId, table.replacementProjectId], foreignColumns: [projects.workspaceId, projects.id] }),
  check('adjustment_revision_positive', sql`${table.revision} > 0`),
  check('adjustment_reason_required', sql`char_length(btrim(${table.reason})) > 0`),
  check('adjustment_duration_valid', sql`${table.replacementEndedAt} >= ${table.replacementStartedAt} AND ${table.replacementDurationSeconds} = floor(extract(epoch FROM (${table.replacementEndedAt} - ${table.replacementStartedAt}))) AND ${table.replacementDurationSeconds} >= 0`),
]);

export const timesheets = pgTable('timesheets', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  timezone: text('timezone').notNull(),
  status: timesheetStatus('status').notNull().default('DRAFT'),
  version: integer('version').notNull().default(1),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
}, (table) => [
  unique('timesheet_workspace_id_unique').on(table.workspaceId, table.id),
  unique('timesheet_user_period_unique').on(table.workspaceId, table.userId, table.periodStart, table.periodEnd),
  foreignKey({ name: 'timesheet_member_same_workspace', columns: [table.workspaceId, table.userId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  check('timesheet_period_valid', sql`${table.periodEnd} > ${table.periodStart} AND ${table.version} > 0 AND ${table.updatedAt} >= ${table.createdAt}`),
  index('timesheet_workspace_status_idx').on(table.workspaceId, table.status, table.periodStart),
]);

export const timesheetEntries = pgTable('timesheet_entries', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  timesheetId: uuid('timesheet_id').notNull(),
  timeEntryId: uuid('time_entry_id').notNull(),
  effectiveRevision: integer('effective_revision').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.timesheetId, table.timeEntryId] }),
  unique('entry_one_timesheet_unique').on(table.workspaceId, table.timeEntryId),
  foreignKey({ name: 'timesheet_item_sheet_same_workspace', columns: [table.workspaceId, table.timesheetId], foreignColumns: [timesheets.workspaceId, timesheets.id] }),
  foreignKey({ name: 'timesheet_item_entry_same_workspace', columns: [table.workspaceId, table.timeEntryId], foreignColumns: [timeEntries.workspaceId, timeEntries.id] }),
  check('timesheet_item_nonnegative', sql`${table.effectiveRevision} >= 0 AND ${table.durationSeconds} >= 0`),
]);

export const timesheetSubmissions = pgTable('timesheet_submissions', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  timesheetId: uuid('timesheet_id').notNull(),
  version: integer('version').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  timezone: text('timezone').notNull(),
  submittedAt: instant('submitted_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.timesheetId, table.version] }),
  foreignKey({ name: 'submission_sheet_same_workspace', columns: [table.workspaceId, table.timesheetId], foreignColumns: [timesheets.workspaceId, timesheets.id] }),
  foreignKey({ name: 'submission_member_same_workspace', columns: [table.workspaceId, table.userId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  check('submission_period_version_valid', sql`${table.version} > 0 AND ${table.periodEnd} > ${table.periodStart}`),
]);

export const timesheetSubmissionEntries = pgTable('timesheet_submission_entries', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  timesheetId: uuid('timesheet_id').notNull(),
  submissionVersion: integer('submission_version').notNull(),
  timeEntryId: uuid('time_entry_id').notNull(),
  effectiveRevision: integer('effective_revision').notNull(),
  startedAt: instant('started_at').notNull(),
  endedAt: instant('ended_at').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  projectId: uuid('project_id'),
  description: text('description').notNull(),
  billable: boolean('billable').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.timesheetId, table.submissionVersion, table.timeEntryId] }),
  foreignKey({ name: 'submission_item_version_same_workspace', columns: [table.workspaceId, table.timesheetId, table.submissionVersion], foreignColumns: [timesheetSubmissions.workspaceId, timesheetSubmissions.timesheetId, timesheetSubmissions.version] }),
  foreignKey({ name: 'submission_item_entry_same_workspace', columns: [table.workspaceId, table.timeEntryId], foreignColumns: [timeEntries.workspaceId, timeEntries.id] }),
  foreignKey({ name: 'submission_item_project_same_workspace', columns: [table.workspaceId, table.projectId], foreignColumns: [projects.workspaceId, projects.id] }),
  check('submission_item_duration_valid', sql`${table.effectiveRevision} >= 0 AND ${table.endedAt} >= ${table.startedAt} AND ${table.durationSeconds} = floor(extract(epoch FROM (${table.endedAt} - ${table.startedAt}))) AND ${table.durationSeconds} >= 0`),
]);

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  timesheetId: uuid('timesheet_id'),
  adjustmentId: uuid('adjustment_id'),
  targetVersion: integer('target_version').notNull(),
  decidedBy: uuid('decided_by').notNull().references(() => users.id),
  decision: approvalDecision('decision').notNull(),
  reason: text('reason').notNull(),
  createdAt: instant('created_at').notNull(),
}, (table) => [
  foreignKey({ name: 'approval_timesheet_same_workspace', columns: [table.workspaceId, table.timesheetId], foreignColumns: [timesheets.workspaceId, timesheets.id] }),
  foreignKey({ name: 'approval_submitted_version_same_workspace', columns: [table.workspaceId, table.timesheetId, table.targetVersion], foreignColumns: [timesheetSubmissions.workspaceId, timesheetSubmissions.timesheetId, timesheetSubmissions.version] }),
  foreignKey({ name: 'approval_adjustment_same_workspace', columns: [table.workspaceId, table.adjustmentId], foreignColumns: [adjustments.workspaceId, adjustments.id] }),
  foreignKey({ name: 'approval_actor_same_workspace', columns: [table.workspaceId, table.decidedBy], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  check('approval_one_target', sql`num_nonnulls(${table.timesheetId}, ${table.adjustmentId}) = 1 AND ${table.targetVersion} > 0`),
  check('approval_adjustment_not_reopened', sql`${table.adjustmentId} IS NULL OR ${table.decision} <> 'REOPEN'`),
  uniqueIndex('adjustment_one_decision').on(table.workspaceId, table.adjustmentId).where(sql`${table.adjustmentId} IS NOT NULL`),
  uniqueIndex('timesheet_one_terminal_decision_per_version').on(table.workspaceId, table.timesheetId, table.targetVersion).where(sql`${table.timesheetId} IS NOT NULL AND ${table.decision} <> 'REOPEN'`),
  index('approval_workspace_timesheet_idx').on(table.workspaceId, table.timesheetId, table.createdAt),
]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  requestId: uuid('request_id').notNull(),
  occurredAt: instant('occurred_at').notNull(),
  metadata: jsonb('metadata').$type<Readonly<Record<string, unknown>>>().notNull(),
}, (table) => [
  unique('audit_workspace_id_unique').on(table.workspaceId, table.id),
  // Deferred actor FK is tracked by the Sprint 0.3A SQL candidate.
  index('audit_workspace_occurred_idx').on(table.workspaceId, table.occurredAt),
  index('audit_workspace_entity_idx').on(table.workspaceId, table.entityType, table.entityId, table.occurredAt),
]);

// Sprint 0.3A candidate metadata only. These tables are unavailable until separately
// reviewed promotion; SQL-only deferred constraints/triggers remain candidate-owned.
export const foundationRequests = pgTable('foundation_requests', {
  actorId: uuid('actor_id').notNull().references(() => users.id),
  scopeId: uuid('scope_id').notNull(),
  operation: text('operation').notNull(),
  requestId: uuid('request_id').notNull(),
  requestHash: text('request_hash').notNull(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  auditId: uuid('audit_id').notNull(),
  committedAt: timestamp('committed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: 'foundation_requests_pkey', columns: [table.actorId, table.scopeId, table.operation, table.requestId] }),
  check('foundation_requests_operation_check', sql`${table.operation} IN ('PROVISION','RENAME','REVOKE')`),
  check('foundation_requests_request_hash_check', sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`),
  // Deferred audit FK is tracked in the SQL candidate, never silently regenerated.
]);

export const foundationAuditObligations = pgTable('foundation_audit_obligations', {
  id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: uuid('workspace_id').notNull(),
  auditId: uuid('audit_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  requestId: uuid('request_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
}, (table) => [index('foundation_obligation_audit_idx').on(table.workspaceId, table.auditId)]);
