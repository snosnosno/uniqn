const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const extraArgs = process.argv.slice(2);
const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, '..');
const firebaseConfigPath = path.join(workspaceRoot, 'firebase.json');
const playwrightConfigPath = path.join(appRoot, 'e2e', 'playwright.config.ts');
const playwrightCliPath = path.join(appRoot, 'node_modules', 'playwright', 'cli.js');
const webPort = Number.parseInt(process.env.E2E_WEB_PORT || '4101', 10);
const baseUrl = process.env.E2E_BASE_URL || `http://localhost:${webPort}`;
const artifactDir = process.env.E2E_ARTIFACT_DIR || path.join('output', 'playwright');

const env = {
  ...process.env,
  EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development',
  EXPO_PUBLIC_FIREBASE_REGION: process.env.EXPO_PUBLIC_FIREBASE_REGION || 'asia-northeast3',
  EXPO_PUBLIC_USE_EMULATOR: 'true',
  E2E_USE_EMULATOR: 'true',
  E2E_WEB_PORT: String(webPort),
  E2E_BASE_URL: baseUrl,
  E2E_ARTIFACT_DIR: artifactDir,
};

fs.mkdirSync(path.join(appRoot, artifactDir), { recursive: true });

function quoteForShell(argument) {
  if (!argument) {
    return '""';
  }

  return `"${argument.replace(/"/g, '\\"')}"`;
}

const playwrightCliCommand = [
  process.execPath,
  playwrightCliPath,
  'test',
  `--config=${playwrightConfigPath}`,
  ...extraArgs,
]
  .map(quoteForShell)
  .join(' ');

const playwrightCommand = [
  process.platform === 'win32' ? `cd /d ${quoteForShell(appRoot)}` : `cd ${quoteForShell(appRoot)}`,
  playwrightCliCommand,
].join(' && ');

const commands = [
  {
    commandLine: 'npx expo export -p web',
    cwd: appRoot,
  },
  {
    commandLine: [
      'npx firebase emulators:exec',
      '--project tholdem-ebc18',
      `--config ${quoteForShell(firebaseConfigPath)}`,
      '--only auth,firestore,functions,storage',
      quoteForShell(playwrightCommand),
    ].join(' '),
    cwd: workspaceRoot,
  },
];

for (const { commandLine, cwd } of commands) {
  const result = spawnSync(commandLine, {
    cwd,
    env,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
