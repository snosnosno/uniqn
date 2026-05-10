# 시멘틱 컬러 토큰 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSS Custom Properties 기반 시멘틱 토큰 7개를 도입해 다크모드를 global.css 한 파일로 중앙 관리하고, P1–P4 색상 불일치를 전부 해소한다.

**Architecture:** global.css에 `:root`/`.dark` CSS 변수를 정의하고 tailwind.config.js가 `var()` 참조로 시멘틱 토큰 클래스를 노출한다. 자동화 스크립트(migrate-semantic-tokens.js)가 기존 `dark:` 페어와 단독 secondary 클래스를 새 토큰으로 일괄 치환하며, 나머지 FFFFFF/000000 하드코딩과 colors.ts import 누락은 파일별로 처리한다.

**Tech Stack:** NativeWind 4 / Tailwind CSS / Node.js (마이그레이션 스크립트) / Jest (스크립트 테스트)

---

## 파일 변경 맵

| 파일 | 작업 |
|------|------|
| `uniqn-mobile/global.css` | `@layer base :root/.dark` 추가, 프리셋 3개 제거, `.input` 업데이트 |
| `uniqn-mobile/tailwind.config.js` | `content`, `surface-page`, `surface-card`, `divider` 토큰 추가 |
| `uniqn-mobile/scripts/migrate-semantic-tokens.js` | 신규 — Tailwind 클래스 일괄 치환 |
| `uniqn-mobile/scripts/__tests__/migrate-semantic-tokens.test.js` | 신규 — 스크립트 단위 테스트 |
| `app/` + `src/` 전체 tsx 파일 | 스크립트 자동 변환 대상 |
| `app/(app)/applications/[id]/cancel.tsx` | P1 수동 — isDarkMode 패턴 |
| `app/(app)/(tabs)/employer.tsx` | P1 수동 — backgroundColor 패턴 |
| `src/components/qr/QRCodeScanner.web.tsx` | P1 수동 — #000000 교체 |

---

## Task 1: tailwind.config.js 시멘틱 토큰 추가

**Files:**
- Modify: `uniqn-mobile/tailwind.config.js`

- [ ] **Step 1: 현재 colors 블록 하단에 토큰 추가**

`tailwind.config.js` 의 `colors:` 객체 안, 기존 `secondary:` 블록 **아래**에 추가:

```js
// 시멘틱 컨텐츠 토큰 (CSS 변수 참조 — 다크모드 자동 대응)
content: {
  primary:     'var(--color-content-primary)',
  secondary:   'var(--color-content-secondary)',
  muted:       'var(--color-content-muted)',
  placeholder: 'var(--color-content-placeholder)',
},
'surface-page': 'var(--color-surface-page)',
'surface-card': 'var(--color-surface-card)',
divider:        'var(--color-divider)',
```

- [ ] **Step 2: 확인**

```bash
cd uniqn-mobile
node -e "const c = require('./tailwind.config.js'); console.log(Object.keys(c.theme.extend.colors))"
```

Expected 출력에 `content`, `surface-page`, `surface-card`, `divider` 포함.

---

## Task 2: global.css CSS 변수 + 프리셋 업데이트

**Files:**
- Modify: `uniqn-mobile/global.css`

- [ ] **Step 1: 파일 상단 `@tailwind base;` 바로 아래에 CSS 변수 블록 추가**

```css
@layer base {
  :root {
    --color-content-primary:     #09090B;
    --color-content-secondary:   #4A4A52;
    --color-content-muted:       #707078;
    --color-content-placeholder: #A8A8B0;
    --color-surface-page:        #F5F5F7;
    --color-surface-card:        #FFFFFF;
    --color-divider:             #DCDCE0;
  }

  .dark {
    --color-content-primary:     #F0F0F2;
    --color-content-secondary:   #C0C0C8;
    --color-content-muted:       #9898A0;
    --color-content-placeholder: #9898A0;
    --color-surface-page:        #09090B;
    --color-surface-card:        #111113;
    --color-divider:             #19191D;
  }
}
```

- [ ] **Step 2: `.input` 프리셋 업데이트** (global.css ~78번 라인)

변경 전:
```css
.input {
  @apply w-full px-4 py-3 rounded border border-secondary-200 dark:border-surface-overlay
         bg-white dark:bg-surface
         text-secondary-900 dark:text-secondary-50
         placeholder:text-secondary-400 dark:placeholder:text-secondary-500
         focus:border-primary-500 focus:ring-1 focus:ring-primary-500;
}
```

