# Typography Stage 4 (Body Text) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plus Jakarta Sans 본문 폰트를 1,800+ 건의 본문/캡션 `<Text>` 요소에 시각적 회귀 없이 도입한다.

**Architecture:** 단일 변환 스크립트(`apply-typography-stage4-body.mjs`)가 21개 패턴 × 5개 디렉토리 그룹을 처리. Stage 2 스크립트의 split/join atomic 치환 패턴을 재사용하면서, weight 보존(font-medium → font-sans-medium)과 멱등성 가드(font-sans/font-display 중복 방지), 워킹 트리 안전 가드, 자동 검증 wrapper를 추가한다. 5개 디렉토리 그룹 각각을 별도 커밋으로 분리해 회귀 추적과 부분 revert를 가능하게 한다.

**Tech Stack:** Node.js (ESM), ripgrep (npx --yes), git, npm scripts (type-check + lint + format:check + test)

**Spec:** `docs/superpowers/specs/2026-04-12-typography-stage4-body-design.md`

---

## File Structure

| 파일 | 역할 | 변경 |
|------|------|------|
| `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` | Stage 4 변환 스크립트 (21 패턴, 5 그룹, 검증 포함) | **신규** |
| `uniqn-mobile/scripts/apply-typography-stage2.mjs` | 참고용 (Stage 2 원본) | 변경 없음 |
| `uniqn-mobile/src/components/ui/**/*.tsx` | 4-a 대상 (UI 기초 컴포넌트) | 자동 수정 |
| `uniqn-mobile/src/components/schedule/**/*.tsx` | 4-b 대상 (일정) | 자동 수정 |
| `uniqn-mobile/src/components/employer/settlement/**/*.tsx` | 4-b 대상 (정산) | 자동 수정 |
| `uniqn-mobile/src/components/admin/**/*.tsx` | 4-c 대상 (관리자) | 자동 수정 |
| `uniqn-mobile/src/components/support/**/*.tsx` | 4-c 대상 (지원) | 자동 수정 |
| `uniqn-mobile/src/components/jobs/**/*.tsx` 외 | 4-d 대상 (구인·기타) | 자동 수정 |
| `uniqn-mobile/app/**/*.tsx` | 4-e 대상 (라우트 화면) | 자동 수정 |

---

## Pre-flight Checklist

작업 시작 전 확인:

- [ ] **현재 브랜치는 master**, working tree clean (`git status` → "nothing to commit, working tree clean")
- [ ] **최근 커밋 확인**: `git log --oneline -5`에서 다음이 보여야 함
  ```
  7aab6f96c docs(design): 타이포그래피 Stage 4 (Body) 설계안 작성
  c32991172 feat(design): 네이티브 Stack 헤더에 Outfit fontFamily 주입
  d455a1989 feat(design): 타이포그래피 롤아웃 Stage 2 ...
  21deded1c feat(design): 타이포그래피 롤아웃 Stage 1 ...
  ```
- [ ] **베이스라인 검증**: `cd uniqn-mobile && npm run quality && npm test`가 통과해야 함
  - 통과하지 않으면 Stage 4를 시작하기 전에 별도로 해결해야 함

---

## Task 1: 스크립트 스켈레톤 생성 (상수 + CLI 파싱)

**Files:**
- Create: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs`

- [ ] **Step 1: 스크립트 파일 생성**

전체 파일 내용 (이후 Task에서 함수 본문이 계속 추가됨):

```javascript
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
// 함수 (Task 2~5에서 본문 추가)
// ============================================================================

function ensureCleanWorkingTree() {
  // Task 2에서 구현
  throw new Error('not implemented');
}

function findCandidateFiles(dirs) {
  // Task 3에서 구현
  throw new Error('not implemented');
}

function applyPatternsToFile(filePath) {
  // Task 4에서 구현
  throw new Error('not implemented');
}

function runVerification() {
  // Task 5에서 구현
  throw new Error('not implemented');
}

function runStage(stageId) {
  // Task 6에서 구현
  throw new Error('not implemented');
}

// ============================================================================
// main
// ============================================================================

function main() {
  // Task 6에서 구현
  console.log('[stage4-body] not yet implemented');
}

main();
```

- [ ] **Step 2: 파일 생성 후 구문 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a`
Expected: `[stage4-body] not yet implemented` 출력 후 종료 (코드 0)

