-- REVIEW CANDIDATE ONLY. Not in Netlify's automatic migration directory.
-- Separate authorization, historical preflight and role provisioning required.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hourvia_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
     OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hourvia_operations' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
     OR EXISTS(SELECT FROM pg_auth_members WHERE member IN ('hourvia_runtime'::regrole,'hourvia_operations'::regrole)) THEN
    RAISE EXCEPTION 'Reviewed separated roles required';
  END IF;
  IF EXISTS (SELECT FROM pg_class WHERE relnamespace = 'public'::regnamespace
             AND relowner IN ('hourvia_runtime'::regrole, 'hourvia_operations'::regrole)) THEN
    RAISE EXCEPTION 'Runtime and operations must not own baseline tables';
  END IF;
END $$;
LOCK TABLE public.workspaces, public.memberships, public.audit_events IN ACCESS EXCLUSIVE MODE;
-- Check untouched historical rows, not only rows subsequently triggering checks.
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.workspaces w WHERE
    (SELECT count(*) FROM public.memberships m WHERE m.workspace_id=w.id AND m.role='OWNER' AND m.status='ACTIVE' AND m.user_id=w.owner_id) <> 1
    OR (w.type='PERSONAL' AND (SELECT count(*) FROM public.memberships m WHERE m.workspace_id=w.id) <> 1)) THEN
    RAISE EXCEPTION 'Historical workspace integrity failed; separately reviewed repair required';
  END IF;
END $$;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_workspace_id_unique UNIQUE(workspace_id,id);
ALTER TABLE public.audit_events ADD CONSTRAINT audit_actor_same_workspace
  FOREIGN KEY(workspace_id,actor_id) REFERENCES public.memberships(workspace_id,user_id)
  DEFERRABLE INITIALLY DEFERRED;
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.audit_events a WHERE NOT (
    (a.entity_type='workspaces' AND a.entity_id=a.workspace_id) OR
    (a.entity_type='memberships' AND EXISTS(SELECT FROM public.memberships m WHERE m.workspace_id=a.workspace_id AND m.id=a.entity_id)))) THEN
    RAISE EXCEPTION 'Historical polymorphic attribution requires separate review';
  END IF;
