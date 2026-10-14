import { drizzle } from 'drizzle-orm/netlify-db';
import * as schema from '../../../db/schema.js';

export function createDatabaseClient() {
  return drizzle({ schema });
}