- [ ] **Step 3: 잘못된 stage 인자 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 9z`
Expected: `Unknown stage: 9z. Valid: 4a, 4b, 4c, 4d, 4e` 출력 후 종료 (코드 1)

- [ ] **Step 4: 인자 없을 때 에러 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs`
Expected: `Usage: ...` 출력 후 종료 (코드 1)

---

## Task 2: 워킹 트리 안전 가드 구현

**Files:**
- Modify: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (`ensureCleanWorkingTree` 함수)

- [ ] **Step 1: `ensureCleanWorkingTree` 함수 본문 작성**

`throw new Error('not implemented');` 라인을 다음으로 교체:

```javascript
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
```

- [ ] **Step 2: main() 임시 호출 추가하여 가드 동작 확인**

main() 함수 안의 `console.log('[stage4-body] not yet implemented');` 위에 추가:

```javascript
function main() {
  ensureCleanWorkingTree();
  console.log('[stage4-body] working tree clean');
  console.log('[stage4-body] not yet implemented');
}
```

- [ ] **Step 3: 클린 트리에서 가드 통과 확인**

Run: `cd uniqn-mobile && git status --porcelain | grep -v "scripts/apply-typography-stage4-body.mjs"`
Expected: 빈 출력 (스크립트만 untracked)

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a`
Expected: `[stage4-body] working tree clean` 다음 `[stage4-body] not yet implemented`

- [ ] **Step 4: 더티 트리 시뮬레이션 (선택, 시간 1분)**

Run:
```bash
cd uniqn-mobile && echo "// dirty" >> src/components/ui/Button.tsx
node scripts/apply-typography-stage4-body.mjs --stage 4a
```
Expected: `[stage4-body] 워킹 트리가 깨끗하지 않습니다...` 출력 후 exit 1

복원: `cd uniqn-mobile && git restore src/components/ui/Button.tsx`

- [ ] **Step 5: dry-run에서는 가드 skip 확인**

Run: `cd uniqn-mobile && echo "// dirty" >> src/components/ui/Button.tsx && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry`
Expected: `not yet implemented` 출력 (가드 skip됨, "working tree clean" 출력은 안 됨)

복원: `cd uniqn-mobile && git restore src/components/ui/Button.tsx`

---

## Task 3: 후보 파일 검색 함수 (`findCandidateFiles`)

**Files:**
- Modify: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (`findCandidateFiles` 함수)

- [ ] **Step 1: `findCandidateFiles` 본문 작성**

```javascript
function findCandidateFiles(dirs) {
  // 21개 패턴을 ripgrep -e 인자로 전달
  // text-sm/xs/base가 들어있는 파일을 모두 후보로 잡음 (가장 넓은 매치)
  const rgPatterns = [
    'text-sm',
    'text-xs',
    'text-base',
  ].map((p) => `-e "${p}"`).join(' ');

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
```

- [ ] **Step 2: main() 수정하여 후보 파일 카운트 확인**

```javascript
function main() {
  ensureCleanWorkingTree();

  const stageId = STAGE || ALL_STAGES[0];
  const dirs = DIR_GROUPS[stageId];
  console.log(`[stage4-body] stage ${stageId}, dirs:`, dirs);

  const files = findCandidateFiles(dirs);
  console.log(`[stage4-body] ${files.length}개 후보 파일 발견`);
  for (const f of files.slice(0, 5)) {
    console.log(`  ${f}`);
  }
  if (files.length > 5) console.log(`  ... ${files.length - 5}개 더`);
}
```

- [ ] **Step 3: 4a 후보 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry`
Expected: `[stage4-body] N개 후보 파일 발견` (N은 약 25-35), 파일 5개 미리보기

- [ ] **Step 4: 4e (app/) 후보 검증 — 가장 큰 그룹**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4e --dry`
Expected: `[stage4-body] N개 후보 파일 발견` (N은 약 60-80)

- [ ] **Step 5: 매치 0건 처리 검증 (선택)**

존재하지 않는 디렉토리로 임시 변경 후 확인:
```javascript
// 임시: DIR_GROUPS['4a'] = ['src/components/__nonexistent__'];
```
Run: 4a dry → `0개 후보 파일 발견`
복원 후 다음 단계로.

---

## Task 4: 파일별 패턴 적용 함수 (`applyPatternsToFile`) — 멱등성 가드 포함

**Files:**
- Modify: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (`applyPatternsToFile` 함수)

- [ ] **Step 1: `applyPatternsToFile` 본문 작성**

```javascript
function applyPatternsToFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let updated = original;
  const replacements = [];

  for (const [from, to] of PATTERNS) {
    // 단순 split/join은 모든 occurrence를 일괄 치환하기 때문에
    // 멱등성 가드를 위해 라인 단위로 처리하면서, 이미 font-sans 또는
    // font-display가 포함된 라인은 skip한다.
    const lines = updated.split('\n');
    let lineReplacements = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.includes(from)) continue;

      // 가드 1: 이미 Plus Jakarta Sans 클래스가 있는 라인은 skip
      // (멱등성: 두 번째 실행해도 변경 없음)
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
```

- [ ] **Step 2: main() 수정하여 단일 파일 적용 미리보기**

```javascript
function main() {
  ensureCleanWorkingTree();

  const stageId = STAGE || ALL_STAGES[0];
  const dirs = DIR_GROUPS[stageId];
  const files = findCandidateFiles(dirs);

  console.log(`[stage4-body] stage ${stageId}: ${files.length}개 후보 파일\n`);

  let totalReplacements = 0;
  let touchedFiles = 0;

  for (const file of files) {
    const { original, updated, replacements } = applyPatternsToFile(file);
    if (replacements.length === 0) continue;

    touchedFiles += 1;
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

  console.log(`\n[stage4-body] ${DRY ? '(dry) ' : ''}stage ${stageId}: ${touchedFiles}개 파일, 총 ${totalReplacements}건 교체`);
}
```

- [ ] **Step 3: 4a dry-run 실행 — 변환 내용 확인**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry`
Expected:
- `N개 파일, 총 M건 교체` (M은 약 100-200)
- 각 파일별 변환 라인이 보임
- 워킹 트리에 변경 없음 확인: `git status --porcelain | grep -v scripts/apply-typography-stage4` → 빈 출력

- [ ] **Step 4: 멱등성 검증 — 동일 dry-run 두 번 실행**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry`
Expected: 첫 실행과 동일한 출력 (스크립트가 파일을 쓰지 않으므로 매번 동일)

- [ ] **Step 5: 가드 동작 검증 — 인위적 멱등성 테스트**

선택적 검증 (시간 2분). 한 파일에서 이미 변환된 상태를 가정하고 적용해도 변경이 없어야 함:

Run:
```bash
cd uniqn-mobile && cat > /tmp/stage4-test.tsx <<'EOF'
import { Text } from 'react-native';
export const A = () => <Text className="text-sm font-sans">already</Text>;
export const B = () => <Text className="text-sm">target</Text>;
export const C = () => <Text className="text-lg font-display">heading</Text>;
EOF
```

스크립트를 임시로 수정해 단일 파일을 처리하도록 만들거나, 또는 직접 함수를 inline 호출해서 결과 확인:
```bash
node -e "
import('./scripts/apply-typography-stage4-body.mjs').catch(()=>{});
import { applyPatternsToFile } from './scripts/apply-typography-stage4-body.mjs';
" 2>&1 || echo "ESM dynamic import 제한, skip"
```

(스킵 가능 — 실제 검증은 Task 7의 dry-run으로 충분)

- [ ] **Step 6: 임시 테스트 파일 제거**

Run: `rm -f /tmp/stage4-test.tsx`

---

## Task 5: 검증 wrapper (`runVerification`)

**Files:**
- Modify: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (`runVerification` 함수)

- [ ] **Step 1: `runVerification` 본문 작성**

```javascript
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
      console.error(`[stage4-body] 변경된 파일을 검토하고 수동 복구하세요:`);
      console.error(`  git status`);
      console.error(`  git diff`);
      console.error(`  git restore .   # 모든 변경 되돌리기`);
      process.exit(1);
    }
  }

  console.log('\n[stage4-body] all checks passed ✓');
}
```

- [ ] **Step 2: 함수 단독 호출 테스트 (옵션)**

Run: `cd uniqn-mobile && node -e "import('./scripts/apply-typography-stage4-body.mjs')"`
Expected: 정상 실행 (main 호출됨, --stage 없으므로 Usage 출력 후 exit 1)

(검증 자체는 Task 8 첫 실행 때 자연스럽게 발동됨)

---

## Task 6: 스테이지 오케스트레이션 (`runStage` + `main` 완성)

**Files:**
- Modify: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (`runStage`, `main` 함수)

- [ ] **Step 1: `runStage` 본문 작성**

```javascript
function runStage(stageId) {
  const dirs = DIR_GROUPS[stageId];
  if (!dirs) {
    console.error(`[stage4-body] unknown stage: ${stageId}`);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`[stage4-body] STAGE ${stageId}`);
  console.log(`[stage4-body] dirs: ${dirs.join(', ')}`);
  console.log(`========================================\n`);

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

  console.log(`\n[stage4-body] ${DRY ? '(dry) ' : ''}stage ${stageId}: ${touchedFiles}개 파일, 총 ${totalReplacements}건 교체`);

  return { touchedFiles, totalReplacements, touchedList };
}
```

- [ ] **Step 2: `main` 본문 완성 — `--all` 분기 + `--verify` 호출**

기존 main() 전체 교체:

```javascript
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
```

- [ ] **Step 3: 4a dry-run 전체 흐름 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry`
Expected:
- `[stage4-body] STAGE 4a` 헤더
- 후보 파일 목록 + 변환 내용
- `[stage4-body] (dry) stage 4a: N개 파일, 총 M건 교체`
- `[stage4-body] 완료`
- 워킹 트리 변경 없음