END $$;
CREATE TABLE public.foundation_requests (
  actor_id uuid NOT NULL REFERENCES public.users(id),
  scope_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation IN ('PROVISION','RENAME','REVOKE')),
  request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  audit_id uuid NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(actor_id,scope_id,operation,request_id),
  FOREIGN KEY(workspace_id,audit_id) REFERENCES public.audit_events(workspace_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.foundation_audit_obligations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  audit_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  FOREIGN KEY(workspace_id,audit_id) REFERENCES public.audit_events(workspace_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX foundation_obligation_audit_idx ON public.foundation_audit_obligations(workspace_id,audit_id);
CREATE FUNCTION public.foundation_deny_history() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Retained history cannot be changed'; END $$;
CREATE FUNCTION public.foundation_identity_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Foundation rows are retained'; END IF;
  IF TG_TABLE_NAME='workspaces' THEN
    IF NEW.id<>OLD.id OR NEW.type<>OLD.type OR NEW.owner_id<>OLD.owner_id THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Workspace identity and ownership are immutable';
    END IF;
  ELSE
    IF NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.user_id<>OLD.user_id
       OR (NEW.role<>OLD.role AND (NEW.role='OWNER' OR OLD.role='OWNER')) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Membership identity and ownership are immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.foundation_final_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE wid uuid; w public.workspaces%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='workspaces' THEN wid:=NEW.id; ELSE wid:=NEW.workspace_id; END IF;
  SELECT * INTO STRICT w FROM public.workspaces WHERE id=wid FOR UPDATE;
  IF (SELECT count(*) FROM public.memberships WHERE workspace_id=wid AND role='OWNER' AND status='ACTIVE' AND user_id=w.owner_id)<>1
     OR (w.type='PERSONAL' AND (SELECT count(*) FROM public.memberships WHERE workspace_id=wid)<>1) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Final owner or personal membership mismatch';
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION public.foundation_capture_write() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE wid uuid; actor uuid; event uuid; req uuid; act text;
BEGIN
  IF current_user <> 'hourvia_operations' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Secured operation required'; END IF;
  IF TG_TABLE_NAME='workspaces' THEN wid:=NEW.id; ELSE wid:=NEW.workspace_id; END IF;
  actor:=nullif(current_setting('hourvia.actor',true),'')::uuid;
  event:=nullif(current_setting('hourvia.audit',true),'')::uuid;
  req:=nullif(current_setting('hourvia.request',true),'')::uuid;
  act:=nullif(current_setting('hourvia.action',true),'');
  IF actor IS NULL OR event IS NULL OR req IS NULL OR act IS NULL
     OR wid IS DISTINCT FROM nullif(current_setting('hourvia.workspace',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Missing scoped operation context';
  END IF;
  PERFORM 1 FROM public.workspaces WHERE id=wid FOR UPDATE;
  INSERT INTO public.foundation_audit_obligations(workspace_id,audit_id,actor_id,request_id,action,entity_type,entity_id)
    VALUES(wid,event,actor,req,act,TG_TABLE_NAME,NEW.id);
  RETURN NEW;
END $$;
CREATE FUNCTION public.foundation_check_obligation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT FROM public.audit_events a WHERE a.workspace_id=NEW.workspace_id AND a.id=NEW.audit_id
    AND a.actor_id=NEW.actor_id AND a.request_id=NEW.request_id AND a.action=NEW.action) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Mutation audit attribution mismatch';
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION public.foundation_audit_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF current_user<>'hourvia_operations'
    OR NEW.actor_id IS DISTINCT FROM nullif(current_setting('hourvia.actor',true),'')::uuid
    OR NEW.workspace_id IS DISTINCT FROM nullif(current_setting('hourvia.workspace',true),'')::uuid
    OR NEW.id IS DISTINCT FROM nullif(current_setting('hourvia.audit',true),'')::uuid
    OR NEW.request_id IS DISTINCT FROM nullif(current_setting('hourvia.request',true),'')::uuid
    OR NEW.action IS DISTINCT FROM current_setting('hourvia.action',true)
    OR NEW.action NOT IN ('PROVISION','RENAME','REVOKE') OR NEW.metadata <> '{}'::jsonb
    OR NOT EXISTS(SELECT FROM public.memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.actor_id AND status='ACTIVE')
    OR NOT ((NEW.entity_type='workspaces' AND NEW.entity_id=NEW.workspace_id AND NEW.action IN ('PROVISION','RENAME'))
      OR (NEW.entity_type='memberships' AND NEW.action='REVOKE' AND EXISTS(SELECT FROM public.memberships WHERE workspace_id=NEW.workspace_id AND id=NEW.entity_id))) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid tenant audit attribution';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_identity_guard BEFORE UPDATE OR DELETE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.foundation_identity_guard();
CREATE TRIGGER a_identity_guard BEFORE UPDATE OR DELETE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.foundation_identity_guard();
CREATE TRIGGER z_capture_write AFTER INSERT OR UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.foundation_capture_write();
CREATE TRIGGER z_capture_write AFTER INSERT OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.foundation_capture_write();
CREATE CONSTRAINT TRIGGER final_owner AFTER INSERT OR UPDATE ON public.workspaces DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_final_owner();
CREATE CONSTRAINT TRIGGER final_owner AFTER INSERT OR UPDATE ON public.memberships DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_final_owner();
CREATE CONSTRAINT TRIGGER obligation_attribution AFTER INSERT ON public.foundation_audit_obligations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.foundation_check_obligation();
CREATE TRIGGER audit_insert_guard BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.foundation_audit_guard();
CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.workspaces FOR EACH STATEMENT EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.memberships FOR EACH STATEMENT EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.audit_events FOR EACH STATEMENT EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_history BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.foundation_audit_obligations FOR EACH STATEMENT EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_history BEFORE UPDATE OR DELETE ON public.foundation_audit_obligations FOR EACH ROW EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.foundation_requests FOR EACH STATEMENT EXECUTE FUNCTION public.foundation_deny_history();
CREATE TRIGGER deny_history BEFORE UPDATE OR DELETE ON public.foundation_requests FOR EACH ROW EXECUTE FUNCTION public.foundation_deny_history();
-- Trusted backend supplies actor; shared DB credentials do not attest identity.
CREATE FUNCTION public.foundation_command(
  actor uuid, op text, scope uuid, req uuid, kind public.workspace_type DEFAULT NULL,
  label text DEFAULT NULL, zone text DEFAULT NULL, target uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE wid uuid; event uuid:=gen_random_uuid(); fingerprint text; cached public.foundation_requests%ROWTYPE;
  w public.workspaces%ROWTYPE; m public.memberships%ROWTYPE; affected uuid;
BEGIN
  IF actor IS NULL OR scope IS NULL OR req IS NULL OR op IS NULL OR op NOT IN ('PROVISION','RENAME','REVOKE') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid foundation command';
  END IF;
  IF (op='PROVISION' AND (scope<>actor OR kind IS NULL OR label IS NULL OR zone IS NULL OR target IS NOT NULL))
    OR (op='RENAME' AND (label IS NULL OR target IS NOT NULL OR kind IS NOT NULL OR zone IS NOT NULL))
    OR (op='REVOKE' AND (target IS NULL OR target=actor OR label IS NOT NULL OR kind IS NOT NULL OR zone IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid command shape';
  END IF;
  IF op='PROVISION' AND NOT EXISTS(SELECT FROM pg_timezone_names WHERE name=zone) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Unknown timezone';
  END IF;
  fingerprint:=encode(sha256(convert_to(jsonb_build_array(op,scope,kind,label,zone,target)::text,'UTF8')),'hex');
  -- Same account/root locks for every mutation and revocation. No session feature exists yet.
  PERFORM id FROM public.users WHERE id IN (actor,target) ORDER BY id FOR UPDATE;
  IF NOT EXISTS(SELECT FROM public.users WHERE id=actor) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Unknown principal';
  END IF;
  IF op='PROVISION' THEN
    SELECT * INTO cached FROM public.foundation_requests WHERE actor_id=actor AND scope_id=scope AND operation=op AND request_id=req;
    IF FOUND THEN
      SELECT * INTO STRICT w FROM public.workspaces WHERE id=cached.workspace_id FOR UPDATE;
      IF w.archived_at IS NOT NULL OR NOT EXISTS(SELECT FROM public.memberships WHERE workspace_id=w.id AND user_id=actor AND role='OWNER' AND status='ACTIVE') THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Replay not authorized';
      END IF;
      IF cached.request_hash<>fingerprint THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Idempotency payload conflict'; END IF;
      RETURN w.id;
    END IF;
    IF kind='PERSONAL' THEN SELECT * INTO w FROM public.workspaces WHERE owner_id=actor AND type='PERSONAL' FOR UPDATE; END IF;
    IF w.id IS NOT NULL AND w.archived_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Personal lifetime slot archived'; END IF;
    wid:=coalesce(w.id,gen_random_uuid());
  ELSE
    wid:=scope;
    SELECT * INTO w FROM public.workspaces WHERE id=wid FOR UPDATE;
    SELECT * INTO m FROM public.memberships WHERE workspace_id=wid AND user_id=actor FOR UPDATE;
    IF w.id IS NULL OR w.archived_at IS NOT NULL OR m.id IS NULL OR m.status<>'ACTIVE'
      OR (op='RENAME' AND m.role NOT IN ('OWNER','ADMIN'))
      OR (op='REVOKE' AND (m.role<>'OWNER' OR w.type<>'BUSINESS')) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Foundation action denied';
    END IF;
    SELECT * INTO cached FROM public.foundation_requests WHERE actor_id=actor AND scope_id=scope AND operation=op AND request_id=req;
    IF FOUND THEN
      IF cached.request_hash<>fingerprint THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Idempotency payload conflict'; END IF;
      RETURN cached.workspace_id;
    END IF;
  END IF;
  PERFORM set_config('hourvia.actor',actor::text,true), set_config('hourvia.workspace',wid::text,true),
    set_config('hourvia.audit',event::text,true), set_config('hourvia.request',req::text,true), set_config('hourvia.action',op,true);
  IF op='PROVISION' AND w.id IS NULL THEN
    INSERT INTO public.workspaces(id,type,owner_id,name,timezone,created_at,updated_at)
      VALUES(wid,kind,actor,label,zone,transaction_timestamp(),transaction_timestamp());
    INSERT INTO public.memberships(id,workspace_id,user_id,role,status,created_at,updated_at)
      VALUES(gen_random_uuid(),wid,actor,'OWNER','ACTIVE',transaction_timestamp(),transaction_timestamp());
  ELSIF op='RENAME' THEN
    UPDATE public.workspaces SET name=label,updated_at=transaction_timestamp() WHERE id=wid;
  ELSIF op='REVOKE' THEN
    SELECT id INTO affected FROM public.memberships WHERE workspace_id=wid AND user_id=target AND role<>'OWNER' AND status='ACTIVE' FOR UPDATE;
    IF affected IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Revocation target denied'; END IF;
    UPDATE public.memberships SET status='REMOVED',updated_at=transaction_timestamp() WHERE workspace_id=wid AND id=affected;
  END IF;
  INSERT INTO public.audit_events(id,workspace_id,actor_id,action,entity_type,entity_id,request_id,occurred_at,metadata)
    VALUES(event,wid,actor,op,CASE WHEN op='REVOKE' THEN 'memberships' ELSE 'workspaces' END,coalesce(affected,wid),req,transaction_timestamp(),'{}');
  INSERT INTO public.foundation_requests(actor_id,scope_id,operation,request_id,request_hash,workspace_id,audit_id)
    VALUES(actor,scope,op,req,fingerprint,wid,event);
  -- Deferred checks run at the outer transaction boundary; caller must commit before success.
  RETURN wid;
END $$;
CREATE FUNCTION public.foundation_read(actor uuid, wid uuid) RETURNS SETOF public.workspaces
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT w.* FROM public.workspaces w JOIN public.memberships m ON m.workspace_id=w.id
  WHERE w.id=wid AND m.user_id=actor AND m.status='ACTIVE' AND w.archived_at IS NULL
$$;
-- Temporary ownership-transfer prerequisite; removed before this transaction commits.
GRANT CREATE ON SCHEMA public TO hourvia_operations;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, hourvia_runtime, hourvia_operations;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, hourvia_runtime, hourvia_operations;
-- Operations cannot own tables, grant access, disable triggers, or perform destructive writes.
GRANT USAGE ON SCHEMA public TO hourvia_operations, hourvia_runtime;
GRANT SELECT ON public.users,public.workspaces,public.memberships,public.audit_events,public.foundation_requests TO hourvia_operations;
-- UPDATE users permits FOR UPDATE; no user mutation operation is exposed.
GRANT UPDATE ON public.users TO hourvia_operations;
GRANT INSERT,UPDATE ON public.workspaces,public.memberships TO hourvia_operations;
GRANT INSERT ON public.audit_events,public.foundation_requests,public.foundation_audit_obligations TO hourvia_operations;
GRANT USAGE ON SEQUENCE public.foundation_audit_obligations_id_seq TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_deny_history() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_deny_history() TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_identity_guard() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_identity_guard() TO hourvia_operations;
ALTER FUNCTION public.foundation_final_owner() OWNER TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_final_owner() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_final_owner() TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_capture_write() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_capture_write() TO hourvia_operations;
ALTER FUNCTION public.foundation_check_obligation() OWNER TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_check_obligation() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_check_obligation() TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_audit_guard() FROM PUBLIC, hourvia_runtime;
GRANT EXECUTE ON FUNCTION public.foundation_audit_guard() TO hourvia_operations;
ALTER FUNCTION public.foundation_command(uuid,text,uuid,uuid,public.workspace_type,text,text,uuid) OWNER TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_command(uuid,text,uuid,uuid,public.workspace_type,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.foundation_command(uuid,text,uuid,uuid,public.workspace_type,text,text,uuid) TO hourvia_runtime;
ALTER FUNCTION public.foundation_read(uuid,uuid) OWNER TO hourvia_operations;
REVOKE ALL ON FUNCTION public.foundation_read(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.foundation_read(uuid,uuid) TO hourvia_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, hourvia_runtime, hourvia_operations;
COMMIT;
