const DEFAULT_WEB_PORT = 4101;
const DEFAULT_ARTIFACT_DIR = 'output/playwright';

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

const webPort = readNumberEnv('E2E_WEB_PORT', DEFAULT_WEB_PORT);
const baseUrl = readStringEnv('E2E_BASE_URL', `http://localhost:${webPort}`);
const artifactDir = readStringEnv('E2E_ARTIFACT_DIR', DEFAULT_ARTIFACT_DIR);

export const E2E_CONFIG = {
  projectId: 'tholdem-ebc18',

  runtime: {
    webPort,
    baseUrl,
    artifactDir,
    useEmulator:
      process.env.E2E_USE_EMULATOR === 'false'
        ? false
        : process.env.EXPO_PUBLIC_USE_EMULATOR === 'true' ||
          process.env.E2E_USE_EMULATOR === 'true',
  },

  emulator: {
    authHost: 'localhost:9099',
    firestoreHost: 'localhost:8080',
    functionsHost: 'localhost:5001',
    storageHost: 'localhost:9199',
  },
} as const;