- [ ] **Step 4: --all --dry 전체 5스테이지 미리보기**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --all --dry`
Expected: 4a → 4b → 4c → 4d → 4e 순차 출력, 각 스테이지마다 헤더와 통계, 마지막 "완료"

- [ ] **Step 5: 스크립트 자체를 첫 커밋에 포함하기 위해 commit 준비**

Run: `cd uniqn-mobile && git status --porcelain`
Expected: `?? scripts/apply-typography-stage4-body.mjs` (untracked)

(아직 commit하지 않음 — Task 8의 첫 commit에 함께 포함)

---

## Task 7: Stage 4-a 최종 dry-run 검토 + 사용자 승인 체크포인트

**Files:** (변경 없음, 검토만)

- [ ] **Step 1: 4a dry-run 출력을 파일로 저장**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --dry > /tmp/stage4a-preview.log 2>&1`

- [ ] **Step 2: 통계 라인 확인**

Run: `tail -5 /tmp/stage4a-preview.log`
Expected: `[stage4-body] (dry) stage 4a: ...개 파일, 총 ...건 교체`

- [ ] **Step 3: 변환 패턴 분포 확인**

Run: `grep "→" /tmp/stage4a-preview.log | sort | uniq -c | sort -rn | head -20`
Expected: 패턴별 발생 횟수 분포 (text-sm font-sans가 가장 많을 것으로 예상)

