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
  runtime: {
    webPort,
    baseUrl,
    artifactDir,
  },

  supabase: {
    url: 'https://ygfxukhktpqymahfrvbz.supabase.co',
    anonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZnh1a2hrdHBxeW1haGZydmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDI1MTcsImV4cCI6MjA5MTM3ODUxN30.LYqgEEb_HQPoBdJeYg_fDCO9CNeEaYZbDEFbRqQeJLs',
    projectRef: 'ygfxukhktpqymahfrvbz',
    authStorageKey: 'sb-ygfxukhktpqymahfrvbz-auth-token',
  },
} as const;
