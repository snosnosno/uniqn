# Typography Rollout Stage 4 — Body Text (Plus Jakarta Sans)

- 작성일: 2026-04-12
- 작성자: Stage 4 브레인스토밍 세션
- 상태: 승인 대기 → 승인 후 implementation plan 작성
- 선행 작업:
  - 21deded1c — Stage 1 (Outfit + Plus Jakarta Sans 폰트 로드)
  - d455a1989 — Stage 2 (헤딩 73개 파일)
  - c32991172 — Stage 3 (Stack 헤더 fontFamily 주입)

---

## 1. 목표 (한 줄 요약)

> Plus Jakarta Sans 본문 폰트를 1,800+ 건의 본문/캡션 `<Text>` 요소에 시각적 회귀 없이 도입한다.

## 2. 배경

Stage 1~3에서 헤딩(`text-lg` 이상)에 Outfit 폰트를 적용했지만, 본문(`text-sm`/`text-xs`/`text-base`)은 여전히 시스템 폰트를 사용한다. DESIGN.md에 정의된 본문 폰트 Plus Jakarta Sans는 로드만 되고 미사용 상태다.

React Native는 fontFamily가 cascade되지 않으므로, 글로벌 default 폰트 설정이 불가능하고 각 `<Text>`마다 개별로 font 클래스를 부여해야 한다.

### 영향 범위 (Phase A 조사 기준)

| 패턴 | 발생 |
|------|------|
| `text-sm` (단독) | 760건 / 213개 파일 |
| `text-xs` (단독) | 417건 / 156개 파일 |
| `text-base` (단독) | 263건 / 123개 파일 |
| `text-sm font-medium` | 202건 / 107개 파일 |
| `text-sm font-semibold` | 37건 / 28개 파일 |
| `text-sm font-bold` | 11건 |
| `text-xs font-medium` | 56건 / 45개 파일 |
| `text-xs font-semibold` | 10건 |
| `text-xs font-bold` | 4건 |
| `text-base font-medium` | 37건 / 30개 파일 |
| `text-base font-semibold` | 145건 / 72개 파일 |
| `text-base font-bold` | 10건 |
| **합계** | **~1,820건 / ~380개 파일** |

## 3. 결정사항 (브레인스토밍 결과)

### Q1. Weight 매핑 전략 → **Option B (Weight 보존)**

기존 코드의 weight를 1:1 매핑으로 보존한다. DESIGN.md의 "Caption 기본 500" 같은 정렬 시도는 후속 Stage에서 디자이너 합의 후 진행한다.

**이유**:
- 시각 회귀 0건 보장 (~870건 weight 손실 회피)
- Option B 원칙: "폰트 패밀리만 도입, weight는 그대로"
- 디자이너 합의 미확인 상태에서 weight 정규화는 위험

### Q2. `text-base font-semibold/bold` 155건 처리 → **옵션 ⓐ (본문 처리)**

`text-base font-semibold` (145건)와 `text-base font-bold` (10건)는 H5 회색지대지만, Option B의 일관성을 위해 본문(`font-sans-semibold`/`font-sans-bold`)으로 처리한다. H5 승격은 향후 디자이너 협의 후 별도 Stage에서 수행한다.

### Q3. className 없는 `<Text>` 79건 → **방안 ① (무시)**

Phase A의 79건 중 실제 프로덕션 사용은 **2건뿐**(`<Text> → </Text>` 화살표 구분자 2개). 나머지 77건은 테스트 모킹 컴포넌트, 스토리북, JSDoc 주석 안 예시 코드. Stage 4 스크립트는 className이 있는 케이스만 처리한다.

### Q4. 분할 단위 → **전략 2️⃣ (디렉토리별 5 커밋 + 자동 검증)**

5개 디렉토리 그룹으로 분할해 커밋하고, 각 커밋 전 자동으로 type-check + lint + test를 실행한다. 회귀 발견 시 부분 revert가 가능하고 도메인별 추적이 쉽다.

### Q5. 숫자/금액 처리 → **방안 Ⓒ (Stage 5로 분리)**

Plus Jakarta Sans는 기본 proportional figures이고, tabular numbers는 RN의 `fontVariant: ['tabular-nums']` 또는 OpenType `tnum` feature로 별도 도입 필요. Stage 4는 일반 본문과 동일하게 처리하고, 정렬 품질은 시각 검증 후 Stage 5에서 결정한다.

## 4. 변환 패턴 매트릭스 (총 21개)

각 텍스트 크기 그룹마다 6개 weight 결합 패턴(양방향) + 1개 단독 패턴 = 7개. 세 그룹 합계 21개.

스크립트가 적용할 정확한 치환 규칙. **결합 패턴을 단독 패턴보다 먼저 처리해야** 멱등성이 깨지지 않는다.

### text-sm 그룹