- [ ] **Step 4: 헤딩 침범 검증 (font-display 라인 없어야 함)**

Run: `grep "font-display" /tmp/stage4a-preview.log | grep -v "^\\["`
Expected: 빈 출력 (스크립트 실행 메시지 제외하고는 font-display 변환 없음 — 가드가 정상 작동 확인)

- [ ] **Step 5: 멱등성 토큰 검증 — font-sans 중복 없음**

Run: `grep "font-sans font-sans" /tmp/stage4a-preview.log`
Expected: 빈 출력

- [ ] **Step 6: 사용자 체크포인트 — 진행 승인 요청**

이 시점에서 사용자에게 보고:
> "Stage 4-a dry-run 완료. N개 파일 / M건 교체 예정. 헤딩 침범 0건, 중복 적용 0건. 실제 적용 진행할까요?"

승인 후 Task 8로 진행.

---

## Task 8: Stage 4-a 실제 적용 + 검증 + 커밋

**Files:**
- Modify: `uniqn-mobile/src/components/ui/**/*.tsx` (스크립트가 자동 수정)
- Create: `uniqn-mobile/scripts/apply-typography-stage4-body.mjs` (이 커밋에 처음 포함됨)

- [ ] **Step 1: 워킹 트리 클린 재확인**

Run: `cd uniqn-mobile && git status --porcelain | grep -v scripts/apply-typography-stage4-body.mjs`
Expected: 빈 출력 (스크립트만 untracked, 다른 변경 없음)

