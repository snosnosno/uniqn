# 세션 프롬프트 — 근무 시간 편집 통일 **검토 + 잔여 착지**

> 사용법: 새 세션에서 **이 파일을 읽히고 시작**한다.
> 이전 세션(2026-08-06~07)이 **구현 11개 태스크를 전부 끝냈다.** 이 세션은 **검토 → 착지**다.
> 설계 정본: `docs/planning/2026-08-06-work-time-editing-unification-design.md`
> 구현 계획: `docs/planning/2026-08-06-work-time-editing-unification-plan.md`
> 실행 원장(잔여 전문): `.superpowers/sdd/2026-08-06-work-time-editing-unification-plan/progress.md` ← **gitignore. 워크트리에만 있다**

---

## 0. 인계 시점 상태 (2026-08-07, 컨트롤러 직접 실측)

| 항목 | 값 |
|---|---|
| 워크트리 | `C:\Users\user\Desktop\T-HOLDEM-worktime` — **존재함. 지우지 말 것** |
| 브랜치 | `feat/work-time-editing-unification` |
| 베이스 | `23e84fd2b` (master, PR#423 포함) |
| HEAD | 마지막 코드 커밋 `fc1633697` + 이 문서 커밋 |
| 커밋 | **30개** · 97파일 · +11,989 / −4,043 |
| PR | **미생성** |
| prod | 🔴 **마이그레이션 5개 전부 미적용** |

### 검증 (**2026-08-07 세션에서 전량 재실행·직접 관측**)

```
pgTAP              103 파일 / 1164 PASS   exit 0
jest               632 스위트 / 7073 PASS  exit 0   (§5-1 해소로 +1 스위트 / +12 테스트)
npm run quality    exit 0                        (105 warnings / 0 errors)
npm run knip:gate  exit 0
기존 마이그 수정   0건 (신규 5개만)
작업트리           clean
```

⚠️ 로컬 Docker DB에는 이 브랜치 마이그 5개가 **이미 적용된 상태**다(`schema_migrations` 실측).
다른 워크트리 2개(datepick·grouping)는 마이그가 0건이라 공유 스택 오염은 없다.

### 신규 마이그레이션 5개 — 🔴 **적용 순서 엄수**

```
1. 20260806120000_notify_merge_time_change.sql          알림 병합
2. 20260806130000_venue_day_slots_attendance.sql        읽기 RPC (DROP+CREATE, 권한 복원 포함)
3. 20260806140000_work_log_slot_attendance.sql          쓰기 RPC (실적·상태파생·역할이력)
4. 20260807120000_work_log_slot_custom_role.sql         커스텀 역할명 키
5. 20260807130000_work_log_slot_custom_role_enum_guard.sql   enum 라벨 충돌 차단
```

**역순이면 스태프에게 알림이 2통 간다**(1번이 먼저 들어가야 병합 가드가 자리를 잡는다).

---

## 1. 이 세션이 할 일

### (A) 검토 리뷰 — 무엇을 다시 봐야 하나

이전 세션은 **태스크마다 개별 리뷰 + 브랜치 전체 최종 리뷰**를 거쳤고 Critical 0건이다.
다시 볼 가치가 있는 것은 **리뷰가 구조적으로 못 본 것**뿐이다:

1. 🔴 **실기기·웹 실렌더** — 정적 리뷰로 검증 불가능한 전부. §4 QA 목록.
2. 🔴 **prod 적용 후 실측 2가지**(§2-4).
3. **판정이 갈렸던 자리 재확인**(원하면):
   - `WorkLogEditSheet` 의 D6 예외(예정 섹션 안 접음) — **사용자 확정**. 되돌리지 말 것
   - 역할 변경 사유 **선택 유지** — **사용자 확정**. 되돌리지 말 것
   - 중복충돌 경고 소실 **수용** — `detectSlotConflicts` 는 경위 주석과 함께 보존됨

⚠️ **재리뷰를 새로 돌릴 거면 범위를 정해라.** 브랜치 전체 diff 는 702KB 다.
이미 통과한 축을 다시 훑는 건 낭비다 — 위 3개만 보면 된다.

### (B) 잔여 착지 — 순서대로

```
✅ ⓪ 베이스라인 재검증 (08-07 완료 — 4종 전량 직접 관측)
✅ ⓪' §5-1 D4 3경로 통일 (08-07 완료 — 커밋 fc1633697)
   ① 최신 master 재통합 + 재검증   ← 08-07 기준 behind 0 (재확인 필요)
   ② prod 마이그레이션 5개 적용 (사용자 확인 필수)
   ③ PR 생성 (사용자 명시 요청 시에만)
   ④ 실기기 QA
   ⑤ 웹 배포 · OTA
```

---

## 2. prod 적용 절차 (🔴 사용자 확인 없이 실행 금지)

### 2-1. 적용 전
- `git fetch origin` → master 가 움직였으면 **머지 후 전 검증 재실행**(squash 저장소라 merge, rebase 금지)
- `mcp__supabase__list_migrations` 로 현재 prod 기록 확인

### 2-2. 적용
- **MCP `apply_migration` 전용.** `supabase db push` 금지
- 위 §0 순서 그대로 1→5

### 2-3. 적용 직후 원장에 박을 것
🔴 **prod 기록명은 MCP 가 자체 타임스탬프로 남긴다 — 레포 파일명과 다르다.**
적용 후 `list_migrations` 로 **실제 기록명을 읽어 메모리에 박아라**(재적용 금지 표시와 함께).
이 레포는 이 누락으로 여러 번 혼선이 있었다.

### 2-4. 적용 직후 실측 2가지 (이거 안 하면 적용을 확인한 게 아니다)

```sql
-- ① get_venue_day_slots 의 ACL — 유일한 DROP+CREATE 라 여기만 되살아날 수 있다
SELECT p.oid::regprocedure::text, array_to_string(p.proacl, ' ')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_venue_day_slots';
-- 기대: postgres=X/postgres authenticated=X/postgres service_role=X/postgres
--       🔴 PUBLIC 몫(=X/postgres)·anon 이 있으면 즉시 REVOKE (SECDEF 함수다)

-- ② 파리티
SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS funcs,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS policies;
-- 기대: 200 / 111 불변 (전부 CREATE OR REPLACE, 신설·삭제 없음)
```

⚠️ prod 는 `pg_default_acl` 에 함수 기본권한으로 `anon=X` 가 등록돼 있다(실측).
그래서 DROP+CREATE 시 부활 경로가 **둘**(기본 PUBLIC + DEFAULT PRIVILEGES anon)이고,
마이그 2번이 `REVOKE ALL ... FROM PUBLIC, anon` 으로 둘 다 회수한다. ①은 그게 먹었는지 보는 것이다.

### 2-5. 🔴 앱 배포는 반드시 마이그 5개 **전부 적용 후**

역순이면:
- **새 클라 + 구 쓰기 RPC** → 실적 저장 **전부 실패**(`INVALID_INPUT: 알 수 없는 수정 항목입니다: checkIn`)
- **새 클라 + 구 읽기 RPC** → `VenueDaySlot.checkInTs`/`payrollStatus`/`date` 가 non-nullable 인데 구 RPC 는 안 준다
  → 런타임 `undefined` → 시트가 **모든 행의 실적을 빈 값으로** 보여주고, 그 상태에서 `[예정대로 기록]` 을 누르면
  **기존 `check_in_ts` 를 예정 시각으로 덮어쓴다** — 이번 작업이 없애려던 바로 그 사고의 재현

역방향(**구 클라 + 새 RPC**)은 **안전**하다 — 설계대로다(허용 키 상위집합, 읽기 RPC 는 열을 끝에만 추가, ACL 복원).

---

## 3. 확정된 결정 — 재논의·되돌리기 금지

| | 결정 | 근거 |
|---|---|---|
| D1 | 예정 = 안내값(상태 무관) / 실적만 상태 전환 | 사용자 확정 |
| D2 | 3곳(근무표·스태프관리·정산) 동일 시트 | 사용자 확정 |
| D4 | 정산 완료 건 **전체** 읽기 전용 | 사용자 확정 (✅ §5-1 에서 3경로 통일 완료) |
| — | **`failed` = 편집 가능** (읽기 전용은 completed 에서만) | 🔴 **사용자 결정(08-07).** `payrollStatus` 는 3값이다 |
| — | **completed 도 시트 진입 허용** — 거절은 시트가 말한다 | 🔴 **사용자 결정(08-07).** 버튼을 숨기면 "왜 없지?"만 남는다 |
| **D6 예외** | **예정 섹션은 접지 않는다** | 🔴 **사용자 직접 결정(08-06).** 설계 문서 §3·D6 은 "접힘"이라 적혀 있지만 **구현이 정본**이다. 근거는 `WorkLogEditSheet.tsx` 상단 주석 |
| D7 | 마감 역할 차단 없음 — 표기만 | 사용자 확정. 서버에도 정원 거부 없음 |
| — | **역할 변경 사유 = 선택** | 🔴 **사용자 결정(08-07).** 구 `RoleChangeModal` 은 필수였다 |
| — | 커스텀 역할 배정 **되살림** | 🔴 **사용자 결정(08-07).** Task 10(서버)+11(클라) |
| — | 중복충돌 경고 소실 **수용** | D2 위반 회피. 되살릴 자리는 시트가 아니라 **근무표 패널** |

---

## 4. 실기기 QA 목록 (전부 미수행)

1. 🔴 **정산 상세 → 시트 → 퇴근 수정 → 저장 → 금액이 갱신되는가**(캐시 무효화 실증)
2. 🔴 **근무표 공고 스팬 슬롯에서 실적 편집이 되는가**(`isContainer` 게이트 해소 실증)
3. 🔴 **iOS 피커** — 시트 overlay 로 뜨는 경로(중첩 Modal 터치 먹통 이력 #186/#188). 구조는 구 `EditSlotSheet` 검증본과 동일
4. 카드 "빼기" 확인 모달 — 출퇴근 기록이 있으면 경고 문구가 붙는가
5. 시트 접힘/펼침·읽기전용 `opacity-60` 웹 렌더
6. 커스텀 역할 칩 줄바꿈·다크모드·선택 표식(✓) 시인성
7. Android 키보드 inset
8. 시트 언마운트로 **닫힘 애니메이션이 생략**된다(조건부 렌더). 체감 확인
9. 근무표 → 스태프관리 첫 로딩 체감(`useConfirmedStaff(venueId)` 구독 제거 영향)

---

## 5. 잔여 판단 사항 (코드는 그대로, 결정이 필요한 것)

### 5-1. ✅ **해소 완료 — D4 3경로 통일 (2026-08-07, 커밋 `fc1633697`)**

사용자 결정 둘을 받아 TDD 로 닫았다: **`failed` = 편집 가능** · **completed 진입은 3곳 모두 열기**.

- `ConfirmedStaffCard.canEditTime` 에서 `payrollStatus !== COMPLETED` 제거
- `SettlementDetailModal` 액션 줄 게이트를 `=== PENDING` → `!== COMPLETED` 축으로 전환
  → **`failed` 가 시간·금액·정산 버튼을 통째로 잃던 실제 결함이 복구됐다**(이게 진짜 버그였다)
- completed 는 **'시간 수정'만** 남기고 금액 수정·지급 완료는 그대로 닫음 — 연 것은 열람뿐
- `SettlementActionButtons` 에 `testID` — 빈 껍데기 렌더 여부를 검증 가능하게

🔑 **시트 readOnly 배선을 실측했다**(이게 끊겨 있으면 정산 완료 건이 오히려 편집 가능해진다):
`payroll_status` → `WORK_LOG_COLUMNS` → `workLogToConfirmedStaff:80` → `toEditInitial`
→ `WorkLogEditSheet.readOnly` — **3경로 전부 연결 확인**.

⚠️ 남은 관련 항목: **버튼 라벨이 경로마다 다르다** — 카드는 `근무 수정`, 정산 모달은 `시간 수정`.
같은 시트를 여는데 이름이 둘이다. 이번 스코프에서 **의도적으로 건드리지 않았다**(문구 변경은 별건).

<details><summary>해소 전 기록</summary>

시트는 읽기 전용 모드를 **완비**했는데(`settled-notice` + `opacity-60` + 전 필드 readOnly + 저장 버튼 미렌더),
**거기 도달할 수 없는 진입점이 둘**이었다:
- `ConfirmedStaffCard.tsx` `canEditTime` 이 `payrollStatus === 'completed'` 를 숨김
- `SettlementDetailModal.tsx:275` 액션 줄을 `PENDING` 일 때만 렌더

**근무표만 열려 있다**(행 탭이 `onEditTime` 게이트를 안 탄다) → **D2("3곳 동일") 위반 상태**.
🔴 여는 작업은 `PENDING` 조건을 지우는 한 줄이 **아니다** — `SettlementDetailModal.tsx:113` 이
`payrollStatus || PENDING` 으로 기본값 처리해 **`failed` 상태도 액션 줄을 잃는다**(3값이다).
`failed` 처리를 함께 정해야 한다. **코드를 읽어야만 드러나는 형태라 놓치기 쉽다.**

</details>

### 5-2. 그 밖
- **중복충돌 경고 되살릴 자리** = 시트가 아니라 `VenueDayPanel`/`VenueDayDetail`(형제 목록을 이미 갖고 있어 새 조회 0).
  ⚠️ `slotsOverlap` 은 구직자 `detectScheduleOverlaps` 와 공유 — 죽은 코드 청소에서 `detectSlotConflicts` 를 지우면 그쪽도 죽는다
- **`useSettlement.updateWorkTime` · `useConfirmedStaff.updateWorkTime/changeRole` 고아**(UI 호출부 0).
  **R4 확정 후 체인 통째 제거** 순서가 맞다 — 지금 훅만 지우면 "무엇을 REVOKE 해야 하는지" 흔적이 사라진다
- **`ConfirmedStaffRepository.updateRoleWithTransaction:323`** 이 클라 측 `role_change_history` append 를 아직 들고 있다(도달 불가, knip 미검출)
- **M4/M5 + Minor-1** → **후속 `/a11y` 패스**로 묶을 것:
  카드 빼기 버튼 a11y 라벨 없음(선재) · 정산 시트 스태프 아바타 소실(회귀, 3경로 동시 수정 필요) ·
  `SlotRoleChips` 선택 칩 라이트모드 대비 4.27:1(AA 미달, `text-primary-800` 로 6.0 대)
- **설계 문서가 구현보다 오래됐다** — §3·D6 5곳. 덮어쓰지 말고 **예외를 추가**하는 방식 권고
- **공고 작성 단계에서 커스텀 역할명이 표준 enum 라벨과 같은 것을 막을 것**(근본 해결).
  현재는 저장 시점에 서버가 거부한다
- **R4(직접 UPDATE REVOKE)** — 롤아웃 확인 후. Task 4 가 `notes` 좁은 UPDATE 를 지워 선행 장애물 하나는 제거됨.
  ⚠️ "롤아웃 확인" 계기판이 없다는 기존 문제(Sentry release 미태깅·`expo-insights` 미설치)가 그대로 걸린다

---

## 6. 이 브랜치에서 실제로 터진 함정 (재작업 시 필독)

| 함정 | 방어 |
|---|---|
| 🔴 `toHaveTextContent(문자열)` 은 **완전일치**(RNTL 13.3.3, 프로브 실측) | **`.not.toHaveTextContent('문자열')` 은 항상 통과하는 빈 가드다.** 정규식을 써라 |
| `accessibilityState` 는 웹에서 **무효**(react-native-web 0.21.2) | 상태를 그것에 의존해 표현·단언하지 마라. 가시 텍스트로 |
| 다크모드 삼항 | eslint `no-restricted-syntax` 와 `darkModePairRatchet` 를 동시에 만족하는 형태는 `text-content-primary dark:text-content-primary` 뿐 |
| 다크모드 대비 계산 | `content-primary` 는 **다크에서 스왑**된다(`#09090B`→`#F0F0F2`). 밝은 스와치 위 전경은 **고정 토큰**(`content-onGold`)이어야 한다 |
| `RETURNS TABLE` 열 추가 | `CREATE OR REPLACE` 가 **거부**한다. DROP+CREATE 필요하고 **권한을 명시 복원**해야 한다 |
| `_posting_role_key` 는 `custom_role` **우선** | 역할키 계산에 **패치 적용 후 최종값**을 써라. 안 그러면 assignments 가 영구 표류하고 **에러가 없다** |
| 마이그 md5 대조 | `md5(replace(pg_get_functiondef(oid), chr(13), ''))` — **`chr(13)` 없으면 CRLF 때문에 전부 가짜 불일치** |
| `docker cp` 무음 실패 | 변이 검증이 **미적용인데 "All tests successful"** 이 뜬다. 적용 후 **정의 md5 게이트**를 루프에 넣어라 |
| `npm run db:reset` 후 | `npm run test:db` 로 돌려라. `npx supabase test db` 단독은 헬퍼 미주입으로 전멸한다 |
| `e2e/` 는 `quality` 범위 밖 | 문자열 grep 만으로 부족 — **page object 헬퍼까지** 추적(PR#423 이 이걸로 CI 에서만 red) |
| `Bash grep` 이 `app/` 트리에서 조용히 0건 | **Grep 도구 + `tsc` 교차검증.** 이 결과로 삭제 판정 금지 |
| MSYS 경로 변환 | `.` 붙은 경로엔 `MSYS_NO_PATHCONV=1` |

---

## 7. 착수 첫 5분

```bash
# 1. 워크트리로 (이미 있다 — 새로 만들지 마라)
cd C:/Users/user/Desktop/T-HOLDEM-worktime
git status --short && git log --oneline -1     # clean (마지막 코드 커밋 fc1633697)

# 2. 최신화
git fetch origin && git log --oneline HEAD..origin/master   # 비어야 최신

# 3. 로컬 DB
cd uniqn-mobile && npm run db:status            # 안 떠 있으면 npm run db:start

# 4. 베이스라인 재확인 (숫자를 눈으로 읽어라)
npm run test:db          # 103 파일 / 1164 PASS
npx jest                 # 631 스위트 / 7061 PASS
npm run quality          # exit 0
npm run knip:gate        # exit 0

# 5. 잔여 전문
#    .superpowers/sdd/2026-08-06-work-time-editing-unification-plan/progress.md
```

⚠️ `node_modules` 는 메인 체크아웃과 **정션**이다(`mklink /J`). 메인 쪽이 깨지면 같이 죽는다 — 복구는 `npm ci`.

---

## 8. 사용자 고지 필요 (배포 노트)

- 마감된 역할도 **선택 가능**해진다 — `(마감)` 표기만 (D7 의도)
- **역할 변경 사유가 선택 입력**이 된다 (구 모달은 필수였음)
- 카드 버튼 `시간 수정` → **`근무 수정`**, `역할 변경` 버튼 제거
- 근무표의 **"출근 시간 겹침" 경고가 사라진다**
- 정산 시트에서 **스태프 아바타가 사라진다**
- 커스텀 역할은 **공고에 정의된 이름 + 이 행에 저장된 이름**만 고를 수 있다(자유 입력 없음)
- 🔴 **정산 실패(`failed`) 건에 액션 버튼이 되돌아온다** — 그동안 시간·금액·정산 버튼이 전부 없어
  재정산할 방법이 없었다. **기능 복구이지 신규 동작이 아니다**
- **정산 완료 건도 `근무 수정`·`시간 수정` 버튼이 보인다** — 누르면 읽기 전용 시트가 열려
  "정산이 완료되어 수정할 수 없습니다"라고 알린다. 이전에는 버튼 자체가 없어 이유를 알 수 없었다.
  금액 수정·지급 완료 표시는 **여전히 안 보인다**
