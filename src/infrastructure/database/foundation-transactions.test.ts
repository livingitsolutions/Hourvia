import { describe, expect, it } from 'vitest';
import { executeFoundationCommand, inFoundationTransaction } from './foundation-transactions.js';
import type { TransactionClient } from './foundation-transactions.js';

// Transport unit tests only; these do not prove PostgreSQL enforcement.
describe('foundation transaction transport', () => {
  it('uses one pinned client, checks deferred constraints, commits, then releases', async () => {
    const statements: string[] = [];
    const client: TransactionClient = {
      async query(sql) { statements.push(sql); return { rows: [] }; },
      release() { statements.push('release'); },
    };
    await inFoundationTransaction({ async connect() { return client; } }, async (c) => { expect(c).toBe(client); await c.query('operation'); });
    expect(statements).toEqual(['BEGIN', "SET LOCAL lock_timeout = '5s'", "SET LOCAL statement_timeout = '15s'", 'operation', 'SET CONSTRAINTS ALL IMMEDIATE', 'COMMIT', 'release']);
  });
  it('rolls back failed final constraints and discards a connection if rollback fails', async () => {
    const statements: string[] = [];
    const client: TransactionClient = {
      async query(sql) {
        statements.push(sql);
        if (sql === 'SET CONSTRAINTS ALL IMMEDIATE' || sql === 'ROLLBACK') throw new Error('failure');
        return { rows: [] };
      },
      release(destroy) { expect(destroy).toBe(true); statements.push('release'); },
    };
    await expect(inFoundationTransaction({ async connect() { return client; } }, async () => 'result')).rejects.toThrow('failure');
    expect(statements).not.toContain('COMMIT');
    expect(statements.slice(-2)).toEqual(['ROLLBACK','release']);
  });
  it('retries only aborted transactions with the same durable key, not uncertain commits', async () => {
    let attempts=0;
    const keys: unknown[]=[];
    const pool={ async connect(): Promise<TransactionClient> {
      const attempt=++attempts;
      return { async query(sql,parameters) {
        if (sql.startsWith('SELECT public.foundation_command')) { keys.push(parameters?.[3]); if (attempt===1) throw Object.assign(new Error('serialization'),{code:'40001'}); return {rows:[{workspace_id:'workspace'}]}; }
        return {rows:[]};
      }, release() {} };
    } };
    const command={actorId:'actor',scopeId:'actor',requestId:'stable',operation:'PROVISION' as const};
    expect(await executeFoundationCommand(pool,command)).toBe('workspace');
    expect(keys).toEqual(['stable','stable']);
    let connects=0;
    await expect(executeFoundationCommand({async connect() {
      connects++;
      return {async query(sql) { if(sql==='COMMIT') throw new Error('uncertain'); return {rows:[{workspace_id:'workspace'}]}; },release() {}};
    }},command)).rejects.toThrow('uncertain');
    expect(connects).toBe(1);
  });
});
