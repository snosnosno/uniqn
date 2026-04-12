#!/usr/bin/env node
/**
 * Typography Rollout Stage 4 — Body Text (Plus Jakarta Sans)
 *
 * @description text-sm/text-xs/text-base 본문 텍스트에 Plus Jakarta Sans
 *              (font-sans*) 폰트 패밀리를 적용. Weight 보존 전략으로
 *              기존 font-medium/semibold/bold를 font-sans-medium/-semibold/-bold로
 *              매핑한다.
 *
 * @patterns (총 21개, 결합 → 단독 순서로 적용)
 *   text-sm font-medium     → text-sm font-sans-medium
 *   text-sm font-semibold   → text-sm font-sans-semibold
 *   text-sm font-bold       → text-sm font-sans-bold
 *   text-sm                 → text-sm font-sans
 *   (text-xs / text-base 동일 패턴 + 순서 뒤집힌 변형)
 *
 * @stages
 *   4a: src/components/ui/
 *   4b: src/components/schedule/, src/components/employer/settlement/
 *   4c: src/components/admin/, src/components/support/
 *   4d: src/components/jobs/, src/components/applicant/, src/components/notifications/,
 *       src/components/employer/ (settlement 제외), src/components/board/,
 *       src/components/review/, src/components/typography/, src/hooks/
 *   4e: app/
 *
 * @usage
 *   node scripts/apply-typography-stage4-body.mjs --stage 4a --dry
 *   node scripts/apply-typography-stage4-body.mjs --stage 4a
 *   node scripts/apply-typography-stage4-body.mjs --stage 4a --verify
 *   node scripts/apply-typography-stage4-body.mjs --all --verify
 *
 * @flags
 *   --stage <id>  : 4a, 4b, 4c, 4d, 4e 중 하나
 *   --all         : 5개 스테이지 순차 실행 (커밋은 별도)
 *   --dry         : 쓰기 없이 미리보기만
 *   --verify      : 적용 후 type-check + lint + format:check + test 실행
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// ============================================================================
// 상수
// ============================================================================

/**
 * 변환 패턴 (총 21개)
 *
 * 중요: 결합 패턴(weight 포함)을 먼저, 단독 패턴을 마지막에 두어야
 * "text-sm font-medium" → "text-sm font-sans font-medium" 같은 오변환을 방지.
 */
const PATTERNS = [
  // text-sm 결합
  ['text-sm font-medium', 'text-sm font-sans-medium'],
  ['font-medium text-sm', 'font-sans-medium text-sm'],
  ['text-sm font-semibold', 'text-sm font-sans-semibold'],
  ['font-semibold text-sm', 'font-sans-semibold text-sm'],
  ['text-sm font-bold', 'text-sm font-sans-bold'],
  ['font-bold text-sm', 'font-sans-bold text-sm'],

  // text-xs 결합
  ['text-xs font-medium', 'text-xs font-sans-medium'],
  ['font-medium text-xs', 'font-sans-medium text-xs'],
  ['text-xs font-semibold', 'text-xs font-sans-semibold'],
  ['font-semibold text-xs', 'font-sans-semibold text-xs'],
  ['text-xs font-bold', 'text-xs font-sans-bold'],
  ['font-bold text-xs', 'font-sans-bold text-xs'],

  // text-base 결합
  ['text-base font-medium', 'text-base font-sans-medium'],
  ['font-medium text-base', 'font-sans-medium text-base'],
  ['text-base font-semibold', 'text-base font-sans-semibold'],
  ['font-semibold text-base', 'font-sans-semibold text-base'],
  ['text-base font-bold', 'text-base font-sans-bold'],
  ['font-bold text-base', 'font-sans-bold text-base'],

  // 단독 (반드시 마지막)
  ['text-sm', 'text-sm font-sans'],
  ['text-xs', 'text-xs font-sans'],
  ['text-base', 'text-base font-sans'],
];

/**
 * 디렉토리 그룹 (스테이지별 대상)
 *
 * 경로는 uniqn-mobile/ 기준 상대 경로.
 */
const DIR_GROUPS = {
  '4a': ['src/components/ui'],
  '4b': ['src/components/schedule', 'src/components/employer/settlement'],
  '4c': ['src/components/admin', 'src/components/support'],
  '4d': [
    'src/components/jobs',
    'src/components/applicant',
    'src/components/notifications',
    'src/components/employer/applicants',
    'src/components/employer/job-form',
    'src/components/employer/posting',
    'src/components/employer/dashboard',
    'src/components/board',
    'src/components/review',
    'src/components/typography',
    'src/components/auth',
    'src/components/modals',
    'src/components/tutorial',
    'src/components/app',
    'src/hooks',
  ],
  '4e': ['app'],
};

const ALL_STAGES = ['4a', '4b', '4c', '4d', '4e'];

// ============================================================================
// CLI 파싱
// ============================================================================

const args = process.argv.slice(2);
const stageArgIdx = args.indexOf('--stage');
const STAGE = stageArgIdx >= 0 ? args[stageArgIdx + 1] : null;
const ALL = args.includes('--all');
const DRY = args.includes('--dry');
const VERIFY = args.includes('--verify');

if (!STAGE && !ALL) {
  console.error('Usage: node scripts/apply-typography-stage4-body.mjs --stage <4a|4b|4c|4d|4e> [--dry] [--verify]');
  console.error('       node scripts/apply-typography-stage4-body.mjs --all [--dry] [--verify]');
  process.exit(1);
}

if (STAGE && !DIR_GROUPS[STAGE]) {
  console.error(`Unknown stage: ${STAGE}. Valid: ${Object.keys(DIR_GROUPS).join(', ')}`);
  process.exit(1);
}

