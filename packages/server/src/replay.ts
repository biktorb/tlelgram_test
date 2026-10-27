import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { cats } from '@otryad/core';
import type { RunRecord } from './store.ts';

export type RunResult = ReturnType<cats.CatRun['result']>;
// Replays a record and returns what the run achieved; throws on a bad record.
export type Replayer = (seed: number, rec: RunRecord) => Promise<RunResult>;

// In the same thread: for tests and the in-memory dev server.
export const replayHere: Replayer = async (seed, rec) => cats.replay(seed, rec).result();

interface Job {
  seed: number;
  rec: RunRecord;
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
}

// A 20-minute run takes about a second to replay, so replays run in worker
// threads and the server keeps answering meanwhile.
export function workerReplayer(size = Math.max(1, Math.min(4, availableParallelism() - 1))): Replayer & { close(): Promise<void> } {
  const queue: Job[] = [];
  const idle: Worker[] = [];
  const busy = new Map<Worker, Job>();

  const pump = () => {
    while (queue.length && idle.length) {
      const w = idle.pop()!;
      const job = queue.shift()!;
      busy.set(w, job);
      w.postMessage({ seed: job.seed, rec: job.rec });
    }
  };
  const spawn = () => {
    const w = new Worker(new URL('./replayWorker.ts', import.meta.url));
    w.on('message', (m: { result?: RunResult; error?: string }) => {
      const job = busy.get(w);
      busy.delete(w);
      idle.push(w);
      if (job) {
        if (m.result) job.resolve(m.result);
        else job.reject(new Error(m.error ?? 'replay failed'));
      }
      pump();
    });
    w.on('error', (e) => {
      // A crashed worker fails its job and is replaced.
      const job = busy.get(w);
      busy.delete(w);
      job?.reject(e);
      spawn();
      pump();
    });
    idle.push(w);
  };
  for (let i = 0; i < size; i++) spawn();

  const replay = (seed: number, rec: RunRecord) =>
    new Promise<RunResult>((resolve, reject) => {
      queue.push({ seed, rec, resolve, reject });
      pump();
    });
  return Object.assign(replay, {
    async close() {
      await Promise.all([...idle, ...busy.keys()].map((w) => w.terminate()));
    },
  });
}