변경 후:
```css
.input {
  @apply w-full px-4 py-3 rounded border border-divider
         bg-surface-card
         text-content-primary
         placeholder:text-content-placeholder
         focus:border-primary-500 focus:ring-1 focus:ring-primary-500;
}
```

- [ ] **Step 3: `.card` / `.card-elevated` 프리셋 업데이트**

변경 전:
```css
.card {
  @apply bg-white dark:bg-surface-elevated rounded-md border border-secondary-200 dark:border-surface-overlay;
}

.card-elevated {
  @apply bg-white dark:bg-surface-elevated rounded-md border border-secondary-200 dark:border-surface-overlay shadow-sm;
}
```

변경 후:
```css
.card {
  @apply bg-surface-card rounded-md border border-divider;
}

.card-elevated {
  @apply bg-surface-card rounded-md border border-divider shadow-sm;
}
```

- [ ] **Step 4: 구식 텍스트 프리셋 3개 제거** (global.css ~88-97번 라인)

아래 블록 전체 삭제:
```css
.text-primary {
  @apply text-secondary-900 dark:text-secondary-50;
}

.text-secondary {
  @apply text-secondary-700 dark:text-secondary-300;
}

.text-muted {
  @apply text-secondary-600 dark:text-secondary-500;
}
```

- [ ] **Step 5: 커밋**

```bash
git add tailwind.config.js global.css
git commit -m "feat(colors): CSS 변수 기반 시멘틱 토큰 7개 추가"
```

---

## Task 3: migrate-semantic-tokens.js 스크립트 테스트 작성

**Files:**
- Create: `uniqn-mobile/scripts/__tests__/migrate-semantic-tokens.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// scripts/__tests__/migrate-semantic-tokens.test.js
'use strict';

// 아직 존재하지 않는 모듈 — 테스트가 실패해야 함
const { transformContent } = require('../migrate-semantic-tokens');

describe('transformContent — dark: 페어 치환', () => {
  it('text-secondary-900 dark:text-secondary-50 → text-content-primary', () => {
    const input = `className="text-secondary-900 dark:text-secondary-50 font-bold"`;
    expect(transformContent(input).content).toBe(
      `className="text-content-primary font-bold"`
    );
    expect(transformContent(input).modified).toBe(true);
  });

  it('bg-white dark:bg-surface-elevated → bg-surface-card', () => {
    const input = `className="rounded bg-white dark:bg-surface-elevated p-4"`;
    expect(transformContent(input).content).toBe(
      `className="rounded bg-surface-card p-4"`
    );
  });

  it('border-secondary-200 dark:border-surface-overlay → border-divider', () => {
    const input = `className="border border-secondary-200 dark:border-surface-overlay"`;
    expect(transformContent(input).content).toBe(
      `className="border border-divider"`
    );
  });
});

describe('transformContent — 단독 클래스 치환 (P2 해결)', () => {
  it('단독 text-secondary-900 → text-content-primary', () => {
    const input = `className="text-secondary-900 text-sm"`;
    expect(transformContent(input).content).toBe(
      `className="text-content-primary text-sm"`
    );
  });

  it('단독 bg-secondary-100 → bg-surface-card', () => {
    const input = `className="rounded bg-secondary-100 p-2"`;
    expect(transformContent(input).content).toBe(
      `className="rounded bg-surface-card p-2"`
    );
  });

  it('변환 대상 없으면 modified=false', () => {
    const input = `className="text-primary-500 bg-surface"`;
    expect(transformContent(input).modified).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd uniqn-mobile
npx jest scripts/__tests__/migrate-semantic-tokens.test.js --no-coverage
```

Expected: `Cannot find module '../migrate-semantic-tokens'` 또는 유사 오류로 FAIL.

---

## Task 4: migrate-semantic-tokens.js 스크립트 구현

**Files:**
- Create: `uniqn-mobile/scripts/migrate-semantic-tokens.js`

- [ ] **Step 1: 스크립트 작성**

