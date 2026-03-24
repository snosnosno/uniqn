const path = require('path');
const { spawnSync } = require('child_process');

const extraArgs = process.argv.slice(2);
const env = {
  ...process.env,
  EXPO_PUBLIC_USE_EMULATOR: 'true',
};

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, '..');
const firebaseConfigPath = path.join(workspaceRoot, 'firebase.json');
const playwrightConfigPath = path.join(appRoot, 'e2e', 'playwright.config.ts');
const playwrightCliPath = path.join(appRoot, 'node_modules', 'playwright', 'cli.js');

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
      '--only auth,firestore',
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
