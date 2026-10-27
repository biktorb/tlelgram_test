import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { cats } from '@otryad/core';
import type { RunRecord } from './store.ts';

export type RunResult = ReturnType<cats.CatRun['result']>;
// Replays a record and returns what the run achieved; throws on a bad record.
export type Replayer = (seed: number, rec: RunRecord) => Promise<RunResult>;

// In the same thread: for tests and the in-memory dev server.
export const replayHere: Replayer = async (seed, rec) => cats.replay(seed, rec).result();

// Replays a record with events to see how the run went, for the admin page.
export type Analyzer = (seed: number, rec: RunRecord) => Promise<cats.RunInsight>;
export const analyzeHere: Analyzer = async (seed, rec) => cats.analyze(seed, rec);

interface Job {
  seed: number;
  rec: RunRecord;
  analyze: boolean;
  resolve: (r: never) => void;
  reject: (e: Error) => void;
}

// A 20-minute run takes about a second to replay, so replays run in worker
// threads and the server keeps answering meanwhile.
export function workerReplayer(size = Math.max(1, Math.min(4, availableParallelism() - 1))): Replayer & { analyze: Analyzer; close(): Promise<void> } {
  const queue: Job[] = [];
  const idle: Worker[] = [];
  const busy = new Map<Worker, Job>();

  const pump = () => {
    while (queue.length && idle.length) {
      const w = idle.pop()!;
      const job = queue.shift()!;
      busy.set(w, job);
      w.postMessage({ seed: job.seed, rec: job.rec, analyze: job.analyze });
    }
  };
  const spawn = () => {
    const w = new Worker(new URL('./replayWorker.ts', import.meta.url));
    w.on('message', (m: { result?: never; error?: string }) => {
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

  const job =
    <T>(analyze: boolean) =>
    (seed: number, rec: RunRecord) =>
      new Promise<T>((resolve, reject) => {
        queue.push({ seed, rec, analyze, resolve, reject });
        pump();
      });
  return Object.assign(job<RunResult>(false), {
    analyze: job<cats.RunInsight>(true),
    async close() {
      await Promise.all([...idle, ...busy.keys()].map((w) => w.terminate()));
    },
  });
}