- [ ] **Step 2: Stage 4-a 적용 + 자동 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4a --verify`
Expected:
- 4a 변환 적용 출력
- type-check 통과
- lint 통과
- format:check 통과
- test 통과 (204 스위트 / 3361 테스트)
- `all checks passed ✓`

검증이 실패하면 절대 다음 단계로 진행하지 말 것. 실패 원인을 진단하고 fix:
- format:check 실패 → `npm run format`로 자동 포맷 후 재검증
- 스냅샷 테스트 실패 → 의도된 변경임을 확인 후 `npm test -- -u`로 갱신
- type-check / lint 실패 → 변경된 파일을 직접 검토

- [ ] **Step 3: 변경 파일 목록 캡처**

Run: `cd uniqn-mobile && git status --porcelain`
Expected: `M src/components/ui/...` 라인 여러 개 + `?? scripts/apply-typography-stage4-body.mjs`

Run: `cd uniqn-mobile && git diff --stat | tail -5`
Expected: 변경 라인 수 요약 (예: `25 files changed, 130 insertions(+), 130 deletions(-)`)

- [ ] **Step 4: 명시적 git add (pre-commit 훅 자동 재스테이징 회피)**

Run:
```bash
cd uniqn-mobile && git add scripts/apply-typography-stage4-body.mjs $(git status --porcelain | grep "^.M" | awk '{print $2}')
```

(또는 ui 디렉토리만 명시적으로:)
```bash
cd uniqn-mobile && git add scripts/apply-typography-stage4-body.mjs src/components/ui/
```

- [ ] **Step 5: 스테이지 상태 최종 확인**

Run: `cd uniqn-mobile && git status`
Expected: `Changes to be committed:` 섹션에 ui 파일들과 스크립트, 다른 변경 없음

- [ ] **Step 6: 커밋 생성**

Run:
```bash
cd uniqn-mobile && git commit -m "$(cat <<'EOF'
feat(design): 타이포그래피 Stage 4-a — UI 기초 컴포넌트 본문 폰트

src/components/ui/ 본문 텍스트(text-sm/xs/base)에 Plus Jakarta Sans
(font-sans*) 폰트 패밀리 적용. Weight 보존 전략으로 기존
font-medium/semibold/bold를 font-sans-medium/-semibold/-bold로 매핑.

스크립트: scripts/apply-typography-stage4-body.mjs (Stage 4 변환 도구)
- 21개 패턴 (결합 → 단독 순서로 멱등성 보장)
- font-sans/font-display 가드로 헤딩 침범·중복 적용 방지
- 워킹 트리 클린 가드 + --verify 통합 검증

검증: type-check + lint + format:check + test 모두 통과

선행: 7aab6f96c (Stage 4 설계안)
EOF
)"
```

- [ ] **Step 7: 커밋 검증**

Run: `cd uniqn-mobile && git log --oneline -1 && git show --stat HEAD | tail -10`
Expected: 새 커밋 해시 + 변경 파일 요약

---

## Task 9: Stage 4-b 적용 + 검증 + 커밋 (schedule + settlement)

**Files:**
- Modify: `uniqn-mobile/src/components/schedule/**/*.tsx`
- Modify: `uniqn-mobile/src/components/employer/settlement/**/*.tsx`

- [ ] **Step 1: 4b dry-run 미리보기**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4b --dry > /tmp/stage4b-preview.log 2>&1 && tail -5 /tmp/stage4b-preview.log`
Expected: `(dry) stage 4b: N개 파일, 총 M건 교체` (N은 약 60-80, M은 약 300-450)

- [ ] **Step 2: 헤딩 침범 0건 재확인**

Run: `grep "font-display" /tmp/stage4b-preview.log | grep -v "^\\["`
Expected: 빈 출력

- [ ] **Step 3: 4b 실제 적용 + 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4b --verify`
Expected: 모든 검증 통과 (`all checks passed ✓`)

- [ ] **Step 4: 명시적 add**

Run:
```bash
cd uniqn-mobile && git add src/components/schedule/ src/components/employer/settlement/
```

- [ ] **Step 5: 변경 사항 확인**

Run: `cd uniqn-mobile && git status`
Expected: schedule/ + employer/settlement/ 파일들만 staged, 다른 디렉토리 변경 없음

- [ ] **Step 6: 커밋**

Run:
```bash
cd uniqn-mobile && git commit -m "$(cat <<'EOF'
feat(design): 타이포그래피 Stage 4-b — 일정·정산 화면 본문 폰트

src/components/schedule/ + src/components/employer/settlement/ 본문
텍스트에 Plus Jakarta Sans 적용. 정산 카드의 금액 표시(text-base
font-bold 등)는 옵션 ⓐ 결정에 따라 본문(font-sans-bold)으로 처리.
Tabular Numbers 정렬은 Stage 5로 분리.

