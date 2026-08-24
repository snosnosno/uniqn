# 문구 감사 3단계 착수 프롬프트 (다음 세션용)

> 2·1단계는 **완료·커밋됨**. 이 문서는 3단계만 다룬다. 새 세션은 여기부터 읽으면 된다.
> 감사 원본: `docs/analysis/2026-08-24-ui-copy-audit.md`

---

## 그대로 붙여넣을 프롬프트

```
문구 감사 3단계를 진행해줘. docs/planning/2026-08-24-ui-copy-stage3-session-prompt.md 를
먼저 읽고 시작할 것. 브랜치 fix/ui-copy-stage1 에 1·2단계가 이미 커밋돼 있다.

핵심: 2단계에서 만든 @/constants/messages 팩토리로 "불러오기 실패/찾을 수 없음/저장 실패"
109곳(75파일)을 흡수한다. 기계적 일괄 치환 금지 — userMessage 와 내부 message 를 갈라야 하고,
e2e page object 5곳이 옛 문구를 단언하고 있는데 npm run quality 범위 밖이다.
```

---

## 1. 지금 상태 (재확인 불필요)

| 항목 | 값 |
|---|---|
| 브랜치 | `fix/ui-copy-stage1` (master 기준, 미푸시·PR 없음) |
| 1단계 커밋 | `7a5c06093` — 문체 혼용 5건·조사 오류 2건·맞춤법·아이콘 중복 |
| 2단계 커밋 | `dc71f27f6` — `utils/text/josa.ts` + `constants/messages/` + 사용처 9곳 |
| 테스트 | jest **686 suites / 7728 tests 통과** (2단계 시점 실측) |
| quality | `npm run quality` **exit 0** (2단계 시점 실측) |
| knip | 1462. ⚠️ `knip:gate`(`--max-issues=1450`)는 **이 브랜치 이전부터 이미 exit 1** — 선재 초과, 3단계에서 원인 규명 여부는 선택 |

### 이미 있는 도구 (새로 만들지 말 것)

```ts
import { loadFailed, notFound, saveFailed, RETRY_HINT } from '@/constants/messages';
import { josa } from '@/utils/text/josa';

loadFailed('공고')                    // '공고를 불러오지 못했어요'
loadFailed('스케줄', { retry: true }) // '스케줄을 불러오지 못했어요. 잠시 후 다시 시도해주세요'
notFound('근무 기록')                 // '근무 기록을 찾을 수 없어요'
saveFailed('정산')                    // '정산을 저장하지 못했어요'
josa('박지훈', '이/가')                // '박지훈이'
```

고정된 축: **해요체 · 마침표 없음 · 조사는 `josa` 가 결정 · 후속안내는 `RETRY_HINT` 단일 소스**.
계약 테스트가 이 축을 지킨다 — `src/constants/messages/__tests__/failure.test.ts`.

---

## 2. 3단계 범위 — 109곳 / 75파일

| 팩토리 | 건수 | 파일 |
|---|---|---|
| `loadFailed` | 47 | 42 |
| `notFound` | 53 | 32 |
| `saveFailed` | 9 | 8 |

문맥 분포: `error`(AppError·zod) 50 · `jsx-prop` 45 · `alert-opt` 10 · `toast` 4.

**밀집 파일 (여기부터 시작하면 효율적)**

```
src/repositories/supabase/SettlementRepository.ts      notFound 6
src/repositories/supabase/AnnouncementRepository.ts    notFound 4
src/services/board/boardCommentService.ts              notFound 4
app/(employer)/work-schedule.tsx                       loadFailed 3
src/repositories/supabase/ConfirmedStaffRepository.ts  notFound 3
src/services/board/boardReportService.ts               notFound 3
src/components/workSchedule/VenueSettingsSheet.tsx     saveFailed 2
```

전체 목록은 아래 명령으로 언제든 재생성한다(스크래치패드 스크립트는 세션과 함께 사라진다).

```bash
cd uniqn-mobile
grep -rnE "불러(오지 못|올 수 없|오는 ?데 실패)|찾을 수 없|저장(에 실패|하지 못|할 수 없)" \
  src app --include=*.ts --include=*.tsx | grep -v __tests__
```

⚠️ 위 grep 은 **주석까지 잡는다**(이 저장소는 주석이 전부 한글). `message:`/`userMessage:`/
`label=`/`toast` 인자인지 눈으로 확인하고 넘어갈 것.

---