```
text-sm font-medium      →  text-sm font-sans-medium
font-medium text-sm      →  font-sans-medium text-sm
text-sm font-semibold    →  text-sm font-sans-semibold
font-semibold text-sm    →  font-sans-semibold text-sm
text-sm font-bold        →  text-sm font-sans-bold
font-bold text-sm        →  font-sans-bold text-sm
text-sm                  →  text-sm font-sans          (마지막)
```

### text-xs 그룹

```
text-xs font-medium      →  text-xs font-sans-medium
font-medium text-xs      →  font-sans-medium text-xs
text-xs font-semibold    →  text-xs font-sans-semibold
font-semibold text-xs    →  font-sans-semibold text-xs
text-xs font-bold        →  text-xs font-sans-bold
font-bold text-xs        →  font-sans-bold text-xs
text-xs                  →  text-xs font-sans          (마지막)
```

### text-base 그룹

```
text-base font-medium    →  text-base font-sans-medium
font-medium text-base    →  font-sans-medium text-base
text-base font-semibold  →  text-base font-sans-semibold
font-semibold text-base  →  font-sans-semibold text-base
text-base font-bold      →  text-base font-sans-bold
font-bold text-base      →  font-sans-bold text-base
text-base                →  text-base font-sans        (마지막)
```

### 멱등성 보호

각 패턴 적용 시 다음 가드를 통과해야 한다:

1. 매치된 className 안에 이미 `font-sans`(혹은 `font-sans-*`)가 포함되어 있으면 skip
2. 매치된 className 안에 `font-display`(혹은 `font-display-*`)가 포함되어 있으면 skip (헤딩 침범 방지)
3. 동일 패턴이 여러 번 매치되어도 첫 적용 후 두 번째 호출은 no-op

## 5. 아키텍처

### 파일 구조

```
uniqn-mobile/
├── scripts/
│   ├── apply-typography-stage2.mjs           (참고용, 변경 없음)
│   └── apply-typography-stage4-body.mjs      (신규)
└── docs/superpowers/specs/
    └── 2026-04-12-typography-stage4-body-design.md (이 파일)
```

### 스크립트 인터페이스

```bash
# 미리보기 (변경 없이 diff만 출력)
node scripts/apply-typography-stage4-body.mjs --stage 4a --dry

# 단일 스테이지 적용
node scripts/apply-typography-stage4-body.mjs --stage 4a

# 단일 스테이지 적용 + 자동 검증 (type-check + lint + format:check + test)
node scripts/apply-typography-stage4-body.mjs --stage 4a --verify

# 전체 5단계 순차 실행 + 각 단계 자동 검증 (수동 커밋은 별도)
node scripts/apply-typography-stage4-body.mjs --all --verify

# 클린 워킹 트리 강제 (안전 가드)
# 스크립트는 시작 시 git status --porcelain 확인, 비어있지 않으면 abort
```

### 핵심 함수 시그니처

```javascript
const PATTERNS = [/* 21개 (결합 → 단독 순서) */];

const DIR_GROUPS = {
  '4a': ['src/components/ui/'],
  '4b': ['src/components/schedule/', 'src/components/employer/settlement/'],
  '4c': ['src/components/admin/', 'src/components/support/'],
  '4d': [
    'src/components/jobs/',
    'src/components/applicant/',
    'src/components/notifications/',
    'src/components/employer/',  // settlement 제외
    'src/components/board/',
    'src/components/review/',
    'src/components/typography/',
    'src/hooks/',
  ],
  '4e': ['app/'],
};

function findCandidateFiles(dirs, patterns) { /* ripgrep 호출 */ }
function applyPatternsToFile(filePath, patterns) { /* split/join + guard */ }
function runVerification() { /* type-check + lint + format:check + test */ }
function ensureCleanWorkingTree() { /* git status 검증 */ }
function runStage(stageId, opts) { /* 통합 실행 */ }
function main() { /* CLI 파싱 */ }
```

## 6. 디렉토리 분할 (5 커밋)

| 단계 | 커밋 메시지 | 대상 디렉토리 |
|------|------------|------------|
| 4-a | `feat(design): 타이포그래피 Stage 4-a — UI 기초 컴포넌트 본문 폰트` | `src/components/ui/` |
| 4-b | `feat(design): 타이포그래피 Stage 4-b — 일정·정산 화면 본문 폰트` | `src/components/schedule/`, `src/components/employer/settlement/` |
| 4-c | `feat(design): 타이포그래피 Stage 4-c — 관리자·지원 화면 본문 폰트` | `src/components/admin/`, `src/components/support/` |
| 4-d | `feat(design): 타이포그래피 Stage 4-d — 구인·지원자·기타 src 본문 폰트` | `src/components/jobs/`, `src/components/applicant/`, `src/components/notifications/`, `src/components/employer/` (settlement 제외), `src/components/board/`, `src/components/review/`, `src/components/typography/`, `src/hooks/` |
| 4-e | `feat(design): 타이포그래피 Stage 4-e — app/ 라우트 화면 본문 폰트` | `app/` 전체 |

