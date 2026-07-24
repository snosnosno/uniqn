# 핸드오프 — JobPosting 시간필드 타입 거짓말 근본교정 전수조사 (Date → string)

> 작성: 2026-07-17 · 다음 세션 메인 프롬프트 · **조사 우선(전수조사) → 계획 → (승인 후) 실행**
> 선행: `fix/create-posting-createdat-string @ b25a6a722` (크래시 최소수정 커밋, 미push)

## 0. 다음 세션에 붙여넣을 프롬프트

```
JobPosting의 시간 필드(createdAt/updatedAt/closedAt)가 "타입은 Date, 런타임은 ISO string"인
타입 거짓말을 근본교정하려 한다. 실제로 타입을 string으로 바꿨을 때 영향을 받는 부분을 전수조사하라.

이번 작업은 조사·계획 우선이다. 전수조사 결과(영향 지점 분류 목록 + 지점별 교정안 + 리스크)를
먼저 내놓고, 실제 코드 수정은 내 승인 후에 착수하라. HARD-GATE(3+파일)에 해당하므로 설계 먼저.
```

## 1. 배경 — 이미 확정된 사실 (재조사 불필요)

- **증상(해결됨)**: 공고 작성 화면 진입 시 `TypeError: p.createdAt?.getTime is not a function`.
  employer가 기존 공고 1개 이상 보유 시 무조건 재현(#261 "마지막 공고" 프리셋 선별 로직).
- **근본 원인 = 타입 거짓말**:
  - `JobPosting.createdAt/updatedAt/closedAt` 타입 선언 = `Date` — 수기 인터페이스,
    `src/types/jobPosting.ts:179-181`.
  - 런타임 생산 경로 = `JobPostingRepositoryHelpers.toJobPosting(row)` →
    `parseJobPostingDocument(clean)` → zod `jobPostingSchema`가 `timestampSchema` 적용.
  - `timestampSchema`(`src/schemas/common.ts:40`)는 `normalizeToIsoString`으로 **모든 입력을
    ISO 8601 string으로 통일**. 주석 명시: "View layer에서 Date가 필요하면 utils/date의 toDate()로 변환."
  - ⟹ **모든 공고의 런타임 createdAt/updatedAt/closedAt는 string**. 타입만 Date.
- **최소수정(이미 커밋)**: `app/(employer)/my-postings/create.tsx:75` 를
  `toDate(p.createdAt)?.getTime() ?? 0` 로 교정 + 회귀 테스트 3종
  (`app/(employer)/my-postings/__tests__/CreateJobPostingScreen.test.tsx`, red-green 검증 완료).
  → 크래시는 이미 막혀 있어 근본교정은 **급하지 않다**. 품질/재발방지 목적.
- **왜 다른 곳은 안 깨졌나**: 기존 소비처가 이미 `toDate()` 방어를 씀 —
  실측 확인: `src/types/board.ts:323-324`, `src/components/applicant/ConfirmationHistoryTimeline.tsx:210-211`,
  `src/services/board/boardScheduleService.ts:18-20`. `toDate`는 string·Date·number·null 모두 수용
  (`src/utils/date/core.ts:123`). 즉 `.getTime()`을 **직접** 부른 곳만 위험.

## 2. 근본교정 방법 (3단계)

1. **타입을 진실에 맞춘다** — `src/types/jobPosting.ts:179-181`:
   `createdAt?: Date` → `createdAt?: string` (updatedAt/closedAt 동일).
2. **컴파일러로 소비처 전수 노출** — `npx tsc --noEmit` → `.getTime()`·`Date` 산술·
   `Date` 인자 포맷터를 직접 호출하던 지점만 타입 에러. 각각 `toDate(x)?.getTime()` 또는
   문자열 허용 포맷터로 교정.
3. **회귀 방어** — create.tsx 테스트 유지 + (선택) 스키마 출력 타입 ↔ 인터페이스 정합성 테스트.

## 3. 전수조사 작업 지시 (다음 세션이 수행)

### 3-1. 정적 반경 실측 (필수 · 진실원)
```bash
# 타입을 임시로 flip 후 tsc 에러 전량 수집 → 원복
# (src/types/jobPosting.ts:179-181  Date → string)
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | tee /tmp/audit-tsc.txt
# 원복 필수(측정 전용). 에러 목록이 곧 "직접 소비처" 전수.
```
> ⚠️ 이번 세션에서 flip→tsc 측정을 **시도했으나 사용자 중단으로 미완**. 목록 확보가 1순위.

### 3-2. 정적 grep 보강 (tsc가 못 잡는 곳)
- `toDate` 없이 시간필드를 쓰는 곳, cast(`as Date`)로 타입검사 우회한 곳, `any`/`unknown` 경유:
```bash
grep -rnE "\.(createdAt|updatedAt|closedAt)\b" src app --include=*.ts --include=*.tsx \
  | grep -v "toDate\|__tests__"
```
- 정렬/비교 로직(`sort`, `reduce`, `localeCompare`, `<`/`>` 문자열비교 함정), 포맷터 호출,
  `new Date(posting.createdAt)` 이중변환, `date-fns`(format/differenceIn*)에 직접 전달 지점.
- 소비처 후보 파일군(공고 카드·목록·상세·정렬·프리셋): `src/domains/job-posting/**`,
  `src/components/**/job*/**`, `app/(employer)/my-postings/**`, `src/services/jobs/**`,
  `src/hooks/useJobManagement.ts`.

### 3-3. 경계·직렬화 확인 (회귀 위험 지점)
- **쓰기 경로**: `JobPostingRepository.ts:495 createdAt: now`(INSERT) 및 548·742 —
  `now`/`cur.createdAt`가 Date인지 string인지, 타입 변경 시 INSERT/UPDATE 페이로드가
  깨지지 않는지 실측. (스키마는 string 통일이므로 write도 string이어야 정합)
- **프리셋/드래프트 매퍼**: `buildJobPostingDraft`, `draftToValues`,
  `src/utils/order-sheet/mappers.ts` 가 시간필드를 Date로 가정하는지.
- **캐시/직렬화**: TanStack Query 캐시, MMKV, `setLastSubmittedDraft` 등 —
  string이 JSON round-trip에 오히려 안전(Date는 직렬화 시 string 됨)이나 역방향 소비 확인.
- **테스트 픽스처**: `createdAt: new Date()`로 만든 목/팩토리
  (실측: `src/services/jobs/__tests__/*.test.ts`, `jobManagementService*.test.ts`,
  `jobPosting.schema.test.ts`) — 타입 변경 시 픽스처도 string으로 정합화 필요.

### 3-4. 형제 타입 거짓말 클래스 (스트레치 · 별도 스코프 후보)
같은 `timestampSchema`(string 출력)를 쓰지만 타입이 Date일 수 있는 다른 도메인:
- `Application`(schemas/application.schema.ts:301 createdAt: timestampSchema) — 타입 실측 필요.
- 참고: `jobTemplate.ts:43`은 이미 `createdAt: string | null`로 올바름.
→ JobPosting 스코프와 **분리**해 보고만. 한 PR에 묶지 말 것(반경 폭발).

## 4. 산출물 (다음 세션이 내놓을 것)
1. **영향 지점 전수 목록** — 파일:라인 · 분류(`직접 .getTime()` / `Date 산술` / `포맷터` /
   `정렬비교` / `쓰기경로` / `테스트픽스처` / `cast 우회`) · 지점별 교정안(대개 `toDate()`).
2. **반경 판정** — 총 N개 파일. 최소수정 유지 vs 근본교정 권고(정직한 비용/리스크).
3. **실행 계획** — 근본교정 착수 시 커밋 분할안(타입+소비처 / 쓰기경로 / 테스트) + 검증 게이트
   (`tsc --noEmit` 0 · 관련 jest · 전체 `npm run quality`).

## 5. 가드레일 (엄수)
- **런타임 스키마(`timestampSchema`·`normalizeToIsoString`)는 이미 올바르다 — 건드리지 말 것.**
  교정 대상은 "타입 선언"과 "Date로 가정한 소비처"뿐.
- 교정은 **기존 확립 패턴 `toDate(x)?.getTime() ?? 0`** 사용(신규 유틸 발명 금지).
- **최소 diff**. 시간필드와 무관한 리팩터링 동반 금지.
- 마이그레이션·DB·PROD 무관(순수 프론트 타입 정합). Supabase 우회/기존 마이그 수정 금지.
- 3+ 파일 변경 = 설계 먼저(HARD-GATE). **조사·계획 → 사용자 승인 → 실행** 순서 준수.
- 완료 주장 전 이 세션에서 실행한 tsc/jest 출력 증거 필수(전역 verification 규칙).

## 6. 참조 좌표 (실측 확정)
| 항목 | 위치 |
|---|---|
| 타입 거짓말 선언 | `src/types/jobPosting.ts:179-181` |
| string 통일 진실원 | `src/schemas/common.ts:40` (`timestampSchema` → `normalizeToIsoString`) |
| 런타임 파싱 매퍼 | `src/repositories/supabase/JobPostingRepositoryHelpers.ts:32` (`toJobPosting`→`parseJobPostingDocument`) |
| 변환 헬퍼(교정 도구) | `src/utils/date/core.ts:123` (`toDate`), `:153` (`toDateValue`) |
| 이미 방어 중인 소비처(참고 패턴) | `src/types/board.ts:323`, `ConfirmationHistoryTimeline.tsx:210`, `boardScheduleService.ts:18` |
| 최소수정 커밋 | `fix/create-posting-createdat-string @ b25a6a722` (미push) |
```
