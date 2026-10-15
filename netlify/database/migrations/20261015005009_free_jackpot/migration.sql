CREATE TABLE "foundation_audit_obligations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "foundation_audit_obligations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foundation_requests" (
	"actor_id" uuid,
	"scope_id" uuid,
	"operation" text,
	"request_id" uuid,
	"request_hash" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foundation_requests_pkey" PRIMARY KEY("actor_id","scope_id","operation","request_id"),
	CONSTRAINT "foundation_requests_operation_check" CHECK ("operation" IN ('PROVISION','RENAME','REVOKE')),
	CONSTRAINT "foundation_requests_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_workspace_id_unique" UNIQUE("workspace_id","id");--> statement-breakpoint
CREATE INDEX "foundation_obligation_audit_idx" ON "foundation_audit_obligations" ("workspace_id","audit_id");--> statement-breakpoint
ALTER TABLE "foundation_requests" ADD CONSTRAINT "foundation_requests_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "foundation_requests" ADD CONSTRAINT "foundation_requests_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id");