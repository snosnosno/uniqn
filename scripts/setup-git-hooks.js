#!/usr/bin/env node
/**
 * T-HOLDEM Git hooks 설치 스크립트
 *
 * 최신 기준:
 * - pre-commit: uniqn-mobile staged 파일만 빠르게 정리
 * - pre-push: uniqn-mobile quality + functions build
 * - post-commit: 사용하지 않음
 *
 * 사용법:
 *   node scripts/setup-git-hooks.js
 *   node scripts/setup-git-hooks.js --remove
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
// 워크트리에서는 .git 이 파일(포인터)이라 .git/hooks 하드코딩이 ENOTDIR로 실패한다.
// git 이 실제 hooks 경로를 알고 있으므로 rev-parse 로 해석 (실패 시 기존 경로 폴백).
const hooksDir = resolveHooksDir();

function resolveHooksDir() {
  try {
    const resolved = execSync('git rev-parse --git-path hooks', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.isAbsolute(resolved) ? resolved : path.resolve(repoRoot, resolved);
  } catch {
    return path.join(repoRoot, '.git', 'hooks');
  }
}
const marker = 'T-HOLDEM managed hook';
const nodePath = process.execPath.replace(/\\/g, '/');

const hookTargets = {
  'pre-commit': '../../scripts/git-hooks/pre-commit.js',
  'pre-push': '../../scripts/git-hooks/pre-push.js',
};

function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--help') || args.has('-h')) {
    printHelp();
    return;
  }

  ensureGitRepository();
  ensureHooksDirectory();

  if (args.has('--remove') || args.has('-r')) {
    removeManagedHooks();
    return;
  }

  installHooks();
}

function printHelp() {
  console.log(`
T-HOLDEM Git hooks 설정 도구

사용법:
  node scripts/setup-git-hooks.js
  node scripts/setup-git-hooks.js --remove

설치되는 hooks:
  - pre-commit: uniqn-mobile staged 파일 ESLint/Prettier 정리
  - pre-push: uniqn-mobile quality + functions build
  - post-commit: 설치하지 않음
  `);
}

function ensureGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    console.error('❌ Git 저장소가 아닙니다.');
    process.exit(1);
  }
}

function ensureHooksDirectory() {
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
}

function installHooks() {
  console.log('🔧 최신 Git hooks 설치 시작');

  for (const [hookName, targetScript] of Object.entries(hookTargets)) {
    backupExistingHook(hookName);
    const hookPath = path.join(hooksDir, hookName);
    fs.writeFileSync(hookPath, buildHookWrapper(targetScript), 'utf8');
    console.log(`✅ ${hookName} 설치 완료`);
  }

  removeHookIfManaged('post-commit');

  console.log('ℹ️ post-commit은 최신 기준에서 제거되었습니다.');
  console.log('🎉 Git hooks 설치 완료');
}

function removeManagedHooks() {
  console.log('🗑️ 관리 중인 Git hooks 제거');

  for (const hookName of [...Object.keys(hookTargets), 'post-commit']) {
    removeHookIfManaged(hookName);
    restoreBackupIfExists(hookName);
  }

  console.log('🎉 Git hooks 제거 완료');
}

function buildHookWrapper(targetScript) {
  return `#!${nodePath}
// ${marker}
require('${targetScript.replace(/\\/g, '/')}');
`;
}

function backupExistingHook(hookName) {
  const hookPath = path.join(hooksDir, hookName);
  const backupPath = path.join(hooksDir, `${hookName}.backup`);

  if (!fs.existsSync(hookPath) || isManagedHook(hookPath) || fs.existsSync(backupPath)) {
    return;
  }

  fs.copyFileSync(hookPath, backupPath);
  console.log(`📦 ${hookName} 기존 hook 백업`);
}

function restoreBackupIfExists(hookName) {
  const hookPath = path.join(hooksDir, hookName);
  const backupPath = path.join(hooksDir, `${hookName}.backup`);

  if (fs.existsSync(hookPath) || !fs.existsSync(backupPath)) {
    return;
  }

  fs.renameSync(backupPath, hookPath);
  console.log(`♻️ ${hookName} 백업 복원`);
}

function removeHookIfManaged(hookName) {
  const hookPath = path.join(hooksDir, hookName);
  if (fs.existsSync(hookPath) && isManagedHook(hookPath)) {
    fs.unlinkSync(hookPath);
    console.log(`🗑️ ${hookName} 제거`);
  }
}

function isManagedHook(hookPath) {
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, 'utf8');
  return content.includes(marker) || content.includes('T-HOLDEM Pre-commit Hook') || content.includes('T-HOLDEM Pre-push Hook') || content.includes('T-HOLDEM Post-commit Hook');
}

main();