## 3. 함정 4가지 — 여기서 사고가 난다

### ① e2e page object 5곳이 옛 문구를 단언한다 (최우선)

`eslint.config.js` ignores 에 `e2e/` 가 있어 **`npm run quality` 가 못 잡는다**(PR#353 실사고 재현 조건).
CI 에서만 red 로 터진다.

```
e2e/pages/admin/dashboard.page.ts:80,82   '불러오는데 실패했습니다'
e2e/pages/app/notifications.page.ts:60    '불러오는데 실패했습니다'
e2e/pages/app/tabs/schedule.page.ts:113   '불러오지 못했습니다'
e2e/pages/app/job-detail.page.ts:31,62    '찾을 수 없습니다'
```

`'불러오는 중...'`(assertion-helpers·wait-helpers·base.page·job-detail)은 **로딩 문구라 3단계 범위 밖** — 건드리지 말 것.

**작업 순서**: 소스를 고치기 전에 e2e 단언을 먼저 정하고 함께 커밋한다.
단언은 종결어미가 아니라 **의미 조각**으로 바꿔 4단계(톤 통일) 때 또 깨지지 않게 한다.
1단계에서 같은 처방을 이미 두 번 썼다 — `JobPostingRepository.optimisticLock.test.ts` 참고.

### ② `userMessage` 와 내부 `message` 는 다른 층이다

`AppError` 계열은 두 필드를 함께 쓴다. 팩토리는 **`userMessage` 에만** 넣는다.

```ts
throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
  message: `공고 수정: 대상 행 없음 (${jobPostingId})`,  // ← 개발자용. 그대로 둔다
  userMessage: `${notFound('공고')}. 이미 삭제되었을 수 있어요`,  // ← 여기만
});
```

`error` 문맥 50건 중 상당수가 이 형태다. 내부 `message` 를 해요체로 바꾸면 로그 검색성이 깨진다.

### ③ 뒤에 문장이 더 붙는 곳은 마침표를 손으로 잇는다

팩토리는 마침표를 붙이지 않는다. 후속 문장이 있으면 호출부에서 잇되, **`RETRY_HINT` 는
`{ retry: true }` 로만** 붙인다(직접 문자열로 쓰면 축이 다시 갈라진다).

```ts
`${notFound('공고')}. 이미 삭제되었을 수 있어요`   // ✅ 고유 후속 문장
loadFailed('스케줄', { retry: true })              // ✅ 재시도 안내
`${loadFailed('스케줄')}. 잠시 후 다시 시도해주세요` // ❌ RETRY_HINT 우회
```

### ④ 유닛 테스트가 문구 조각을 붙잡고 있다

치환 대상 문구를 단언하는 테스트를 **먼저** 훑을 것.

```bash
cd uniqn-mobile
grep -rn "불러오\|찾을 수 없\|저장에 실패" src --include=*.test.ts --include=*.test.tsx
```

---

## 4. 하지 말 것

- **일괄 `sed` 치환 금지** — 주석·내부 message·로딩 문구가 섞여 있다.
- **`@/constants` 최상위 배럴에 messages 재수출 금지** — 리프 UI 순환 참조로 모듈스코프
  값이 `undefined` 가 되는 함정이 이 저장소에서 3회 재발했다.
- **4단계(해요체 전면 통일) 착수 금지** — 3단계는 팩토리 흡수까지다. 범위를 섞으면
  diff 가 리뷰 불가능해진다.
- **knip 래칫 조정 금지** — 선재 초과라 3단계 책임이 아니다. 손대려면 증가분 출처를
  커밋에 명시하는 게 이 저장소 규약이다.
- **push·PR 금지** — 사용자가 명시 요청할 때만.

---

## 5. 완료 증거 (이걸로 끝났다고 말할 것)

```bash
cd uniqn-mobile
npm run quality        # exit 0
npx jest               # 686+ suites 전량 통과
grep -rn "불러오는데 실패\|불러오지 못했습니다" e2e/   # 0건 (①을 처리했다는 증거)
```

추가로, 흡수 후 남은 변이 수를 세어 **줄었음을 수치로** 보고한다.

```bash
grep -rnE "불러(오지 못|올 수 없)|찾을 수 없" src app --include=*.ts --include=*.tsx \
  | grep -v __tests__ | grep -cE "userMessage|message:|toast|label="
```

권장 커밋 형식: `refactor(ui): 문구 감사 3단계 — 실패 문구 N곳 팩토리 흡수`