// ============================================================================
// 함수
// ============================================================================

function ensureCleanWorkingTree() {
  // dry-run 모드는 워킹 트리를 건드리지 않으므로 가드 skip
  if (DRY) return;

  let status;
  try {
    status = execSync('git status --porcelain', { encoding: 'utf8' });
  } catch (error) {
    console.error('[stage4-body] git status 실패:', error.message);
    process.exit(1);
  }

  // 스크립트 자체가 untracked로 잡힐 수 있으므로 그것만 예외 처리
  const lines = status.split(/\r?\n/).filter(Boolean);
  const blocking = lines.filter(
    (line) => !line.includes('scripts/apply-typography-stage4-body.mjs')
  );

  if (blocking.length > 0) {
    console.error('[stage4-body] 워킹 트리가 깨끗하지 않습니다. 다음 변경을 먼저 정리해주세요:');
    for (const line of blocking) {
      console.error(`  ${line}`);
    }
    process.exit(1);
  }
}

function findCandidateFiles(dirs) {
  const rgPatterns = ['text-sm', 'text-xs', 'text-base']
    .map((p) => `-e "${p}"`)
    .join(' ');

  const dirArgs = dirs.map((d) => `"${d}"`).join(' ');
  const rgCmd = `npx --yes ripgrep --no-heading --files-with-matches ${rgPatterns} --glob "**/*.ts" --glob "**/*.tsx" ${dirArgs}`;

  let output;
  try {
    output = execSync(rgCmd, { encoding: 'utf8' });
  } catch (error) {
    // ripgrep은 매치 없을 때 exit 1을 반환 → 에러 아님
    if (error.status === 1 && !error.stderr) {
      return [];
    }
    console.error('[stage4-body] ripgrep 실행 실패:', error.message);
    process.exit(1);
  }

  return output.trim().split(/\r?\n/).filter(Boolean);
}

function applyPatternsToFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let updated = original;
  const replacements = [];

  for (const [from, to] of PATTERNS) {
    // 라인 단위로 처리하여 멱등성 가드 적용
    const lines = updated.split('\n');
    let lineReplacements = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.includes(from)) continue;

      // 가드 1: 이미 Plus Jakarta Sans 클래스가 있는 라인은 skip
      if (line.includes('font-sans')) continue;

      // 가드 2: Outfit 헤딩 라인은 절대 건드리지 않음
      if (line.includes('font-display')) continue;

      // 안전 치환: 한 라인 안에 from이 여러 번 있어도 모두 교체
      const parts = line.split(from);
      const replaced = parts.join(to);
      lines[i] = replaced;
      lineReplacements += parts.length - 1;
    }

    if (lineReplacements > 0) {
      updated = lines.join('\n');
      replacements.push({ from, to, count: lineReplacements });
    }
  }

  return { original, updated, replacements };
}

function runVerification() {
  const checks = [
    { name: 'type-check', cmd: 'npm run type-check' },
    { name: 'lint', cmd: 'npm run lint' },
    { name: 'format:check', cmd: 'npm run format:check' },
    { name: 'test', cmd: 'npm test -- --silent' },
  ];

  for (const check of checks) {
    console.log(`\n[stage4-body] running ${check.name}...`);
    try {
      execSync(check.cmd, { stdio: 'inherit' });
      console.log(`[stage4-body] ${check.name} ✓`);
    } catch (error) {
      console.error(`\n[stage4-body] ${check.name} 실패. 검증 중단.`);
      console.error('[stage4-body] 변경된 파일을 검토하고 수동 복구하세요:');
      console.error('  git status');
      console.error('  git diff');
      console.error('  git restore .   # 모든 변경 되돌리기');
      process.exit(1);
    }
  }

  console.log('\n[stage4-body] all checks passed ✓');
}

function runStage(stageId) {
  const dirs = DIR_GROUPS[stageId];
  if (!dirs) {
    console.error(`[stage4-body] unknown stage: ${stageId}`);
    process.exit(1);
  }

  console.log('\n========================================');
  console.log(`[stage4-body] STAGE ${stageId}`);
  console.log(`[stage4-body] dirs: ${dirs.join(', ')}`);
  console.log('========================================\n');

  const files = findCandidateFiles(dirs);
  console.log(`[stage4-body] ${files.length}개 후보 파일 발견\n`);

  let totalReplacements = 0;
  let touchedFiles = 0;
  const touchedList = [];

  for (const file of files) {
    const { updated, replacements } = applyPatternsToFile(file);
    if (replacements.length === 0) continue;

    touchedFiles += 1;
    touchedList.push(file);
    const fileTotal = replacements.reduce((sum, r) => sum + r.count, 0);
    totalReplacements += fileTotal;

    if (!DRY) {
      writeFileSync(file, updated, 'utf8');
    }

    console.log(`✓ ${file} (+${fileTotal})`);
    for (const r of replacements) {
      console.log(`    ${r.from} → ${r.to} ×${r.count}`);
    }
  }

  console.log(
    `\n[stage4-body] ${DRY ? '(dry) ' : ''}stage ${stageId}: ${touchedFiles}개 파일, 총 ${totalReplacements}건 교체`
  );

  return { touchedFiles, totalReplacements, touchedList };
}

// ============================================================================
// main
// ============================================================================

function main() {
  ensureCleanWorkingTree();

  const stages = ALL ? ALL_STAGES : [STAGE];

  for (const stageId of stages) {
    runStage(stageId);
  }

  if (VERIFY && !DRY) {
    runVerification();
  } else if (VERIFY && DRY) {
    console.log('\n[stage4-body] --dry 모드이므로 --verify를 건너뜁니다');
  }

  console.log('\n[stage4-body] 완료');
}

main();