### 커밋 시퀀스 (각 단계)

1. `node scripts/apply-typography-stage4-body.mjs --stage 4a --dry` (미리보기)
2. `node scripts/apply-typography-stage4-body.mjs --stage 4a --verify` (적용 + 검증)
3. `git status` (변경 파일 확인)
4. `git add <명시 파일 목록>` (pre-commit 훅 자동 재스테이징 버그 회피)
5. `git commit -m "feat(design): 타이포그래피 Stage 4-a — ..."`
6. `git log --oneline -1` (커밋 확인)

## 7. 안전장치

| 위험 | 대응 |
|------|------|
| 멱등성 위반 (중복 적용) | className에 `font-sans*` 포함 시 해당 매치 skip |
| 패턴 순서 오류 | 결합 패턴 먼저, 단독 패턴 나중 (PATTERNS 배열 순서로 보장) |
| 잘못된 파일 수정 | dry-run 모드 필수, 실제 변경 전 diff 출력 |
| 워킹 트리 오염 | `ensureCleanWorkingTree()`에서 `git status --porcelain` 확인, 비어있지 않으면 abort |
| 병렬 세션 충돌 | 위와 동일 |
| pre-commit 훅 자동 재스테이징 버그 | `git add .` 금지, 명시 파일 목록만 add |
| 검증 실패 후 잔존 변경 | 검증 실패 시 사용자 수동 결정 (자동 restore 없음, 실수 방지) |
| Stage 1~3 헤딩 침범 | `font-display*` 포함 className은 매치 skip |
| Test 스냅샷 자연스러운 회귀 | 의도된 변경임을 확인 후 `npm test -- -u`로 갱신, 동일 커밋 포함 |

## 8. 테스트 전략

각 단계 커밋 전 자동 검증:

| 검증 | 명령 | 기준 |
|------|------|------|
| 타입 | `npm run type-check` | 0 errors |
| 린트 | `npm run lint` | 0 errors (warnings 허용) |
| 포맷 | `npm run format:check` | pass |
| 단위 테스트 | `npm test` | 204 스위트 / 3361 테스트 0 실패 유지 |

## 9. 롤아웃 후 검증 (Phase 외 수동 QA)

전체 5단계 완료 후 Expo 개발 서버를 띄워 다음 화면을 수동 확인:

1. 일정 카드 (`schedule/ScheduleCard.tsx`)
2. 정산 카드 (`employer/settlement/SettlementCard.tsx`)
3. 공지 카드 (`admin/announcements/AnnouncementCard.tsx`)
4. 차트 (`admin/stats/RoleDistributionChart.tsx`)
5. 알림 리스트 (`notifications/NotificationList.tsx`)
6. 지원 모달 (`employer/applicants/`)
7. 마이페이지 (`app/(app)/mypage/`)
8. 로그인 (`app/(auth)/login.tsx`)

각 화면에서:
- ✅ Plus Jakarta Sans가 적용되었는가
- ✅ 다크 모드 토글이 정상 작동하는가
- ✅ 굵기(weight) 변화가 의도와 일치하는가
- ⚠️ 정산 표 자릿수 정렬: 회귀가 보이면 Stage 5 트리거

## 10. Stage 4 범위 외 (의도적 제외)

다음은 Stage 4에서 다루지 않으며, 별도 Stage 또는 후속 PR에서 처리한다:

- ❌ Heading 영역 (`text-lg` 이상, `font-display*`) — Stage 1~3에서 처리 완료
- ❌ Tabular Number (정산 표 자릿수 정렬) — Stage 5로 이관
- ❌ Typography 컴포넌트(H1~H5, Body, Caption, Micro) 마이그레이션 — 별도 리팩토링 트랙
- ❌ className 없는 `<Text>` 79건 — 실제 영향 2건뿐, 후속 PR
- ❌ 제3자 라이브러리 textProps/textStyle — 사용처 0건 확인됨
- ❌ DESIGN.md "Caption 기본 500" 정렬 — 디자이너 합의 후 별도 Stage

## 11. 성공 기준

Stage 4가 "완료" 상태로 인정되려면:

1. ✅ 5개 커밋 모두 main에 푸시되어 git log에 보임
2. ✅ 각 커밋에서 `npm run type-check`, `npm run lint`, `npm test` 통과 증거 존재
3. ✅ Stage 4 종료 시점에 grep으로 다음 패턴이 거의 0건:
   - `text-sm`(font-sans 없이) ← 본문 영역
   - `text-xs`(font-sans 없이) ← 캡션 영역
   - `text-base`(font-sans 없이) ← UI 라벨 영역
4. ✅ 8개 핵심 화면 수동 시각 검증 완료 (다크 모드 포함)
5. ✅ 회귀 0건 (시각 + 테스트 + 빌드)

---

*마지막 업데이트: 2026-04-12*