```js
/**
 * migrate-semantic-tokens.js
 *
 * Tailwind 클래스 문자열에서 dark: 페어 및 단독 secondary 클래스를
 * 시멘틱 토큰으로 일괄 치환.
 *
 * 사용: node scripts/migrate-semantic-tokens.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// 순서 중요: 페어를 먼저, 단독을 나중에 처리
const CLASS_MAP = [
  // dark: 페어 → 시멘틱 토큰
  ['text-secondary-900 dark:text-secondary-50',        'text-content-primary'],
  ['text-secondary-700 dark:text-secondary-300',       'text-content-secondary'],
  ['text-secondary-600 dark:text-secondary-500',       'text-content-muted'],
  ['text-secondary-400 dark:text-secondary-500',       'text-content-placeholder'],
  ['bg-white dark:bg-surface-elevated',                'bg-surface-card'],
  ['bg-secondary-50 dark:bg-surface',                  'bg-surface-page'],
  ['bg-secondary-100 dark:bg-surface-elevated',        'bg-surface-card'],
  ['border-secondary-200 dark:border-surface-overlay', 'border-divider'],
  // 단독 클래스 → 시멘틱 토큰 (P2 자동 해결)
  ['text-secondary-900', 'text-content-primary'],
  ['text-secondary-700', 'text-content-secondary'],
  ['text-secondary-600', 'text-content-muted'],
  ['text-secondary-400', 'text-content-placeholder'],
  ['bg-secondary-50',    'bg-surface-page'],
  ['bg-secondary-100',   'bg-surface-card'],
];

function transformContent(content) {
  let result = content;
  let modified = false;

  for (const [from, to] of CLASS_MAP) {
    // 클래스 경계를 인식하는 정규식 (공백 또는 따옴표)
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<=[" ])${escaped}(?=[ "])`, 'g');
    if (re.test(result)) {
      result = result.replace(re, to);
      modified = true;
    }
  }

  return { content: result, modified };
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.expo'].includes(entry.name)) {
        results.push(...walk(fp));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fp);
    }
  }
  return results;
}

