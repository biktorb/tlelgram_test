import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { PgStore } from './pgStore.ts';
import { MemoryStore, type Store } from './store.ts';

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

const app = await buildApp(config, store, { logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await store.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
