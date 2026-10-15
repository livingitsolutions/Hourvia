import { randomUUID } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeFoundationCommand, inFoundationTransaction } from '../../src/infrastructure/database/foundation-transactions.js';
import type { TransactionPool, TransactionClient } from '../../src/infrastructure/database/foundation-transactions.js';

// No default platform URL, no migration runner, no baseline replay. Empty disposable DB is
// provisioned with baseline + candidate only by a separately authorized operator beforehand.
const authorized = process.env.HOURVIA_PG_AUTHORIZATION === 'isolated-sprint-0.3a';
const runtimeUrl = process.env.HOURVIA_PG_RUNTIME_URL;
const maintenanceUrl = process.env.HOURVIA_PG_MAINTENANCE_URL;
const enabled = authorized && !!runtimeUrl && !!maintenanceUrl;

describe.skipIf(!enabled)('PostgreSQL foundation enforcement — NOT RUN without isolated authorization', () => {
  let runtime: TransactionPool;
  let maintenance: TransactionPool;
  const pools: ReturnType<typeof getDatabase>['pool'][] = [];
  const owner = randomUUID();
  const other = randomUUID();
  const third = randomUUID();
  const provision = (actorId: string, requestId = randomUUID(), type: 'PERSONAL' | 'BUSINESS' = 'PERSONAL') =>
    executeFoundationCommand(runtime, { actorId, scopeId: actorId, operation: 'PROVISION', requestId, type, name: 'Fixture', timezone: 'UTC' });

  beforeAll(async () => {
    // Factories only execute inside explicitly enabled suite.
    for (const url of [runtimeUrl!, maintenanceUrl!]) {
      if (!new URL(url).pathname.slice(1).startsWith('hourvia_s03a_')) throw new Error('Disposable URL name gate failed');
      const db = getDatabase({ connectionString: url });
      pools.push(db.pool);
      const client = await db.pool.connect();
      try {
        const { rows } = await client.query('SELECT current_database() AS db, current_user AS role');
        if (!String(rows[0]?.db).startsWith('hourvia_s03a_')) throw new Error('Disposable database name gate failed');
        if (pools.length === 1 && rows[0]?.role !== 'hourvia_runtime') throw new Error('Actual runtime login required');
      } finally { client.release(); }
    }
    runtime = pools[0]!;
    maintenance = pools[1]!;
    await inFoundationTransaction(maintenance, async (c) => {
      for (const id of [owner, other, third]) await c.query("INSERT INTO public.users VALUES($1,'Fixture','UTC',now())", [id]);
    });
  });
  afterAll(async () => { for (const pool of pools) await pool.end(); });

  async function sqlstate(action: () => Promise<unknown>, code: string) {
    await expect(action()).rejects.toMatchObject({ code });
  }
  async function context(c: TransactionClient, wid: string, actor: string, event: string, request: string) {
    await c.query('SET LOCAL ROLE hourvia_operations');
    await c.query("SELECT set_config('hourvia.workspace',$1,true),set_config('hourvia.actor',$2,true),set_config('hourvia.audit',$3,true),set_config('hourvia.request',$4,true),set_config('hourvia.action','PROVISION',true)", [wid, actor, event, request]);
  }
  async function addMember(wid: string, user: string, status = 'ACTIVE', role = 'ADMIN') {
    return inFoundationTransaction(maintenance, async (c) => {
      const event = randomUUID(); const request = randomUUID();
      await context(c, wid, owner, event, request);
      await c.query("INSERT INTO public.memberships VALUES($1,$2,$3,$4,$5,now(),now())", [randomUUID(), wid, user, role, status]);
      await c.query("INSERT INTO public.audit_events VALUES($1,$2,$3,'PROVISION','workspaces',$2,$4,now(),'{}')", [event, wid, owner, request]);
    });
  }
  async function count(table: 'workspaces' | 'audit_events' | 'foundation_requests', wid: string) {
    return inFoundationTransaction(maintenance, async (c) => {
      const column = table === 'workspaces' ? 'id' : 'workspace_id';
      return Number((await c.query(`SELECT count(*) AS n FROM public.${table} WHERE ${column}=$1`, [wid])).rows[0]?.n);
    });
  }
  async function begin(pool: TransactionPool) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query("SET LOCAL statement_timeout='10s'");
    return c;
  }
  async function waitBlocked(pid: number) {
    const observer = await maintenance.connect();
    try {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const r = await observer.query('SELECT cardinality(pg_blocking_pids($1)) AS n', [pid]);
        if (Number(r.rows[0]?.n) > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('Expected database lock barrier absent');
    } finally { observer.release(); }
  }
  const call = (c: TransactionClient, actor: string, wid: string, request: string, op = 'RENAME', target: string | null = null) =>
    c.query('SELECT public.foundation_command($1,$2,$3,$4,NULL,$5,NULL,$6) AS wid', [actor, op, wid, request, op === 'RENAME' ? 'Renamed' : null, target]);

  it.each(['same-key', 'distinct-key'])('allows atomic workspace + owner; concurrent personal commands converge: %s', async (mode) => {
    const raceActor=randomUUID();
    await inFoundationTransaction(maintenance,(c) => c.query("INSERT INTO public.users VALUES($1,'Race','UTC',now())",[raceActor]));
    const a = await begin(runtime); const b = await begin(runtime);
    try {
      const pid = Number((await b.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid);
      const args = [raceActor, raceActor, randomUUID()];
      const first = await a.query("SELECT public.foundation_command($1,'PROVISION',$2,$3,'PERSONAL','Fixture','UTC',NULL) AS wid", args);
      const pending = b.query("SELECT public.foundation_command($1,'PROVISION',$2,$3,'PERSONAL','Fixture','UTC',NULL) AS wid", [raceActor, raceActor, mode === 'same-key' ? args[2] : randomUUID()]);
      await waitBlocked(pid);
      await a.query('COMMIT');
      const second = await pending;
      await b.query('COMMIT');
      expect(second.rows[0]?.wid).toBe(first.rows[0]?.wid);
      const wid=String(first.rows[0]?.wid);
      expect(await count('workspaces',wid)).toBe(1);
      expect(await count('audit_events',wid)).toBe(mode==='same-key' ? 1 : 2);
    } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release(); }
  });
  it('rejects mismatched owner at commit', async () => {
    await sqlstate(() => inFoundationTransaction(maintenance, async (c) => {
      const wid = randomUUID(); const event = randomUUID(); const req = randomUUID();
      await context(c, wid, other, event, req);
      await c.query("INSERT INTO public.workspaces VALUES($1,'BUSINESS',$2,'Mismatch','UTC',now(),now(),NULL)", [wid, owner]);
      await c.query("INSERT INTO public.memberships VALUES($1,$2,$3,'OWNER','ACTIVE',now(),now())", [randomUUID(), wid, other]);
      await c.query("INSERT INTO public.audit_events VALUES($1,$2,$3,'PROVISION','workspaces',$2,$4,now(),'{}')", [event, wid, other, req]);
    }), '23514');
  });
  it.each(['ACTIVE', 'SUSPENDED', 'REMOVED'])('rejects extra personal membership in %s state', async (status) => {
    const wid = await provision(owner);
    await sqlstate(() => addMember(wid, other, status), '23514');
  });
  it('retains personal lifetime slots, type, ownership and owner role', async () => {
    const wid = await provision(owner);
    for (const query of ["UPDATE public.workspaces SET type='BUSINESS' WHERE id=$1", 'UPDATE public.workspaces SET owner_id=$2 WHERE id=$1', 'DELETE FROM public.workspaces WHERE id=$1', "UPDATE public.memberships SET role='ADMIN' WHERE workspace_id=$1"]) {
      await sqlstate(() => inFoundationTransaction(maintenance, async (c) => { await c.query(query, query.includes('$2') ? [wid,other] : [wid]); }), '23514');
    }
  });
  it('denies runtime direct writes and cross-tenant audit actor/entity references', async () => {
    const wid = await provision(owner); const second = await provision(other);
    await sqlstate(() => inFoundationTransaction(runtime, (c) => c.query('DELETE FROM public.workspaces WHERE id=$1', [wid])), '42501');
    for (const actor of [owner, other]) await sqlstate(() => inFoundationTransaction(maintenance, async (c) => {
      const event = randomUUID(); const req = randomUUID(); await context(c, wid, actor, event, req);
      await c.query("INSERT INTO public.audit_events VALUES($1,$2,$3,'PROVISION','workspaces',$4,$5,now(),'{}')", [event,wid,actor,actor===owner ? second : wid,req]);
    }), '23514');
    const clientId=randomUUID();
    await inFoundationTransaction(maintenance,(c) => c.query("INSERT INTO public.clients VALUES($1,$2,'Foreign',NULL,now())",[clientId,second]));
    await sqlstate(() => inFoundationTransaction(maintenance, (c) => c.query("INSERT INTO public.projects VALUES($1,$2,$3,'Cross',false,NULL,now())", [randomUUID(),wid,clientId])), '23503');
  });
  it('denies audit update, delete and truncate, including privileged ordinary paths', async () => {
    const wid = await provision(owner);
    for (const query of ["UPDATE public.audit_events SET metadata='{}' WHERE workspace_id=$1", 'DELETE FROM public.audit_events WHERE workspace_id=$1', 'TRUNCATE public.audit_events']) {
      await sqlstate(() => inFoundationTransaction(maintenance, (c) => c.query(query, query.includes('$1') ? [wid] : [])), '23514');
    }
  });
  it('rolls back mutation, audit and request on audit failure or missing audit obligation', async () => {
    const wid = randomUUID();
    await sqlstate(() => inFoundationTransaction(maintenance, async (c) => {
      await context(c,wid,owner,randomUUID(),randomUUID());
      await c.query("INSERT INTO public.workspaces VALUES($1,'BUSINESS',$2,'Unaudited','UTC',now(),now(),NULL)", [wid,owner]);
      await c.query("INSERT INTO public.memberships VALUES($1,$2,$3,'OWNER','ACTIVE',now(),now())", [randomUUID(),wid,owner]);
    }), '23503');
    expect(await count('workspaces',wid)).toBe(0);
    const existing = await provision(owner);
    const prior = await count('audit_events',existing);
    await expect(inFoundationTransaction(runtime, async (c) => { await call(c,owner,existing,randomUUID()); throw new Error('Injected rollback'); })).rejects.toThrow('Injected rollback');
    expect(await count('audit_events',existing)).toBe(prior);
  });
  it('persists duplicate results, rejects changed payloads, and safely resolves retries', async () => {
    const key=randomUUID(); const wid=await provision(owner,key);
    const events=await count('audit_events',wid);
    expect(await provision(owner,key)).toBe(wid);
    expect(await count('audit_events',wid)).toBe(events);
    await sqlstate(() => executeFoundationCommand(runtime,{actorId:owner,scopeId:owner,operation:'PROVISION',requestId:key,type:'PERSONAL',name:'Different',timezone:'UTC'}),'22023');
    const retry=randomUUID();
    await expect(inFoundationTransaction(runtime, async (c) => { await call(c,owner,wid,retry); throw new Error('Retry injection'); })).rejects.toThrow();
    await executeFoundationCommand(runtime,{actorId:owner,scopeId:wid,operation:'RENAME',requestId:retry,name:'Renamed'});
    expect(await count('foundation_requests',wid)).toBeGreaterThan(0);
  });

  it('clears transaction-local operation context on commit and rollback', async () => {
    const wid=await provision(owner); const c=await runtime.connect();
    try {
      for (const end of ['COMMIT','ROLLBACK']) {
        await c.query('BEGIN'); await call(c,owner,wid,randomUUID()); await c.query(end);
        const r=await c.query("SELECT nullif(current_setting('hourvia.actor',true),'') AS actor, nullif(current_setting('hourvia.workspace',true),'') AS workspace");
        expect(r.rows[0]).toEqual({actor:null,workspace:null});
      }
    } finally { await c.query('ROLLBACK'); c.release(); }
  });
  it('rolls back preceding command and audit when a later audit insertion fails', async () => {
    const wid=await provision(owner); const prior=await count('audit_events',wid);
    await sqlstate(() => inFoundationTransaction(maintenance,async (c) => {
      await c.query('SET LOCAL ROLE hourvia_operations');
      await call(c,owner,wid,randomUUID());
      await c.query("INSERT INTO public.audit_events VALUES($1,$2,$3,'RENAME','workspaces',$2,$4,now(),'{\"unapproved\":true}')",[randomUUID(),wid,owner,randomUUID()]);
    }),'23514');
    expect(await count('audit_events',wid)).toBe(prior);
  });
  it.each(['revocation-first','write-first'])('serializes revocation races: %s', async (order) => {
    const wid=await provision(owner,randomUUID(),'BUSINESS'); await addMember(wid,third);
    const a=await begin(runtime); const b=await begin(runtime);
    try {
      const pid=Number((await b.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid);
      const writeKey=randomUUID();
      if (order==='revocation-first') await call(a,owner,wid,randomUUID(),'REVOKE',third);
      else await call(a,third,wid,writeKey);
      const pending = order==='revocation-first' ? call(b,third,wid,writeKey) : call(b,owner,wid,randomUUID(),'REVOKE',third);
      const outcome=pending.then(() => 'ok', (e: unknown) => typeof e==='object' && e && 'code' in e ? e.code : 'unknown');
      await waitBlocked(pid); await a.query('COMMIT');
      expect(await outcome).toBe(order==='revocation-first' ? '42501' : 'ok');
      await b.query(order==='revocation-first' ? 'ROLLBACK' : 'COMMIT');
      await sqlstate(() => executeFoundationCommand(runtime,{actorId:third,scopeId:wid,operation:'RENAME',requestId:writeKey,name:'Renamed'}),'42501');
    } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release(); }
  });
});
