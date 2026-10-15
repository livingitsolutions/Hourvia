import { getDatabase } from '@netlify/database';

/** Narrow pinned-connection contract; never mix pool/HTTP queries inside a transaction. */
export interface TransactionClient {
  query(sql: string, parameters?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
}
export interface TransactionPool { connect(): Promise<TransactionClient> }

export async function inFoundationTransaction<T>(pool: TransactionPool, run: (client: TransactionClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let destroy = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await run(client);
    // Final constraints and COMMIT both succeed before a result leaves the adapter.
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { destroy = true; }
    throw error;
  } finally { client.release(destroy); }
}

export type FoundationCommand = Readonly<{
  actorId: string; // Derived only from a future verified server principal.
  operation: 'PROVISION' | 'RENAME' | 'REVOKE';
  scopeId: string;
  requestId: string; // Stable UUID reused on all retries; SQL hashes the normalized command.
  type?: 'PERSONAL' | 'BUSINESS';
  name?: string;
  timezone?: string;
  targetId?: string;
}>;

export async function executeFoundationCommand(pool: TransactionPool, command: FoundationCommand): Promise<string> {
  // Only known-aborted serialization/deadlock failures receive automatic whole-transaction retries.
  // Unknown COMMIT/transport outcomes propagate; a new authorized call with the same key resolves them.
  for (let attempt = 0; ; attempt++) {
    try {
      return await inFoundationTransaction(pool, async (client) => {
        const result = await client.query(
          'SELECT public.foundation_command($1,$2,$3,$4,$5,$6,$7,$8) AS workspace_id',
          [command.actorId, command.operation, command.scopeId, command.requestId,
            command.type ?? null, command.name?.trim() ?? null, command.timezone ?? null, command.targetId ?? null],
        );
        const id = result.rows[0]?.workspace_id;
        if (typeof id !== 'string') throw new Error('Invalid foundation result');
        return id;
      });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (attempt >= 2 || (code !== '40001' && code !== '40P01')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt + Math.floor(Math.random() * 25)));
    }
  }
}

export async function readFoundationWorkspace(pool: TransactionPool, actorId: string, workspaceId: string) {
  return inFoundationTransaction(pool, async (client) =>
    (await client.query('SELECT * FROM public.foundation_read($1,$2)', [actorId, workspaceId])).rows[0] ?? null);
}

/** Dormant factory. No handler imports it; role/transport review is required before activation. */
export function createFoundationPool(): TransactionPool { return getDatabase().pool; }
