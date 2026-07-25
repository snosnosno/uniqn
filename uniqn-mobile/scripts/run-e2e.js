const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// .env.test를 playwright.config.ts보다 먼저 로드 (import hoisting으로 config.ts가 먼저 평가되기 때문)
require('dotenv').config({ path: path.join(__dirname, '../e2e/.env.test'), quiet: true });

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
//
// 2026-07-25: 존재 여부만 보고 건너뛰던 로직에 최신성(staleness) 판정을 추가한다.
// 이전 브랜치/커밋에서 만든 dist/가 남아 있으면 그대로 재사용돼 **거짓 통과·거짓 실패**가
// 났다(PR#331 조사 중 실증 — #328 이전 번들이 남아 있어 회귀가 재현되지 않을 뻔했다).
// 판정 기준은 git HEAD 해시: 빌드 직후 dist/.build-rev 에 기록하고, 다음 실행에서 현재
// HEAD 와 다르면 재빌드한다. HEAD 가 같아도 워킹트리가 dirty 면 소스가 바뀐 것이므로 재빌드.
// git 정보를 못 얻는 환경(비-git 체크아웃 등)에서는 안전하게 재빌드 쪽으로 넘어간다.
const distPath = path.join(appRoot, 'dist');
const buildRevPath = path.join(distPath, '.build-rev');
const forceBuild = extraArgs.includes('--force-build');

function currentBuildRev() {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' });
  if (head.status !== 0) {
    return null;
  }
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: appRoot, encoding: 'utf8' });
  const dirtySuffix = dirty.status === 0 && dirty.stdout.trim() ? '-dirty' : '';
  return `${head.stdout.trim()}${dirtySuffix}`;
}

const buildRev = currentBuildRev();

function distIsFresh() {
  if (forceBuild || !fs.existsSync(distPath)) {
    return false;
  }
  // git 정보 부재 또는 dirty 워킹트리 → 최신성을 보증할 수 없으므로 재빌드
  if (!buildRev || buildRev.endsWith('-dirty')) {
    return false;
  }
  try {
    return fs.readFileSync(buildRevPath, 'utf8').trim() === buildRev;
  } catch {
    return false; // 마커 없음 = 이 로직 도입 이전 번들
  }
}

if (!distIsFresh()) {
  const reason = forceBuild
    ? '--force-build 지정'
    : !fs.existsSync(distPath)
      ? 'dist/ 없음'
      : 'dist/ 가 현재 소스와 불일치(stale)';
  console.log(`[e2e] 웹 번들 재빌드 — ${reason}`);
  commands.push({
    commandLine: 'npx expo export -p web',
    cwd: appRoot,
  });
}

// Playwright 직접 실행 (playwright.config.ts의 webServer가 npx serve dist 담당)
// --force-build 는 이 스크립트 전용 플래그라 playwright 로 넘기지 않는다.
const playwrightArgs = extraArgs.filter((argument) => argument !== '--force-build');
const playwrightCliCommand = [
  process.execPath,
  playwrightCliPath,
  'test',
  `--config=${playwrightConfigPath}`,
  ...playwrightArgs,
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
  // 이 단계 직전에 번들 최신성 마커를 남긴다 — 빌드가 성공했을 때만 도달하는 지점
  beforeRun: () => {
    if (buildRev && !buildRev.endsWith('-dirty') && fs.existsSync(distPath)) {
      fs.writeFileSync(buildRevPath, `${buildRev}\n`, 'utf8');
    }
  },
});

for (const { commandLine, cwd, beforeRun } of commands) {
  if (beforeRun) {
    beforeRun();
  }

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