if (require.main === module) {
  const base = path.resolve(__dirname, '..');
  const EXCLUDE = new Set([path.join(base, 'src/constants/colors.ts')]);
  const targetDirs = ['app', 'src'].map((d) => path.join(base, d));
  const files = targetDirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));

  let count = 0;
  for (const file of files) {
    if (EXCLUDE.has(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const { content, modified } = transformContent(original);
    if (!modified) continue;
    fs.writeFileSync(file, content, 'utf8');
    console.log('  ✓', path.relative(base, file));
    count++;
  }
  console.log(`\n완료: ${count}개 파일 변환`);
}

module.exports = { transformContent };
```

- [ ] **Step 2: 테스트 재실행 — 통과 확인**

```bash
npx jest scripts/__tests__/migrate-semantic-tokens.test.js --no-coverage
```

Expected: `3 passed, 3 passed` (describe 2개, 총 6개 테스트 PASS).

> 만약 lookbehind 정규식이 실패하면 아래 fallback 패턴으로 교체:
> ```js
> const re = new RegExp(`(["\\s])${escaped}(["\\s])`, 'g');
> result = result.replace(re, `$1${to}$2`);
> ```

- [ ] **Step 3: 스크립트 실행 (dry-run 확인)**

```bash
cd uniqn-mobile
node scripts/migrate-semantic-tokens.js
```

Expected: 변환된 파일 목록 출력 후 `완료: N개 파일 변환`.

- [ ] **Step 4: 변환 결과 검증**

```bash
# dark: 짝 없는 secondary → 0 목표
grep -rn "text-secondary-[0-9]" --include="*.tsx" . \
  | grep -v node_modules | grep -v "dark:" | wc -l

# bg-secondary-50/100 단독 → 0 목표
grep -rn "bg-secondary-5[0-9]\|bg-secondary-1[0-9][0-9]" --include="*.tsx" . \
  | grep -v node_modules | grep -v "dark:" | wc -l
```

Expected: 두 값 모두 0.

- [ ] **Step 5: 커밋**

```bash
git add scripts/migrate-semantic-tokens.js \
        scripts/__tests__/migrate-semantic-tokens.test.js
git add app/ src/
git commit -m "feat(colors): migrate-semantic-tokens 스크립트로 P2 자동 해결"
```

---

## Task 5: P4 대소문자 정규화

**Files:**
- 자동 수정: `app/`, `src/` 전체 tsx/ts

- [ ] **Step 1: sed 스크립트 실행**

```bash
cd uniqn-mobile
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i \
    -e 's/#ffffff/#FFFFFF/g' \
    -e 's/#dc2626/#DC2626/g' \
    -e 's/#22c55e/#22C55E/g' \
    -e 's/#d4a017/#D4A017/g' \
    -e 's/#2563eb/#2563EB/g' \
    -e 's/#d4af37/#D4AF37/g' \
    {} +
```

- [ ] **Step 2: 잔존 소문자 hex 확인**

```bash
grep -rn "#[a-f][0-9a-f]\{5\}" --include="*.tsx" . \
  | grep -v node_modules | grep -v "rgba\|//" | wc -l
```

Expected: 0.

- [ ] **Step 3: 커밋**

```bash
git add app/ src/
git commit -m "style(colors): 소문자 hex → 대문자 정규화 (P4)"
```

---

## Task 6: P1 수동 처리 — cancel.tsx (네비게이션 헤더)

**Files:**
- Modify: `uniqn-mobile/app/(app)/applications/[id]/cancel.tsx`

- [ ] **Step 1: 파일 확인**

```bash
grep -n "FFFFFF\|ffffff\|09090B" "app/(app)/applications/[id]/cancel.tsx"
```

Expected: `isDarkMode ? '#09090B' : '#FFFFFF'` 패턴 8개 (backgroundColor + headerTintColor).

- [ ] **Step 2: colors import 추가 확인**

파일 상단에 `SURFACE_COLORS` import가 없으면 추가:

```typescript
import { SURFACE_COLORS } from '@/constants/colors';
```

- [ ] **Step 3: 패턴 교체**

`isDarkMode ? '#09090B' : '#ffffff'` → `isDarkMode ? SURFACE_COLORS.DEFAULT : SURFACE_COLORS.elevated`

`isDarkMode ? '#ffffff' : '#09090B'` → `isDarkMode ? SURFACE_COLORS.elevated : SURFACE_COLORS.DEFAULT`

> `SURFACE_COLORS.DEFAULT = '#09090B'`, `SURFACE_COLORS.elevated = '#111113'` (흰색 대용으로 elevated 사용)
>
> 순수 흰색이 필요하면 `'#FFFFFF'` 유지 가능. 헤더 배경은 elevated가 적합.

- [ ] **Step 4: 저장 후 type-check**

```bash
cd uniqn-mobile
npx tsc --noEmit 2>&1 | grep "cancel.tsx"
```

Expected: 오류 없음.

---

## Task 7: P1 수동 처리 — employer.tsx + 아이콘 파일들

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/employer.tsx`
- Modify: `uniqn-mobile/src/components/qr/QRCodeScanner.web.tsx`

- [ ] **Step 1: employer.tsx 확인**

```bash
grep -n "FFFFFF\|ffffff\|1F2937" "app/(app)/(tabs)/employer.tsx"
```

Expected: `backgroundColor: isSelected ? (isDarkMode ? '#1F2937' : '#FFFFFF') : 'transparent'`

- [ ] **Step 2: employer.tsx 교체**

```typescript
// Before
backgroundColor: isSelected ? (isDarkMode ? '#1F2937' : '#FFFFFF') : 'transparent',

// After
backgroundColor: isSelected ? (isDarkMode ? SURFACE_COLORS.overlay : SURFACE_COLORS.elevated) : 'transparent',
```

파일에 `SURFACE_COLORS` import 추가 (없는 경우):
```typescript
import { SURFACE_COLORS } from '@/constants/colors';
```

> `#1F2937` ≈ SURFACE_COLORS.overlay(`#19191D`), `#FFFFFF` → elevated(`#111113`).

- [ ] **Step 3: QRCodeScanner.web.tsx 확인 및 교체**

```bash
grep -n "#000000" "src/components/qr/QRCodeScanner.web.tsx"
```

`#000000`을 `SURFACE_COLORS.DEFAULT`(`#09090B`)로 교체. import 추가.

- [ ] **Step 4: 아이콘 color="#FFFFFF" — 유지 확인**

아이콘 컴포넌트의 `color="#FFFFFF"` 는 고대비 의도이므로 **변경하지 않음**.

```bash
# 아이콘 color 속성만 제외하고 남은 FFFFFF 확인
grep -rn "#FFFFFF" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v 'color="#FFFFFF"\|thumbColor'
```

남은 항목이 있으면 컨텍스트 확인 후 `bg-surface-card` 또는 `SURFACE_COLORS.elevated`로 교체.

- [ ] **Step 5: 커밋**

```bash
git add "app/(app)/(tabs)/employer.tsx" \
        "app/(app)/applications/[id]/cancel.tsx" \
        "src/components/qr/QRCodeScanner.web.tsx"
git commit -m "fix(colors): P1 FFFFFF/000000 하드코딩 상수 교체"
```

---

## Task 8: P3 — colors.ts import 추가 (30개 파일)

**Files:**
- Modify: 30개 파일 (`#D4AF37`, `#DC2626`, `#09090B` 직접 사용 파일)

- [ ] **Step 1: 대상 파일 목록 확인**

```bash
cd uniqn-mobile
grep -rli "#D4AF37\|#DC2626\|#09090B" --include="*.tsx" . \
  | grep -v node_modules | grep -v "colors.ts" \
  | while read f; do
      grep -q "from '@/constants/colors'" "$f" || echo "$f"
    done
```

목록을 메모해두고 각 파일 처리.

- [ ] **Step 2: 우선순위 파일 먼저 처리**

**`src/constants/statusConfig.ts`** (28회 — 가장 많음):

```bash
grep -n "#D4AF37\|#DC2626\|#22C55E\|#09090B" src/constants/statusConfig.ts | head -10
```

파일 상단에 추가:
```typescript
import { PRIMARY_COLORS, STATUS_COLORS, SURFACE_COLORS } from '@/constants/colors';
```

교체 규칙:
- `'#D4AF37'` → `PRIMARY_COLORS[300]`
- `'#DC2626'` → `STATUS_COLORS.error`
- `'#22C55E'` → `STATUS_COLORS.success`
- `'#09090B'` → `SURFACE_COLORS.DEFAULT`

- [ ] **Step 3: 나머지 파일 일괄 처리**

각 파일에 대해 반복:
```bash
# 1. 파일에서 사용된 hex 확인
grep -n "#D4AF37\|#DC2626\|#09090B" <파일경로>

# 2. import 추가 (필요한 상수만 선택)
# PRIMARY_COLORS, STATUS_COLORS, SURFACE_COLORS 중 사용하는 것만

# 3. hex → 상수 교체
```

**교체 매핑:**
| Hex | 상수 |
|-----|------|
| `'#D4AF37'` | `PRIMARY_COLORS[300]` |
| `"#D4AF37"` | `PRIMARY_COLORS[300]` |
| `'#DC2626'` | `STATUS_COLORS.error` |
| `'#22C55E'` | `STATUS_COLORS.success` |
| `'#D4A017'` | `STATUS_COLORS.warning` |
| `'#2563EB'` | `STATUS_COLORS.info` |
| `'#09090B'` | `SURFACE_COLORS.DEFAULT` |

- [ ] **Step 4: 검증**

```bash
grep -rli "#D4AF37\|#DC2626\|#09090B" --include="*.tsx" . \
  | grep -v node_modules | grep -v "colors.ts" \
  | while read f; do
      grep -q "from '@/constants/colors'" "$f" || echo "MISSING: $f"
    done
```

Expected: 출력 없음 (모든 파일 import 완료).

- [ ] **Step 5: 커밋**

```bash
git add src/ app/
git commit -m "fix(colors): P3 colors.ts import 추가 및 brand hex → 상수 교체"
```

---

## Task 9: 통합 검증 + 최종 커밋

**Files:** 없음 (검증만)

- [ ] **Step 1: quality 전체 실행**

```bash
cd uniqn-mobile
npm run quality
```

Expected: 오류 0개. (`type-check + lint + format:check` 전부 PASS)

- [ ] **Step 2: 잔존 소문자 hex 확인**

```bash
grep -rn "#[a-f][0-9a-f]\{5\}" --include="*.tsx" . \
  | grep -v node_modules | grep -v "rgba\|//"
```

Expected: 출력 없음.

- [ ] **Step 3: dark: 짝 없는 secondary 확인**

```bash
grep -rn "text-secondary-[0-9]" --include="*.tsx" . \
  | grep -v node_modules | grep -v "dark:"
```

Expected: 출력 없음.

- [ ] **Step 4: colors.ts 미import 확인**

```bash
grep -rli "#D4AF37\|#DC2626\|#09090B" --include="*.tsx" . \
  | grep -v node_modules | grep -v "colors.ts" \
  | while read f; do
      grep -q "from '@/constants/colors'" "$f" || echo "$f"
    done
```

Expected: 출력 없음.

- [ ] **Step 5: Jest 전체 테스트**

```bash
npm test -- --passWithNoTests
```

Expected: 기존 테스트 전부 PASS (실패 없음).

- [ ] **Step 6: 완료 태그 커밋**

```bash
git add -A
git commit -m "style(colors): 시멘틱 토큰 시스템 완료 — P1-P4 색상 일관성 해소"
```

---

## 완료 기준 체크리스트

- [ ] `npm run quality` 오류 0
- [ ] 소문자 hex grep → 0
- [ ] `dark:` 짝 없는 secondary grep → 0
- [ ] colors.ts 미import grep → 0
- [ ] Jest 기존 테스트 전부 PASS
- [ ] 다크모드 전환 시 텍스트 가시성 정상 (수동 확인)
