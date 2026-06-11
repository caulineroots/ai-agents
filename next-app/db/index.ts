import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido (.env.local)');

// Reaproveita o client entre recompilações do dev (HMR) para não vazar conexões.
const g = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };
const client = g._pgClient ?? postgres(url, { max: 5 });
if (process.env.NODE_ENV !== 'production') g._pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
