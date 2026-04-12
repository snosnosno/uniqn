# 시멘틱 컬러 토큰 시스템 설계

> 작성일: 2026-04-13  
> 목적: 색상 일관성 P1-P4 해결 + 중앙화된 다크모드 관리  
> 범위: `uniqn-mobile/` 전체

---

## 배경

이전 세션에서 SECONDARY_PALETTE 단일 진실 공급원을 도입했으나, 3가지 문제가 잔존:

- **P1**: `#FFFFFF`/`#000000` 189개 하드코딩
- **P2**: `text-secondary-*` dark: 짝 없는 클래스 144개
- **P3**: `colors.ts` 미import 파일 46개

단순히 dark: 페어를 파일마다 추가하면 나중에 디자인 토큰 하나 바꿀 때 100개 파일을 다시 수정해야 함.  
→ CSS Custom Properties 기반 시멘틱 토큰으로 근본 해결.

---

## 토큰 체계 (Section 1)

### Text 토큰

| 토큰 클래스 | 역할 | 라이트 | 다크 |
|------------|------|--------|------|
| `text-content-primary` | 본문 텍스트 | `#09090B` | `#F0F0F2` |
| `text-content-secondary` | 보조 텍스트 | `#4A4A52` | `#C0C0C8` |
| `text-content-muted` | 캡션/뮤트 | `#707078` | `#9898A0` |
| `text-content-placeholder` | 플레이스홀더 | `#A8A8B0` | `#9898A0` |

### Surface 토큰

| 토큰 클래스 | 역할 | 라이트 | 다크 |
|------------|------|--------|------|
| `bg-surface-page` | 페이지 배경 | `#F5F5F7` | `#09090B` |
| `bg-surface-card` | 카드/입력 배경 | `#FFFFFF` | `#111113` |

> 기존 `surface`, `surface-elevated`, `surface-overlay` (static dark values) 유지.

### Border 토큰

| 토큰 클래스 | 역할 | 라이트 | 다크 |
|------------|------|--------|------|
| `border-divider` | 구분선/보더 | `#DCDCE0` | `#19191D` |

---

## CSS Variable 구조 (Section 2)

### `global.css` 추가

```css
@layer base {
  :root {
    /* Text */
    --color-content-primary:     #09090B;
    --color-content-secondary:   #4A4A52;
    --color-content-muted:       #707078;
    --color-content-placeholder: #A8A8B0;
    /* Surface */
    --color-surface-page: #F5F5F7;
    --color-surface-card: #FFFFFF;
    /* Border */
    --color-divider: #DCDCE0;
  }

  .dark {
    --color-content-primary:     #F0F0F2;
    --color-content-secondary:   #C0C0C8;
    --color-content-muted:       #9898A0;
    --color-content-placeholder: #9898A0;
    --color-surface-page: #09090B;
    --color-surface-card: #111113;
    --color-divider: #19191D;
  }
}
```

### `tailwind.config.js` 추가

기존 `colors:` 블록 하위에 추가:

```js
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

### `global.css` 제거

기존 `@layer components`의 `.text-primary`, `.text-secondary`, `.text-muted` 프리셋 삭제  
(이름 충돌 + CSS 변수로 대체)

---

## 마이그레이션 전략 (Section 3)

### Phase 0: 기반 구축

- `global.css` CSS 변수 블록 추가 (`@layer base :root/.dark`)
- `tailwind.config.js` 토큰 추가
- `global.css` 기존 충돌 프리셋 제거 (`.text-primary`, `.text-secondary`, `.text-muted`)
- `global.css` `.card`, `.input` 프리셋 내 구식 클래스 → 새 토큰으로 교체
  - `text-secondary-900 dark:text-secondary-50` → `text-content-primary`
  - `placeholder:text-secondary-400 dark:placeholder:text-secondary-500` → `placeholder:text-content-placeholder`

### Phase 1: 자동화 스크립트

`scripts/migrate-semantic-tokens.js` 신규 작성 (replace-hardcoded-colors.js 패턴 재사용)

**치환 맵:**

```js
const CLASS_MAP = [
  // 기존 dark: 페어 → 시멘틱 토큰
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
```

> P2(dark: 짝 없음)가 스크립트로 자동 해결됨.

### Phase 2: Agent Teams (병렬)

| Agent | 역할 | 파일 수 |
|-------|------|---------|
| `agent-P1a` | `app/` FFFFFF/000000 컨텍스트 판단 + 교체 | ~30개 |
| `agent-P1b` | `src/` FFFFFF/000000 컨텍스트 판단 + 교체 | ~16개 |
| `agent-P3` | `colors.ts` import 추가 + hex → 상수 교체 | 30개 |

**P1 판단 기준 (agent 지시사항):**

```
thumbColor={'#FFFFFF'}       → 유지 (Switch 컴포넌트 의도)
color="#FFFFFF" (아이콘)     → 유지 (고대비 의도)
backgroundColor: '#FFFFFF'   → bg-surface-card
StyleSheet '#000000'         → SURFACE_COLORS.DEFAULT
```

**P3 교체 패턴:**

```typescript
import { PRIMARY_COLORS, STATUS_COLORS, SURFACE_COLORS } from '@/constants/colors';

// #D4AF37 → PRIMARY_COLORS[300]
// #DC2626 → STATUS_COLORS.error
// #09090B → SURFACE_COLORS.DEFAULT
```

### Phase 3: 검증

```bash
# 소문자 hex 0
grep -rn "#[a-f][0-9a-f]{5}" --include="*.tsx" . | grep -v node_modules | wc -l

# dark: 짝 없는 secondary 0
grep -rn "text-secondary-[0-9]" --include="*.tsx" . | grep -v node_modules | grep -v "dark:" | wc -l

# quality 통과
cd uniqn-mobile && npm run quality
```

### Phase 4: 커밋

```
style(colors): 시멘틱 토큰 도입 + 색상 일관성 P1-P4 완료

- CSS Custom Properties 기반 7개 시멘틱 토큰 추가
- global.css :root/.dark 변수 정의 (다크모드 중앙 관리)
- migrate-semantic-tokens.js 스크립트로 P2 자동 해결
- P1: FFFFFF/000000 하드코딩 상수 교체
- P3: 30개 파일 colors.ts import 추가
```

---

## 완료 기준

- [ ] `npm run quality` 통과 (0 errors)
- [ ] 소문자 hex `grep` → 0
- [ ] dark: 짝 없는 secondary `grep` → 0
- [ ] 다크모드 전환 시 텍스트 가시성 정상

---

## 참고 파일

| 파일 | 역할 |
|------|------|
| `src/constants/colors.ts` | RN 인라인 스타일용 상수 |
| `tailwind.config.js` | Tailwind 클래스 팔레트 |
| `global.css` | CSS 변수 정의 (다크모드 중앙화) |
| `scripts/replace-hardcoded-colors.js` | 재사용 패턴 참고 |
| `scripts/migrate-semantic-tokens.js` | 신규 작성 (Phase 1) |
