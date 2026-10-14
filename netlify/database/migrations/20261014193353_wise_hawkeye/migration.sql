CREATE TYPE "approval_decision" AS ENUM('APPROVE', 'REJECT', 'REOPEN');--> statement-breakpoint
CREATE TYPE "membership_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "membership_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "timesheet_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "workspace_type" AS ENUM('PERSONAL', 'BUSINESS');--> statement-breakpoint
CREATE TABLE "active_timers" (
	"workspace_id" uuid,
	"user_id" uuid,
	"project_id" uuid,
	"started_at" timestamp(3) with time zone NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	CONSTRAINT "one_active_timer_per_workspace_user" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "timer_idempotency_unique" UNIQUE("workspace_id","user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"requested_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"replacement_started_at" timestamp(3) with time zone NOT NULL,
	"replacement_ended_at" timestamp(3) with time zone NOT NULL,
	"replacement_duration_seconds" integer NOT NULL,
	"replacement_project_id" uuid,
	"replacement_description" text NOT NULL,
	"replacement_billable" boolean NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "adjustment_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "adjustment_entry_revision_unique" UNIQUE("workspace_id","time_entry_id","revision"),
	CONSTRAINT "adjustment_revision_positive" CHECK ("revision" > 0),
	CONSTRAINT "adjustment_reason_required" CHECK (char_length(btrim("reason")) > 0),
	CONSTRAINT "adjustment_duration_valid" CHECK ("replacement_ended_at" >= "replacement_started_at" AND "replacement_duration_seconds" = floor(extract(epoch FROM ("replacement_ended_at" - "replacement_started_at"))) AND "replacement_duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"timesheet_id" uuid,
	"adjustment_id" uuid,
	"target_version" integer NOT NULL,
	"decided_by" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "approval_one_target" CHECK (num_nonnulls("timesheet_id", "adjustment_id") = 1 AND "target_version" > 0),
	CONSTRAINT "approval_adjustment_not_reopened" CHECK ("adjustment_id" IS NULL OR "decision" <> 'REOPEN')
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "client_workspace_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "external_identity_issuer_subject_unique" UNIQUE("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "membership_workspace_user_unique" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "membership_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "membership_owner_active" CHECK ("role" <> 'OWNER' OR "status" = 'ACTIVE'),
	CONSTRAINT "membership_timestamps_ordered" CHECK ("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"billable" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "project_workspace_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"started_at" timestamp(3) with time zone NOT NULL,
	"ended_at" timestamp(3) with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"timezone" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"billable" boolean DEFAULT false NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "entry_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "entry_idempotency_unique" UNIQUE("workspace_id","user_id","idempotency_key"),
	CONSTRAINT "entry_duration_valid" CHECK ("ended_at" >= "started_at" AND "duration_seconds" = floor(extract(epoch FROM ("ended_at" - "started_at"))) AND "duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "timesheet_entries" (
	"workspace_id" uuid,
	"timesheet_id" uuid,
	"time_entry_id" uuid,
	"effective_revision" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY("workspace_id","timesheet_id","time_entry_id"),
	CONSTRAINT "entry_one_timesheet_unique" UNIQUE("workspace_id","time_entry_id"),
	CONSTRAINT "timesheet_item_nonnegative" CHECK ("effective_revision" >= 0 AND "duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "timesheet_submission_entries" (
	"workspace_id" uuid,
	"timesheet_id" uuid,
	"submission_version" integer,
	"time_entry_id" uuid,
	"effective_revision" integer NOT NULL,
	"started_at" timestamp(3) with time zone NOT NULL,
	"ended_at" timestamp(3) with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"project_id" uuid,
	"description" text NOT NULL,
	"billable" boolean NOT NULL,
	CONSTRAINT "timesheet_submission_entries_pkey" PRIMARY KEY("workspace_id","timesheet_id","submission_version","time_entry_id"),
	CONSTRAINT "submission_item_duration_valid" CHECK ("effective_revision" >= 0 AND "ended_at" >= "started_at" AND "duration_seconds" = floor(extract(epoch FROM ("ended_at" - "started_at"))) AND "duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "timesheet_submissions" (
	"workspace_id" uuid,
	"timesheet_id" uuid,
	"version" integer,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"timezone" text NOT NULL,
	"submitted_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "timesheet_submissions_pkey" PRIMARY KEY("workspace_id","timesheet_id","version"),
	CONSTRAINT "submission_period_version_valid" CHECK ("version" > 0 AND "period_end" > "period_start")
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"timezone" text NOT NULL,
	"status" "timesheet_status" DEFAULT 'DRAFT'::"timesheet_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "timesheet_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "timesheet_user_period_unique" UNIQUE("workspace_id","user_id","period_start","period_end"),
	CONSTRAINT "timesheet_period_valid" CHECK ("period_end" > "period_start" AND "version" > 0 AND "updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"display_name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY,
	"type" "workspace_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"archived_at" timestamp(3) with time zone,
	CONSTRAINT "workspace_name_valid" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
	CONSTRAINT "workspace_timestamps_ordered" CHECK ("updated_at" >= "created_at" AND ("archived_at" IS NULL OR "archived_at" >= "created_at"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "adjustment_one_decision" ON "approvals" ("workspace_id","adjustment_id") WHERE "adjustment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_one_terminal_decision_per_version" ON "approvals" ("workspace_id","timesheet_id","target_version") WHERE "timesheet_id" IS NOT NULL AND "decision" <> 'REOPEN';--> statement-breakpoint
CREATE INDEX "approval_workspace_timesheet_idx" ON "approvals" ("workspace_id","timesheet_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_workspace_occurred_idx" ON "audit_events" ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_workspace_entity_idx" ON "audit_events" ("workspace_id","entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "client_workspace_name_idx" ON "clients" ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "external_identity_user_idx" ON "external_identities" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_owner_membership_per_workspace" ON "memberships" ("workspace_id") WHERE "role" = 'OWNER';--> statement-breakpoint
CREATE INDEX "membership_user_status_idx" ON "memberships" ("user_id","status");--> statement-breakpoint
CREATE INDEX "project_workspace_client_idx" ON "projects" ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "entry_workspace_user_start_idx" ON "time_entries" ("workspace_id","user_id","started_at");--> statement-breakpoint
CREATE INDEX "entry_workspace_project_start_idx" ON "time_entries" ("workspace_id","project_id","started_at");--> statement-breakpoint
CREATE INDEX "timesheet_workspace_status_idx" ON "timesheets" ("workspace_id","status","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "one_personal_workspace_per_user" ON "workspaces" ("owner_id") WHERE "type" = 'PERSONAL';--> statement-breakpoint
CREATE INDEX "workspace_owner_idx" ON "workspaces" ("owner_id");--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "timer_member_same_workspace" FOREIGN KEY ("workspace_id","user_id") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "active_timers" ADD CONSTRAINT "timer_project_same_workspace" FOREIGN KEY ("workspace_id","project_id") REFERENCES "projects"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustment_entry_same_workspace" FOREIGN KEY ("workspace_id","time_entry_id") REFERENCES "time_entries"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustment_actor_same_workspace" FOREIGN KEY ("workspace_id","requested_by") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustment_project_same_workspace" FOREIGN KEY ("workspace_id","replacement_project_id") REFERENCES "projects"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approval_timesheet_same_workspace" FOREIGN KEY ("workspace_id","timesheet_id") REFERENCES "timesheets"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approval_submitted_version_same_workspace" FOREIGN KEY ("workspace_id","timesheet_id","target_version") REFERENCES "timesheet_submissions"("workspace_id","timesheet_id","version");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approval_adjustment_same_workspace" FOREIGN KEY ("workspace_id","adjustment_id") REFERENCES "adjustments"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approval_actor_same_workspace" FOREIGN KEY ("workspace_id","decided_by") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "project_client_same_workspace" FOREIGN KEY ("workspace_id","client_id") REFERENCES "clients"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "entry_member_same_workspace" FOREIGN KEY ("workspace_id","user_id") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "entry_project_same_workspace" FOREIGN KEY ("workspace_id","project_id") REFERENCES "projects"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_item_sheet_same_workspace" FOREIGN KEY ("workspace_id","timesheet_id") REFERENCES "timesheets"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_item_entry_same_workspace" FOREIGN KEY ("workspace_id","time_entry_id") REFERENCES "time_entries"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_submission_entries" ADD CONSTRAINT "timesheet_submission_entries_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "timesheet_submission_entries" ADD CONSTRAINT "submission_item_version_same_workspace" FOREIGN KEY ("workspace_id","timesheet_id","submission_version") REFERENCES "timesheet_submissions"("workspace_id","timesheet_id","version");--> statement-breakpoint
ALTER TABLE "timesheet_submission_entries" ADD CONSTRAINT "submission_item_entry_same_workspace" FOREIGN KEY ("workspace_id","time_entry_id") REFERENCES "time_entries"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_submission_entries" ADD CONSTRAINT "submission_item_project_same_workspace" FOREIGN KEY ("workspace_id","project_id") REFERENCES "projects"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "submission_sheet_same_workspace" FOREIGN KEY ("workspace_id","timesheet_id") REFERENCES "timesheets"("workspace_id","id");--> statement-breakpoint
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "submission_member_same_workspace" FOREIGN KEY ("workspace_id","user_id") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheet_member_same_workspace" FOREIGN KEY ("workspace_id","user_id") REFERENCES "memberships"("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id");