검증: type-check + lint + format:check + test 모두 통과
EOF
)"
```

- [ ] **Step 7: 커밋 확인**

Run: `cd uniqn-mobile && git log --oneline -2`

---

## Task 10: Stage 4-c 적용 + 검증 + 커밋 (admin + support)

**Files:**
- Modify: `uniqn-mobile/src/components/admin/**/*.tsx`
- Modify: `uniqn-mobile/src/components/support/**/*.tsx`

- [ ] **Step 1: 4c dry-run 미리보기**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4c --dry > /tmp/stage4c-preview.log 2>&1 && tail -5 /tmp/stage4c-preview.log`
Expected: 통계 라인

- [ ] **Step 2: 헤딩 침범 검증**

Run: `grep "font-display" /tmp/stage4c-preview.log | grep -v "^\\["`
Expected: 빈 출력

- [ ] **Step 3: 4c 적용 + 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4c --verify`
Expected: `all checks passed ✓`

- [ ] **Step 4: 명시적 add**

Run:
```bash
cd uniqn-mobile && git add src/components/admin/ src/components/support/
```

- [ ] **Step 5: 커밋**

Run:
```bash
cd uniqn-mobile && git commit -m "$(cat <<'EOF'
feat(design): 타이포그래피 Stage 4-c — 관리자·지원 화면 본문 폰트

src/components/admin/ + src/components/support/ 본문 텍스트에
Plus Jakarta Sans 적용. 공지 카드, 통계 차트, 신고/지원 화면 등.

검증: type-check + lint + format:check + test 모두 통과
EOF
)"
```

- [ ] **Step 6: 커밋 확인**

Run: `cd uniqn-mobile && git log --oneline -3`

---

## Task 11: Stage 4-d 적용 + 검증 + 커밋 (jobs + applicant + 기타 src)

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/**/*.tsx`
- Modify: `uniqn-mobile/src/components/applicant/**/*.tsx`
- Modify: `uniqn-mobile/src/components/notifications/**/*.tsx`
- Modify: `uniqn-mobile/src/components/employer/applicants/**/*.tsx`
- Modify: `uniqn-mobile/src/components/employer/job-form/**/*.tsx`
- Modify: `uniqn-mobile/src/components/employer/posting/**/*.tsx`
- Modify: `uniqn-mobile/src/components/employer/dashboard/**/*.tsx`
- Modify: `uniqn-mobile/src/components/board/**/*.tsx`
- Modify: `uniqn-mobile/src/components/review/**/*.tsx`
- Modify: `uniqn-mobile/src/components/typography/**/*.tsx`
- Modify: `uniqn-mobile/src/components/auth/**/*.tsx`
- Modify: `uniqn-mobile/src/components/modals/**/*.tsx`
- Modify: `uniqn-mobile/src/components/tutorial/**/*.tsx`
- Modify: `uniqn-mobile/src/components/app/**/*.tsx`
- Modify: `uniqn-mobile/src/hooks/**/*.tsx`

- [ ] **Step 1: 4d dry-run 미리보기**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4d --dry > /tmp/stage4d-preview.log 2>&1 && tail -5 /tmp/stage4d-preview.log`
Expected: 가장 큰 통계 (약 100-150 파일)

- [ ] **Step 2: 헤딩 침범 검증**

Run: `grep "font-display" /tmp/stage4d-preview.log | grep -v "^\\["`
Expected: 빈 출력

- [ ] **Step 3: 4d 적용 + 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4d --verify`
Expected: `all checks passed ✓`

이 단계가 가장 큰 배치이므로 검증 시간이 가장 길 수 있음 (~2-3분).

- [ ] **Step 4: 명시적 add (디렉토리 단위)**

Run:
```bash
cd uniqn-mobile && git add \
  src/components/jobs/ \
  src/components/applicant/ \
  src/components/notifications/ \
  src/components/employer/applicants/ \
  src/components/employer/job-form/ \
  src/components/employer/posting/ \
  src/components/employer/dashboard/ \
  src/components/board/ \
  src/components/review/ \
  src/components/typography/ \
  src/components/auth/ \
  src/components/modals/ \
  src/components/tutorial/ \
  src/components/app/ \
  src/hooks/
```

- [ ] **Step 5: 잔여 변경 없음 확인**

Run: `cd uniqn-mobile && git status --porcelain | grep -v "^[AM]"`
Expected: 빈 출력 (모든 변경이 staged 상태)

- [ ] **Step 6: 커밋**

Run:
```bash
cd uniqn-mobile && git commit -m "$(cat <<'EOF'
feat(design): 타이포그래피 Stage 4-d — 구인·지원자·기타 src 본문 폰트

src/components/ 나머지 디렉토리(jobs, applicant, notifications,
employer/{applicants,job-form,posting,dashboard}, board, review,
typography, auth, modals, tutorial, app) + src/hooks/ 본문 텍스트에
Plus Jakarta Sans 적용. Stage 4 중 가장 큰 배치.

검증: type-check + lint + format:check + test 모두 통과
EOF
)"
```

