const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// .env.test를 playwright.config.ts보다 먼저 로드 (import hoisting으로 config.ts가 먼저 평가되기 때문)
require('dotenv').config({ path: path.join(__dirname, '../e2e/.env.test') });

const extraArgs = process.argv.slice(2);
const appRoot = process.cwd();
const playwrightConfigPath = path.join(appRoot, 'e2e', 'playwright.config.ts');
const playwrightCliPath = path.join(appRoot, 'node_modules', 'playwright', 'cli.js');
const webPort = Number.parseInt(process.env.E2E_WEB_PORT || '4101', 10);
const baseUrl = process.env.E2E_BASE_URL || `http://localhost:${webPort}`;
const artifactDir = process.env.E2E_ARTIFACT_DIR || path.join('output', 'playwright');

const env = {
  ...process.env,
  EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development',
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

const commands = [];

// CI에서는 Build Web step이 이미 dist/를 빌드함. 로컬에서만 빌드 필요.
const distPath = path.join(appRoot, 'dist');
if (!fs.existsSync(distPath)) {
  commands.push({
    commandLine: 'npx expo export -p web',
    cwd: appRoot,
  });
}

// Playwright 직접 실행 (playwright.config.ts의 webServer가 npx serve dist 담당)
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

commands.push({
  commandLine: playwrightCommand,
  cwd: appRoot,
});

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
