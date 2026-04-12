#!/usr/bin/env node
/**
 * Typography Rollout Stage 2
 *
 * @description Stage 1의 주요 화면 기반 이후, 나머지 src/components + app/*에서
 *              heading-like Tailwind 클래스를 Outfit 기반 font-display* 로 교체.
 *              텍스트 크기와 weight이 adjacent한 atomic 패턴만 교체하므로
 *              순서 뒤집힌 변형은 건드리지 않음.
 *
 * @patterns
 *   text-3xl font-bold      → text-3xl font-display-bold   (H1 36/800)
 *   text-2xl font-bold      → text-2xl font-display        (H2 28/700)
 *   text-2xl font-semibold  → text-2xl font-display-semibold
 *   text-xl  font-bold      → text-xl  font-display        (H3-ish 22/700)
 *   text-xl  font-semibold  → text-xl  font-display-semibold
 *   text-lg  font-bold      → text-lg  font-display        (H4-ish 18/700)
 *   text-lg  font-semibold  → text-lg  font-display-semibold
 *
 * @usage  node scripts/apply-typography-stage2.mjs [--dry]
 *         --dry: 쓰기 없이 미리보기만
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');

// atomic find/replace pairs (정확히 인접한 경우만 매치되도록 공백 1개)
const PATTERNS = [
  ['text-3xl font-bold', 'text-3xl font-display-bold'],
  ['text-2xl font-bold', 'text-2xl font-display'],
  ['text-2xl font-semibold', 'text-2xl font-display-semibold'],
  ['text-xl font-bold', 'text-xl font-display'],
  ['text-xl font-semibold', 'text-xl font-display-semibold'],
  ['text-lg font-bold', 'text-lg font-display'],
  ['text-lg font-semibold', 'text-lg font-display-semibold'],
];

// 패턴 중 하나라도 포함하는 파일 목록 (ripgrep으로 수집)
const rgCmd =
  'npx --yes ripgrep --no-heading --files-with-matches ' +
  '-e "text-3xl font-bold" ' +
  '-e "text-2xl font-bold" ' +
  '-e "text-2xl font-semibold" ' +
  '-e "text-xl font-bold" ' +
  '-e "text-xl font-semibold" ' +
  '-e "text-lg font-bold" ' +
  '-e "text-lg font-semibold" ' +
  '--glob "**/*.ts" --glob "**/*.tsx" src app';

let fileList;
try {
  fileList = execSync(rgCmd, { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
} catch (error) {
  console.error('[typography-stage2] ripgrep 실행 실패:', error.message);
  process.exit(1);
}

console.log(`[typography-stage2] ${fileList.length}개 파일 발견 (dry=${DRY})\n`);

let totalReplacements = 0;
let touchedFiles = 0;

for (const file of fileList) {
  const original = readFileSync(file, 'utf8');
  let updated = original;
  const fileReplacements = [];

  for (const [from, to] of PATTERNS) {
    // split/join은 regex 특수문자 걱정 없이 모든 occurrence 교체
    const parts = updated.split(from);
    if (parts.length > 1) {
      const count = parts.length - 1;
      updated = parts.join(to);
      fileReplacements.push(`${from} → ${to} ×${count}`);
      totalReplacements += count;
    }
  }

  if (updated !== original) {
    touchedFiles += 1;
    if (!DRY) {
      writeFileSync(file, updated, 'utf8');
    }
    console.log(`✓ ${file}`);
    for (const r of fileReplacements) {
      console.log(`    ${r}`);
    }
  }
}

console.log(
  `\n[typography-stage2] ${DRY ? '(dry) ' : ''}${touchedFiles}개 파일, 총 ${totalReplacements}건 교체`
);
