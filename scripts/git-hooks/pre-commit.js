#!/usr/bin/env node

const {
  chunk,
  cmd,
  fileExists,
  getStagedFiles,
  matchesExtension,
  relativeTo,
  runOrExit,
  uniqnMobileDir,
} = require('./shared');

const ESLINT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const PRETTIER_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
const CHUNK_SIZE = 50;

function main() {
  console.log('[hook] pre-commit: staged 파일 검사');

  if (!fileExists(pathJoin(uniqnMobileDir, 'package.json'))) {
    console.log('[hook] pre-commit: uniqn-mobile/package.json 없음, 검사 생략');
    return;
  }

  let stagedFiles;
  try {
    stagedFiles = getStagedFiles();
  } catch (error) {
    console.log('[hook] pre-commit: staged 파일 조회 실패, 전체 모바일 검사로 대체');
    console.log(`[hook] pre-commit: ${String(error.message || error)}`);
    runFallbackChecks();
    return;
  }

  const mobileFiles = stagedFiles.filter((file) => file.startsWith('uniqn-mobile/'));

  if (mobileFiles.length === 0) {
    console.log('[hook] pre-commit: uniqn-mobile 변경 없음, 검사 생략');
    return;
  }

  const path = require('path');

  const eslintTargets = mobileFiles
    .filter((file) => matchesExtension(file, ESLINT_EXTENSIONS))
    .map((file) => relativeTo(uniqnMobileDir, file))
    .filter((rel) => fileExists(path.join(uniqnMobileDir, rel)));

  const prettierTargets = mobileFiles
    .filter((file) => matchesExtension(file, PRETTIER_EXTENSIONS))
    .map((file) => relativeTo(uniqnMobileDir, file))
    .filter((rel) => fileExists(path.join(uniqnMobileDir, rel)));

  if (eslintTargets.length > 0) {
    console.log(`[hook] pre-commit: ESLint --fix (${eslintTargets.length}개 파일)`);
    for (const files of chunk(eslintTargets, CHUNK_SIZE)) {
      runOrExit(cmd('npx'), ['eslint', '--fix', ...files], { cwd: uniqnMobileDir });
    }
  }

  if (prettierTargets.length > 0) {
    console.log(`[hook] pre-commit: Prettier --write (${prettierTargets.length}개 파일)`);
    for (const files of chunk(prettierTargets, CHUNK_SIZE)) {
      runOrExit(cmd('npx'), ['prettier', '--write', ...files], { cwd: uniqnMobileDir });
    }
  }

  if (eslintTargets.length > 0 || prettierTargets.length > 0) {
    console.log('[hook] pre-commit: 수정 파일 재스테이징');
    runOrExit('git', ['add', '--', ...mobileFiles]);
  }

  console.log('[hook] pre-commit: 완료');
}

function pathJoin(...segments) {
  return require('path').join(...segments);
}

function runFallbackChecks() {
  console.log('[hook] pre-commit: uniqn-mobile npm run lint');
  runOrExit(cmd('npm'), ['run', 'lint'], { cwd: uniqnMobileDir });

  console.log('[hook] pre-commit: uniqn-mobile npm run format:check');
  runOrExit(cmd('npm'), ['run', 'format:check'], { cwd: uniqnMobileDir });

  console.log('[hook] pre-commit: fallback 검사 완료');
}

main();
