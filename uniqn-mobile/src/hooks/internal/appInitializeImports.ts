export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDynamicImportUnsupported(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    error.message.includes('dynamic import callback was invoked without --experimental-vm-modules')
  );
}

export async function importWithFallback<T>(
  loader: () => Promise<T>,
  moduleId: string
): Promise<T> {
  const isJestRuntime =
    (typeof process !== 'undefined' &&
      typeof process.env === 'object' &&
      (process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID))) ||
    typeof (globalThis as { jest?: unknown }).jest !== 'undefined';

  if (isJestRuntime) {
    const jestGlobal = (
      globalThis as {
        jest?: {
          requireActual?: (id: string) => T;
          requireMock?: (id: string) => T;
        };
      }
    ).jest;

    if (jestGlobal?.requireMock) {
      try {
        return jestGlobal.requireMock(moduleId);
      } catch {
        if (jestGlobal.requireActual) {
          return jestGlobal.requireActual(moduleId);
        }
      }
    }
  }

  try {
    return await loader();
  } catch (error) {
    if (!isDynamicImportUnsupported(error)) {
      throw error;
    }

    const nodeRequire = Function('return require')() as (id: string) => T;
    return nodeRequire(moduleId);
  }
}