- [ ] **Step 7: 커밋 확인**

Run: `cd uniqn-mobile && git log --oneline -4`

---

## Task 12: Stage 4-e 적용 + 검증 + 커밋 (app/ 라우트 화면)

**Files:**
- Modify: `uniqn-mobile/app/**/*.tsx`

- [ ] **Step 1: 4e dry-run 미리보기**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4e --dry > /tmp/stage4e-preview.log 2>&1 && tail -5 /tmp/stage4e-preview.log`
Expected: 통계 라인 (약 70-90 파일)

- [ ] **Step 2: 헤딩 침범 검증**

Run: `grep "font-display" /tmp/stage4e-preview.log | grep -v "^\\["`
Expected: 빈 출력

- [ ] **Step 3: 4e 적용 + 검증**

Run: `cd uniqn-mobile && node scripts/apply-typography-stage4-body.mjs --stage 4e --verify`
Expected: `all checks passed ✓`

- [ ] **Step 4: 명시적 add**

Run: `cd uniqn-mobile && git add app/`

- [ ] **Step 5: 잔여 변경 없음 확인**

Run: `cd uniqn-mobile && git status --porcelain | grep -v "^[AM]"`
Expected: 빈 출력

- [ ] **Step 6: 커밋**

Run:
```bash
cd uniqn-mobile && git commit -m "$(cat <<'EOF'
feat(design): 타이포그래피 Stage 4-e — app/ 라우트 화면 본문 폰트

app/ 디렉토리 전체 라우트 화면((auth), (app), (employer), (admin),
(public)) 본문 텍스트에 Plus Jakarta Sans 적용. Stage 4 마지막 배치.

