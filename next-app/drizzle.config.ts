import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'fs';

// drizzle-kit roda como CLI fora do Next, então carregamos .env.local na mão.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* sem .env.local: usa o ambiente */
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
