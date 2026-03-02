import { runSimulationCore } from '../engine/montecarlo';
import type { SimulationInput } from '../engine/montecarlo';

export type WorkerRequest = {
  type: 'run';
  input: SimulationInput;
};

export type WorkerResponse =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'result'; output: ReturnType<typeof runSimulationCore> }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, input } = event.data;

  if (type === 'run') {
    try {
      const output = runSimulationCore(input, (completed, total) => {
        self.postMessage({ type: 'progress', completed, total } satisfies WorkerResponse);
      });
      self.postMessage({ type: 'result', output } satisfies WorkerResponse);
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse);
    }
  }
};