검증: type-check + lint + format:check + test 모두 통과
EOF
)"
```

- [ ] **Step 7: Stage 4 전체 커밋 트리 확인**

Run: `cd uniqn-mobile && git log --oneline -6`
Expected:
```
<hash> feat(design): 타이포그래피 Stage 4-e — app/ ...
<hash> feat(design): 타이포그래피 Stage 4-d — 구인·지원자·기타 src ...
<hash> feat(design): 타이포그래피 Stage 4-c — 관리자·지원 화면 ...
<hash> feat(design): 타이포그래피 Stage 4-b — 일정·정산 화면 ...
<hash> feat(design): 타이포그래피 Stage 4-a — UI 기초 컴포넌트 ...
7aab6f96c docs(design): 타이포그래피 Stage 4 (Body) 설계안 작성
```

---

## Task 13: 사후 검증 — 잔여 패턴 0건 확인 + 시각 QA 안내

**Files:** (변경 없음, 검증만)

- [ ] **Step 1: 잔여 본문 패턴 카운트**

Run:
```bash
cd uniqn-mobile && npx --yes ripgrep -e 'text-sm[^a-z-]' --glob '!*/__tests__/*' --glob '!*.test.tsx' --glob '!*.stories.tsx' src app | grep -v "font-sans" | grep -v "font-display" | wc -l
```
Expected: 0 또는 매우 작은 숫자 (남아있다면 className에 변수 보간이 있는 동적 케이스)

- [ ] **Step 2: text-xs 잔여 카운트**

Run:
```bash
cd uniqn-mobile && npx --yes ripgrep -e 'text-xs[^a-z-]' --glob '!*/__tests__/*' --glob '!*.test.tsx' --glob '!*.stories.tsx' src app | grep -v "font-sans" | grep -v "font-display" | wc -l
```
Expected: 0 또는 매우 작은 숫자

- [ ] **Step 3: text-base 잔여 카운트**

Run:
```bash
cd uniqn-mobile && npx --yes ripgrep -e 'text-base[^a-z-]' --glob '!*/__tests__/*' --glob '!*.test.tsx' --glob '!*.stories.tsx' src app | grep -v "font-sans" | grep -v "font-display" | wc -l
```
Expected: 0 또는 매우 작은 숫자

- [ ] **Step 4: 동적 className 잔여 후보 확인**

만약 Step 1~3에서 잔여가 있다면, 다음으로 위치 확인:
```bash
cd uniqn-mobile && npx --yes ripgrep -e 'text-sm[^a-z-]' --glob '!*/__tests__/*' --glob '!*.test.tsx' src app | grep -v "font-sans" | grep -v "font-display" | head -20
```

대부분 `${condition ? 'text-sm font-bold' : 'text-sm'}` 같은 삼항 표현식일 것. 이는 후속 Stage 4.5에서 수동 처리.

- [ ] **Step 5: 최종 npm run quality + npm test 한 번 더 실행**

Run: `cd uniqn-mobile && npm run quality && npm test`
Expected: 모두 통과

- [ ] **Step 6: Git 로그 최종 확인**

Run: `cd uniqn-mobile && git log --oneline -7`
Expected: 6개의 새 커밋 (1 spec + 5 stage)

- [ ] **Step 7: 사용자에게 시각 QA 요청 보고**

다음 8개 화면을 Expo 개발 서버(`npm start`)에서 수동 확인 요청:

1. 일정 카드 (`schedule/ScheduleCard.tsx`) — 일정 목록 진입
2. 정산 카드 (`employer/settlement/SettlementCard.tsx`) — 정산 목록
3. 공지 카드 (`admin/announcements/AnnouncementCard.tsx`) — 공지 목록
4. 차트 (`admin/stats/RoleDistributionChart.tsx`) — 통계 화면
5. 알림 리스트 (`notifications/NotificationList.tsx`) — 알림 화면
6. 지원 모달 (`employer/applicants/`) — 지원자 화면
7. 마이페이지 (`app/(app)/mypage/`)
8. 로그인 (`app/(auth)/login.tsx`)

각 화면에서 확인:
- ✅ Plus Jakarta Sans 폰트 적용
- ✅ 다크 모드 토글 정상
- ✅ 굵기(weight) 변화 의도와 일치
- ⚠️ 정산 표 자릿수 정렬 → 회귀 보이면 Stage 5 트리거

- [ ] **Step 8: Stage 4 종료 보고**

사용자에게 다음 형식으로 완료 보고:

> Stage 4 완료. 5개 커밋 생성:
> - 4-a UI 기초 (N파일 / M건)
> - 4-b 일정·정산 (N파일 / M건)
> - 4-c 관리자·지원 (N파일 / M건)
> - 4-d 구인·기타 (N파일 / M건)
> - 4-e app/ (N파일 / M건)
>
> 총 ~파일 / ~건 변환. 모든 단계 type-check + lint + format:check + test 통과.
> 잔여 본문 패턴 N건 (동적 className).
> 8개 핵심 화면 시각 QA 요청드립니다.

---

## Self-Review Checklist

(이 계획을 작성한 직후 본인이 점검)

### Spec 커버리지 확인

| Spec 요구사항 | 구현 Task |
|--------------|---------|
| 21개 변환 패턴 | Task 1 (PATTERNS 상수) |
| 결합 → 단독 순서 | Task 1 (PATTERNS 배열 순서), Task 4 (멱등성 가드) |
| 멱등성 가드 (font-sans) | Task 4 (Step 1) |
| 헤딩 침범 방지 (font-display) | Task 4 (Step 1) |
| 워킹 트리 클린 가드 | Task 2 |
| 5개 디렉토리 그룹 | Task 1 (DIR_GROUPS), Task 8~12 |
| 자동 검증 (--verify) | Task 5, Task 8~12 |
| dry-run 모드 | Task 1 (CLI 파싱), Task 7 |
| 명시적 git add (pre-commit 회피) | Task 8~12 (Step 4) |
| 5개 분리 커밋 | Task 8~12 |
| 잔여 패턴 사후 카운트 | Task 13 |
| 8개 화면 시각 QA | Task 13 (Step 7) |

### Placeholder 스캔

- ✅ TBD/TODO: 0건
- ✅ "implement later": 0건
- ✅ 모든 코드 블록 완전 (PATTERNS, DIR_GROUPS 전체 명시, 함수 본문 전체)
- ✅ 모든 명령어 exact (npm run X, git X)
- ✅ 모든 expected output 명시

### 타입/이름 일관성

- ✅ `applyPatternsToFile(filePath)` 시그니처 Task 4와 Task 6에서 동일 (filePath 단일 인자)
- ✅ `findCandidateFiles(dirs)` 시그니처 Task 3과 Task 6에서 동일
- ✅ `runStage(stageId)` 시그니처 Task 6에서 정의, main()에서 호출
- ✅ DIR_GROUPS 키 ('4a'~'4e')가 CLI 인자, runStage 호출, 커밋 메시지에서 일관

---

*마지막 업데이트: 2026-04-12*
