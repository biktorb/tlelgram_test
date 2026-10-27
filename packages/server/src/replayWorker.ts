import { parentPort } from 'node:worker_threads';
import { cats } from '@otryad/core';

parentPort!.on('message', ({ seed, rec, hero, analyze }) => {
  try {
    parentPort!.postMessage({ result: analyze ? cats.analyze(seed, rec, hero) : cats.replay(seed, rec, { hero }).result() });
  } catch (e) {
    parentPort!.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
});
