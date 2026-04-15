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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for E2E tests. Set it in e2e/.env.test`);
  }
  return value;
}

const webPort = readNumberEnv('E2E_WEB_PORT', DEFAULT_WEB_PORT);
const baseUrl = readStringEnv('E2E_BASE_URL', `http://localhost:${webPort}`);
const artifactDir = readStringEnv('E2E_ARTIFACT_DIR', DEFAULT_ARTIFACT_DIR);

const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0];

export const E2E_CONFIG = {
  runtime: {
    webPort,
    baseUrl,
    artifactDir,
  },

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    projectRef: supabaseProjectRef,
    authStorageKey: `sb-${supabaseProjectRef}-auth-token`,
  },
} as const;
