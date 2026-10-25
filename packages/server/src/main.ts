import { readFile } from 'node:fs/promises';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { seedGhosts } from './game.ts';
import { PgStore } from './pgStore.ts';
import { MemoryStore, type GhostUnit, type Store } from './store.ts';

const config = loadConfig();

let store: Store;
if (config.databaseUrl) {
  const pgStore = new PgStore(config.databaseUrl);
  const applied = await pgStore.migrate();
  if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
  store = pgStore;
} else {
  console.warn('DATABASE_URL is not set: using the in-memory store, data is lost on restart');
  store = new MemoryStore();
}

const ghostsFile = new URL('../../client/src/ghosts.json', import.meta.url);
const seeded = await seedGhosts(store, JSON.parse(await readFile(ghostsFile, 'utf8')) as Record<string, GhostUnit[][]>);
if (seeded) console.log(`Seeded ${seeded} bot teams`);

const app = await buildApp(config, store, { logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await store.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
