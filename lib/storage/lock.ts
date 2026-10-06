/**
 * Simple in-process mutex used to make multi-collection updates (for example
 * "change wallet balance + append transaction") atomic within the running
 * Node process.
 */
export interface Lock {
  runExclusive<T>(task: () => Promise<T>): Promise<T>;
}

export function createLock(): Lock {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    runExclusive<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
