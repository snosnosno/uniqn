# 구인자 공고상세 개선 — 실행 원장 (2026-08-13 개설 · 08-14 3차 갱신)

> ## 다음 세션은 여기서 시작한다
>
> - **코드 잔여 0.** 2단계 12건 + 3단계 7건 **전량 착지**(S3-6 은 의도적 미착수 — W2-6 통합 트랙).
> - 🔴 **남은 것은 사람 게이트 둘뿐**:
>   ① **마이그 7종 prod 반영**(아래 §7 — 08-15 에 6번, 08-16 에 7번이 추가됐다. "5종"으로
>   기억하고 움직이면 뒤가 빠진다) ② **실기기 확인**(§5, 15건)
> - ✅ **rls-security · sql-correctness 2축 리뷰 완료(08-16)** — 확정 6건 중 4건 수정 ·
>   1건은 현행 유지 결정(노쇼 이력 viewer 노출) · 1건 보류(공유 계측 상한). 상세 §9.
> - 브랜치 `fix/posting-detail-honesty-20260813` (origin/master +6, **미푸시**). PR 도 아직 없다.
> - 🚨 **파리티 마커가 prod 보다 앞서 있다** — 이 브랜치가 214/112 로 올려 놨는데 prod 는
>   208/110 이다. 마이그 5종이 prod 에 들어가기 전까지 **주간 parity-smoke 가 불일치를 보고한다**
>   (정상이다, 파일에도 명시). 머지 전에 이 사실을 아는 사람이 있어야 한다.
> - 🔴 **S3-4 는 문서화된 보안 결정을 뒤집었다**(사용자 승인). 설계 문서가 'NOT in scope' 로
>   기각했던 항목이다 — 마이그 헤더에 이력을 남겼다. 리뷰어에게 이 맥락을 반드시 전달할 것.

> 감사 원본은 `docs/analysis/2026-08-12-employer-posting-detail-ux-audit.md`
> (⚠️ 2026-08-13 기준 **메인 체크아웃에 미커밋 상태**. 없으면 아티팩트에서 확인:
> https://claude.ai/code/artifact/955d83cd-a08e-46d9-8430-b85d55ed4054 )
>
> 감사 규모: 6축 병렬 실측 → 축별 반증 검증 → 76건 생존(CONFIRMED 66 / PARTIAL 10).

---

## 0. 목표와 종료 증명 (exit proof)

**목표**: 감사 76건 중 **2단계(구조) 12건 + 3단계(기능) 7건**을 전부 착지시킨다.

**종료 증명** — 아래를 이 세션의 도구 결과로 관측해야 완료를 주장할 수 있다.

| 항목 | 증명 방법 |
|---|---|
| 타입·린트·포맷 | `npm run quality` → **exit 0** |
| 테스트 | 변경 파일 영향권 스위트 전량 통과 (`npx jest <패턴>` 출력의 `Tests:` 줄) |
| 회귀 가드 실효성 | 신규 회귀 테스트마다 **red-green** — 수정을 되돌려 실패를 관측하고 복원 |
| 마이그레이션(3단계 1·2·3) | PR 전 `mcp__supabase__list_migrations` 로 prod 반영 실측 |
| E2E 사각지대 | 상수·enum·**사용자 문구**를 바꿨으면 `e2e/` 별도 Grep (eslint ignores라 quality 범위 밖) |

**"될 것 같다"는 완료가 아니다.** 실기기 확인이 필요한 항목은 §5 에 따로 모아 두었고,
그것들은 코드로 닫을 수 없으니 **사람 게이트로 인계**한다.

---

## 1. 현재 상태 (2026-08-14 3차 세션 종료 시점)

```
브랜치   fix/posting-detail-honesty-20260813   (origin/master +6, 미푸시)
워크트리 C:/Users/user/Desktop/T-HOLDEM-wt-honesty
base     6cfc66069 (origin/master — PR #475 머지 후 재통합 완료)

커밋 (3차 세션 = 아래 5건 + 머지 1건. 1·2차 커밋은 머지 아래에 있다)
  839fa2e65 Merge origin/master        ← #475 재통합(충돌 0)
  18f818ccd feat(notification): D-day 정원 미달 — 판정축 하드닝·pgTAP·배정 줄 경고   ← S3-1 완료
  14d77865b feat(employer):     지원자 노쇼 이력 칩 — 집계 RPC·낙인 방지 설계         ← S3-3
  a591dae2e feat(share):        공유 출처 계측 end-to-end + 지원 QR 분리              ← S3-5
  c918284b6 feat(employer):     확정 스태프 일괄 공지 — 이력 + 원자적 RPC             ← S3-2
  3e116bbf2 feat(collaborator): 협업자 권한 2단 — 폭발 반경을 뒤집어 구현             ← S3-4
```

**2단계 12건 + 3단계 7건 전량 착지**(S3-6 은 의도적 미착수). 최종 검증:
`npm run quality` **exit 0** · jest **685 스위트 7719건 전량 통과** ·
pgTAP **119파일 1370건 All tests successful**(clean `db reset` 후 마이그 5종 순차 적용 확인).

### 3차 세션에서 추가된 회귀 테스트 (깨뜨리지 말 것)
pgTAP 4: `posting_capacity_gap_notification` · `applicant_no_show_counts` ·
`job_posting_announcements` · `jpc_role_tiers`
jest 5: `capacityGap` · `StaffManagementTab.capacityGap` · `ApplicationRepository.noShowCounts` ·
`shareSource` · `eventQRService.applyQR` · `JobPostingAnnouncementRepository`
**전부 red-green 을 실제로 관측**했다(무엇을 되돌려 무엇이 실패했는지 각 커밋 메시지에 기록).

### 🔑 3차 세션이 실측으로 뒤집은 전제 4가지
1. **로컬에 pg_cron 이 설치돼 있다.** §4-3 이 "로컬 미설치라 EXCEPTION 가드가 없으면 db reset 이
   죽는다"고 했는데, `pg_extension` 실측 1건이다. 그래서 `db reset` 은 가드를 **한 번도 타지
   않았다** — 가드 동작은 `DROP EXTENSION pg_cron` 후 별도로 확인했다(WARNING + 블록 생존).
2. **S3-2 의 서버가 이미 있었다.** Edge Function `send-job-posting-announcement` 가 배포·등록까지
   돼 있었으나 **호출부 0곳인 고아**였고 이력을 안 남긴다. RPC 로 다시 만들었다(원자성).
   → **EF 는 이제 중복이다. 제거는 별도 작업**(config.toml 등록 해제 + 배포).
3. **S3-4 의 실제 표면은 6곳이 아니라 19곳**이다(쓰기 RPC 14 + 쓰기 정책 5). 감사 문서의
   "RLS 정책 3개" 는 과소평가였다.
4. **`ConfirmedStaff.payrollStatus` 는 매핑돼 있다**(`domains/staff/confirmedStaff.ts:80`).
   §2-5 의 "매핑 안 됨" 은 stale 이다.

### 🚨 3차 세션에서 새로 물린 함정 (16~19)
16. **`docker exec` 에 `-i` 가 없으면 stdin 이 안 붙어 조용히 아무것도 안 한다.**
    heredoc 을 파이프해도 출력이 0줄로 끝난다 — 성공처럼 보인다.
17. **`docker cp` 는 `MSYS_NO_PATHCONV=1` 이어도 `/tmp/x` 를 `C:\tmp\x` 로 읽는다.**
    복사가 실패했는데 뒤이은 테스트가 **옛 함수로 통과**해 red-green 이 거짓 green 이 됐다.
    → 컨테이너로 SQL 을 넣을 땐 `docker exec -i ... psql < file` 로 stdin 을 쓸 것.
18. **`jpc_test_set_user` 는 role 을 `authenticated` 로 바꾼다.** 그 뒤 `auth.users` 정리나
    `notifications` 카운트를 하면 각각 `permission denied` / RLS 로 **항상 0건**이 나온다.
    → 검증·정리 전에 `RESET ROLE`.
19. **`supabase` 클라이언트는 `Database` 제네릭 **없이** 생성된다**(`src/lib/supabase.ts:19`).
    `supabase.rpc('오타', {틀린키:1})` 이 tsc 를 그냥 통과한다. RPC 를 새로 부를 때는
    **이름·인자 키를 고정하는 계약 테스트**를 반드시 함께 넣을 것.

신규 회귀 테스트 9파일(2단계에서 추가): `jobDetailSingleSubscription` ·
`JobPostingDetailScreen.{seatAxis,statusTransition,actionHierarchy}` ·
`ApplicantsScreen.undoCancelConfirmation` · `statusActions` · `primaryAction` ·
`toApplicantFilter` · `PostingSurfaceState.manageScope` · `opsNavigation`.
전부 red-green 을 실제로 관측하고 복원했다(각 커밋 메시지에 무엇을 되돌려 무엇이 실패했는지 기록).

🚨 **병렬 세션 4개가 동시 활성이었다** — 실행 직전 `git worktree list` 로 반드시 재실측.

```
C:/Users/user/Desktop/T-HOLDEM                                  master
C:/Users/user/Desktop/T-HOLDEM/.claude/worktrees/cleanup-batch1 chore/cleanup-batch1-20260813
C:/Users/user/Desktop/T-HOLDEM-wt-honesty                       fix/posting-detail-honesty-20260813  ← 이 트랙
C:/Users/user/Desktop/T-HOLDEM-wt-schedule                      fix/schedule-posting-top3-20260813
```

### 1단계에서 이미 끝난 것 (다시 하지 말 것)

| 항목 | 커밋 |
|---|---|
| 에러 가드 좁히기 4화면 (`error && !posting` 축) | `7be60d83c` |
| 원시 `error.message` 노출 제거 (index·edit) | `7be60d83c` |
| 오프라인 분기 + 재시도 버튼 숨김 | `7be60d83c` |
| `ConfirmModal` 이중 확인 래치 + `isLoading` + `closeOnConfirm` | `7be60d83c` |
| 삭제 `isDeleting` 재진입 가드 + `canGoBack()` 폴백 | `7be60d83c` |
| TodayOpsStrip 허브 승격 (고정 공고 제외) | `e1b41c15c` |
| 지원 0 빈 상태 + "공고 링크 공유하기" CTA | `e1b41c15c` |
| 조회수 배선 (`incrementViewCount`, 공고당 1회 ref 가드) | `e1b41c15c` |
| 구직자 미리보기 진입점 | `e1b41c15c` |
| 근무 정보 기본 펼침 | `e1b41c15c` |
| 지원자 카드 전화·문자 (`ContactActions`) | `e1b41c15c` |
| 거짓 문구 "공고 내용과 **상태**를 수정합니다" 정정 2곳 | `e1b41c15c` |
| 하드코딩 보라/네온 2건 토큰화 · 다크 구분선 소실 | `e1b41c15c` |
| a11y: 배지 라벨 합성 · 통계 그룹핑 · 토글 44px+expanded | `e1b41c15c` |

**신규 회귀 테스트 3파일** — 깨뜨리지 말 것:
`JobPostingDetailScreen.errorGuard.test.tsx` · `JobPostingDetailScreen.hubSignals.test.tsx` ·
`src/components/ui/__tests__/Modal.test.tsx`(이중 확인 가드 5건 추가)

---

## 2. 🚨 이번 세션에서 실측으로 배운 함정 (그대로 물릴 것들)

1. **`index.tsx` 줄번호는 이미 밀렸다.** 감사 문서의 `index.tsx:NNN` 은 1단계 이전 좌표다
   (739줄 → **871줄**). 반드시 Grep 으로 심볼을 다시 찾아라. 줄번호를 믿고 편집하지 말 것.

2. **테스트 목이 계약을 빠뜨리면 그 경로는 검증되지 않는다 — 이번에 3번 물렸다.**
   - `@/components/icons` 목에 `EyeIcon` 누락 → 기존 2 스위트 **7건 동시 파손**.
     아이콘을 새로 쓰면 **모든 관련 테스트의 아이콘 목**에 추가해야 한다.
   - `StackHeader: () => null` 목은 `rightAction` 을 통째로 삼킨다 → 헤더 버튼 검증이 무효.
     헤더를 검증하려면 `({ rightAction }) => rightAction ?? null` 형태로 목한다.
   - `PostingSurfaceState: () => null` 목은 에러/부분 상태 검증을 통째로 삼킨다 →
     props(mode/title/message/onRetry)를 그대로 뱉는 목을 쓴다.
   **새 단언이 예상 밖으로 실패하면 구현보다 목을 먼저 의심하라.**

3. **`useConfirmedStaff` 는 `QueryClientProvider` 를 요구한다.** 화면 테스트에서 실제 훅이
   타면 `No QueryClient set` 로 죽는다 — 목 필수.

4. **`useConfirmedStaff` 에는 `enabled` 옵션이 없다.** 옵션은 `{ realtime?, date? }` 뿐.
   끄려면 **빈 문자열 id** 를 넘긴다(`enabled: !!jobPostingId` + 구독 가드가 함께 꺼진다).

5. **`ConfirmedStaff` 에는 `payrollStatus` 가 매핑돼 있지 않다**(`ConfirmedStaffRepository` 는
   내부에서만 읽는다). 정산 대기 수를 여기서 세면 `useSettlement`(work_logs) 와 **다른 숫자**가
   나온다 — 이것이 2단계 4번(숫자 진실원 통일)이 먼저 와야 하는 이유다.

6. **`ConfirmModal` 은 `onConfirm()` 직후 `onClose()` 를 동기로 부른다**(기본값).
   결과를 보고 닫으려면 `closeOnConfirm={false}` + `isLoading` 을 함께 넘긴다.
   소비처 **16곳**이므로 기본 동작을 바꾸지 말 것.

7. **`e2e/pages/app/job-detail.page.ts:28` 이 `[aria-label="공고 공유하기"]` 를 쓴다.**
   같은 화면에 동일 라벨을 둘 만들면 셀렉터가 모호해진다.

8. **`e2e/helpers/assertion-helpers.ts` 의 `DELETE: '삭제'` 는 소비처 0건**(확인 완료).
   삭제 관련 문구는 자유롭게 바꿔도 되지만, **다른 문구는 매번 `e2e/` 를 다시 Grep** 하라.

9. **워크트리에서 `npm install` 금지** — `node_modules` 가 메인 정션이라 다른 워크트리까지
   같이 바뀐다. 새 워크트리는 `mklink /J <wt>\uniqn-mobile\node_modules <메인경로>`.

10. **jest 경로 패턴에 괄호를 쓰지 마라** — `app/(employer)/...` 는 정규식으로 해석돼 0 매치.
    파일명 기반 패턴(`JobPostingDetailScreen`)을 쓴다.

### 2차 세션(2026-08-13)에서 새로 물린 것

11. 🚨 **목 누락으로 스위트가 다섯 번 깨졌다 — 같은 사고의 반복이다.**
    화면에 무언가를 새로 쓸 때마다 기존 스위트의 목에 그 이름이 없어 화면이 마운트조차
    못 했다: `SeatFillSummary`(displayName 에러) · `useWorkLogsByJobPosting` ·
    `useCloseJobPosting`/`useReopenJobPosting` · `selectPostingStatusActions` ·
    `toApplicantFilter` · `useShare`.
    **근본 해결**: 배럴 목은 개별 나열 대신 `...jest.requireActual('<배럴>')` 스프레드를 깔고
    필요한 것만 덮어라. `@/domains/job-posting` 목 4곳을 그렇게 바꿔 놓았다.
    개별 나열이 남아 있는 목(`@/components/icons`, `@/components/jobs`)은 여전히 이 사고에
    노출돼 있다.

12. 🚨 **`@/components/ui` 를 목하지 않으면 실제 `ActionSheet` 가 렌더되고, 그 내부 Modal 이
    `useThemeStore()` 를 selector 없이 호출한다** → `TypeError: selector is not a function`.
    화면 테스트의 themeStore 목이 selector 형태만 지원하기 때문이다. 상세 화면을 렌더하는
    스위트에는 `jest.mock('@/components/ui', () => ({ ActionSheet: () => null }))` 가 필요하다.

13. **경로 오해가 원장·감사문서 전반에 있다.** 존재하지 않는 경로:
    `app/(employer)/job-posting/[id]/` → 실제 **`app/(employer)/my-postings/[id]/`**,
    `src/services/jobPosting/` → 실제 **`src/domains/job-posting/`**
    (`src/services/jobs/` 라는 **다른** 디렉터리가 있어 더 헷갈린다).

14. **bash heredoc 안에 python 삼중따옴표 블록을 넣지 마라** — 따옴표가 얽혀
    `unexpected EOF while looking for matching` 로 죽는다. 긴 테스트 파일은 **Write 도구**로
    직접 쓰는 편이 빠르고 안전하다.

15. **`.filter()` 를 배열 리터럴 뒤에 바로 붙이면 타입 주석이 늦게 적용된다** —
    `const xs: T[] = [...].filter(...)` 는 리터럴이 먼저 추론돼 삼항 안의 `'success'|'primary'` 가
    `string` 으로 넓어진다. 선언과 필터를 두 줄로 나눠라.

---

## 3. 2단계 — 구조 (12건) ✅ **전량 완료 (2026-08-13)**

> 아래 원안 대비 **실측으로 달라진 것**만 먼저 적는다. 나머지는 원안대로 착지했다.
>
> | 항목 | 원안과 다르게 한 것 | 근거 |
> |---|---|---|
> | S2-2 | 삭제 가드를 "work_logs 존재 조회"가 아니라 **`filledPositions` 인자 교체**로 닫음 | 서버 `deleteWithTransaction` 이 이미 그 컬럼으로 막는다 — 같은 축으로 맞추는 게 게이트 일치의 최단 경로. 별도 조회 RPC 불필요 |
> | S2-3 | `capacity_full` 라벨을 '정원 참(자동)' 으로 **바꾸지 않음**. 사유 문구만 추가 | `employer-posting-capacity-recovery.spec.ts:181` 이 "정원 마감" 을 단언(E2E 는 quality 범위 밖) |
> | S2-6 | "pending 1건 인라인 [거절][승인]" **미구현**. 승인 모달 ConfirmModal 수렴만 | S2-4 에서 취소 요청이 최우선 primary action 으로 승격돼 발견성 목적 달성. 거절은 사유 입력 모달이 필요해 같은 액션이 두 화면에 중복 구현된다 |
> | S2-10 | **코드 변경 없음** | `deepLinkNavigationExecutor` 의 "2단"은 push **재시도**(1차→delay→재시도→replace)이지 스택 쌓기가 아니었다. 자식 5화면은 이미 `fallbackHref` 로 상세를 가리키고, `HeaderBackButton` 이 `canGoBack()===false` 일 때만 그 값을 쓴다 — 원장 §3 이 스스로 좁힌 "히스토리 없는 진입"에 대한 안전망이 이미 배선돼 있다 |
> | S2-4 | 골드 총량을 "채운 골드 2곳"으로 해석(텍스트 골드는 유지) | 브랜드 색을 전부 걷어내면 강조가 아니라 정체성이 사라진다. 채운 배경만 CTA 2곳으로 묶었다 |

### (원안 — 이력용)

## 3-원안. 2단계 — 구조 (12건). 권장 순서대로.

> **순서에 의미가 있다.** 4번(숫자 진실원)이 3번(위계 재구성)보다 먼저 와야 배지 정의가 고정된다.
> 5번(구독 수렴)은 다른 작업과 충돌이 크므로 일찍 끝내라.

### S2-1. 중복 `useJobDetail` 제거 → 컨텍스트 수렴  `M`
- 근거: `_layout.tsx:135` 와 `index.tsx` 의 `useJobDetail(id, {realtime:true})` 가 **같은 id 로 2번**.
  `useJobDetail.ts:85-115` 의 effect 가 인스턴스마다 `subscribeToJobPosting` 을 부른다(디듀프 없음).
- 할 일: `index.tsx` 자체 `useJobDetail` 제거 → `useJobDetailContext()` 소비.
  헤더의 `contextIsFixed || isFixed` fail-closed OR 게이트도 단일화된다.
- ⚠️ 컨텍스트에 `error` 가 이미 있다(`_layout.tsx` 의 `JobDetailContextValue`). 자식 4화면
  (applicants·settlements·edit·cancellation-requests)이 각자 부르는 것도 함께 점검.
- 종료 증명: 구독이 1개로 줄었음을 코드로 보이고, `errorGuard` / `hubSignals` 3 스위트 통과.

### S2-2. 숫자 진실원 통일 + "확정"/"자리" 라벨 분리  `M`
- 근거: 한 카드에 4소스 — applications 실시간 stats / stats jsonb 폴백(`projections.ts:99-107`) /
  `filled_positions`(`facts.ts:87`) / 배치 RPC(`usePostingFilledCounts.ts:9-18`).
  허브는 `filled_positions` 를 "배정 현황", 지원자 화면(`applicants.tsx:238-250`)은 **같은 값을 "확정"**.
- 할 일:
  - applications 축 = "검토 대기 N · 확정 N", work_logs 축 = "자리 N/M 채움". 공용 컴포넌트 1개.
  - **"확정"은 applications 에만 쓴다.**
  - 삭제 게이트를 work_logs 존재 여부로 교체(`selectors.ts:39-43` 주석이 지목한 진짜 위험).
    지금은 근무 종료 시 서버가 application 을 completed 로 전이시켜 confirmed 가 0이 되고 **가드가 뚫린다**.
  - `edit.tsx` 확정자 배너 표기를 사람 수 → 자리 수로 정정.
  - 정산 ActionCard 배지를 `filledPositions` → `pendingSettlementCount` 로 교체
    (**1단계에서 의도적으로 미룬 항목**. 여기서 닫는다).
- 종료 증명: 허브와 지원자 화면이 같은 라벨에 같은 숫자를 낸다는 계약 테스트.

### S2-3. 상태 전이 상세 배선 (마감/재오픈)  `M`
- 근거: `useCloseJobPosting`/`useReopenJobPosting` 소비처는 `employer.tsx:210-211` 한 곳,
  버튼은 `JobPostingCard.tsx:181-209` 뿐. 상세의 `PostingStatusBadge` 는 표시 전용.
- 할 일: 상태 뱃지를 `Pressable` 로 승격 → ActionSheet "모집 마감하기 / 다시 열기".
  확인 문구는 `employer.tsx:524-545` 것을 **상수로 승격해 단일 소스화**.
  `capacity_full` 은 "정원 참(자동)" 으로 비활성 표기.
- ⚠️ 마감은 **가역**이므로 확인 모달이 아니라 **되돌리기 토스트**(`toastStore` 의 `action` 필드 실재,
  `toastStore.ts:69-71` 이 action 토스트를 dedupe 에서 면제). 삭제는 확인 모달 유지.
- 🚨 문구를 상수화하면 `e2e/` 별도 Grep.

### S2-4. "지금 할 일" 카드 + 카드 위계 3단  `L`
- 근거: 동일 컴포넌트 `ActionCard` 로 찍어낸 카드 6장, 우선순위 표현 0.
- 할 일: 순수 함수 `selectPrimaryAction`(취소요청 > 오늘 미출근 > 대기 지원자 > 정산 대기 >
  라이브 운영) → 1장만 크게, **골드는 그 버튼에만**(총량 2곳 이하).
  나머지는 리스트 행으로 강등. 섹션 간격 `gap-8`. 카드 중첩 해소.
- ⚠️ **허브 전면 개편(원장 W2-6)은 XL 별도 트랙이다.** 여기서는 위계만 손대고 탭 컨테이너는 건드리지 않는다.
- 🚨 `opsTournaments.length > 0` 이면 라이브 운영은 **항상 최상단 고정** — 빈도로 강등하면
  대회 D-day 현장에서 못 찾는다.

### S2-5. 재게시 (만료·마감 공고)  `M`
- 할 일: expired/closed 면 상세 최상단 배너 "이 공고는 끝났어요 + [같은 조건으로 다시 올리기]"
  → `create?fromPostingId=` 분기. dates 비움 + `grouped:false` 계약은 `create.tsx:113-123` 재사용.
- 현재 프리셋은 `createdAt` 최신 1건 고정(`create.tsx:89-97`) — 최근 3건 선택으로 확장.

### S2-6. 취소요청 인라인 처리  `M`
- 할 일: pending 1건이면 상세 최상단 인라인 [거절][승인], 2건 이상이면 접기.
  기존 전용 화면은 이력으로 격하. 수제 모달(`cancellation-requests.tsx:243-281`)을
  `ConfirmModal` 로 수렴(햅틱·이중 확인 래치 상속).

### S2-7. 확정해제·취소승인 되돌리기 전환  `M`
- 근거: `applicants.tsx:127-140` 이 `confirmAction` 확인 다이얼로그.
- ⚠️ action 토스트를 **재시도 루프에 넣지 말 것**, per-id 가드 필요.

### S2-8. 통계 숫자 탭 가능 + 필터 파라미터  `S~M`
- 통계 3숫자를 `Pressable` 로 감싸 `applicants?filter=` 로 직행(`ApplicantList.tsx:82`).

### S2-9. 로딩 스켈레톤 통일  `M`
- 근거: 허브는 스켈레톤인데 `applicants.tsx:197`·`settlements.tsx:162`·`edit.tsx:141` 은 스피너.
- ⚠️ 허브 스켈레톤 형상도 **구직자용**(히어로+급여+4섹션)이라 실제 구조(통계+액션카드)와 불일치 —
  `PostingSurfaceState.tsx:21-44` 의 `PostingDetailSkeleton` 을 관리 화면용으로 분기.

### S2-10. 딥링크 2단 push  `M`
- 근거: 푸시 알림 5종이 상세를 건너뛰고 자식 화면으로 직행(`NotificationRouteMap.ts:8-48`),
  `HeaderBackButton.tsx:29-32` 가 `fallbackHref` 를 무시.
- 할 일: `deepLinkNavigationExecutor.ts:75` 에서 상세를 먼저 깔고 자식을 push.
- ⚠️ 감사 §07: "딥링크면 갇힌다"는 **범위 과장**이었다. 네이티브 푸시는 스택 하부에 탭이 깔린다.
  실제 갇힘은 **웹 직접 URL 등 히스토리 없는 진입** 한정.

### S2-11. 새 지원 인라인 알림  `M`
- `useApplicantsByJobPosting.ts:104-117` prevRef 비교 + 햅틱. 🚨 **소리 금지**(야간·고소음 현장).
- 근무표 경유 생성(`create.tsx:171-181`)이 완료 화면을 우회해 공유 CTA·프리셋 제안을 통째로
  못 보는 문제 → 액션 토스트로 보완.

### S2-12. "공유" 용어 분리  `S`
- 협업자 카드를 "공유 관리" → **"함께 관리할 사람"** 으로 개명(`collaborators.tsx:41` 과 통일).
  공고 공유(링크)와 협업자 공유(권한)가 같은 단어를 쓰고 있다.

---

## 4. 3단계 — 신규 기능 (7건) ✅ **코드 전량 완료 (2026-08-14)**

> 원 진단("남은 5건은 화면이 아니라 스키마 작업이다")은 맞았다. 다섯 건 전부 본체가
> 마이그레이션·RPC·RLS 였고 화면은 그 위의 얇은 층이었다.
> **남은 것은 prod 반영이라는 사람 게이트뿐이다** — §7 참조.

| # | 항목 | 커밋 | 마이그 | 실제로 한 일 |
|---|---|---|---|---|
| S3-1 | D-2·D-1 정원 미달 알림 | `18f818ccd` | `20260813110000` | 크론 + 멱등 인덱스 + **판정축 하드닝** + 배정 줄 경고 UI |
| S3-2 | 확정 스태프 일괄 공지 | `c918284b6` | `20260813140000` | 이력 테이블 + 원자적 SECDEF RPC + 작성 화면 |
| S3-3 | 지원자 노쇼 이력 칩 | `14d77865b` | `20260813120000` | 배치 집계 RPC(열거 차단·180일 창) + 카드 칩 |
| S3-4 | 협업자 권한 2단 | `3e116bbf2` | `20260813150000` | role 컬럼 + **헬퍼 의미 반전** + 정책·RPC·감사 |
| S3-5 | 공유 출처 + 지원 QR | `a591dae2e` | `20260813130000` | analytics CHECK + `?src=` 왕복 + 지원 QR 분리 |
| S3-6 | 상세 트리 탭 컨테이너 | — | — | ⏸ **미착수(의도)** — W2-6 통합 트랙. 아래 사유 참조 |
| S3-7 | ops `fallbackHref` 정비 | `233dee90c` | — | ✅ 2차 세션에서 완료 |

### S3-6 을 붙이지 않은 이유 (물어보라고 했으므로 답한다)
붙이지 않는 것이 맞다. 이 브랜치가 건드린 것은 **공고 상세의 내용물**(카드·배지·알림·권한)이고,
S3-6 은 **상세를 감싸는 탭 컨테이너 구조 자체**를 바꾼다. 같은 화면이라는 이유로 묶으면
① 이 브랜치의 리뷰 단위가 "기능 5건 + 구조 개편"으로 커져 리뷰가 사실상 불가능해지고
② 원장 W2-6(허브 전면 개편)과 **같은 파일을 두 트랙이 동시에** 고치게 된다.
2단계 S2-4 때도 같은 이유로 "위계만 손대고 탭 컨테이너는 건드리지 않는다"고 선을 그었다 —
그 선을 여기서 넘을 이유가 생기지 않았다.

### 🔑 S3-4 설계 기록 (다음 사람이 반드시 알아야 한다)
`is_posting_collaborator()` 의 **의미를 바꿨다**: 종전 "협업자인가" → 이제 "**manager** 협업자인가".
이유는 폭발 반경이다. 쓰기 지점이 **19곳**(쓰기 RPC 14 + 쓰기 정책 5)이라 하나씩 갈아끼우면
빠뜨린 곳으로 viewer 가 쓰기를 하고 **아무 에러도 안 난다**. 의미를 바꾸면 19곳이 한 줄도 안 고치고
fail-closed 가 되고, 읽기 7곳(정책 5 + RPC 2)만 새 `is_posting_collaborator_any()` 로 옮기면 된다.
**빠뜨렸을 때의 실패가 "권한이 남는" 쪽에서 "권한이 모자란" 쪽으로 뒤집힌다.**
→ 새 쓰기 경로를 만들 때는 `is_posting_collaborator()`(좁은 쪽)를 쓰면 자동으로 옳다.
→ 새 읽기 경로는 `_any` 를 써야 viewer 가 볼 수 있다.
→ 이 규약은 `jpc_role_tiers.test.sql` E9 가 **구조 단언**으로 고정한다.

### 착수 전 반드시 아는 사실 (이번 정찰 실측)

1. **`notifications.type` 에는 CHECK 제약이 없다** — 자유 텍스트다(`category` 만
   `notification_category` ENUM 7종으로 제약). 새 알림 타입 추가에 DB 변경이 필요 없다.
   `NO_SHOW_ALERT`·`CHECKIN_REMINDER` 는 **TS 타입이 이미 정의돼 있다**(발송 주체는
   `checkin_reminder` 쪽이 없다 — S3-1 이 그 빈자리를 채우는 셈).

2. 🚨 **`notifications` 에 멱등 컬럼이 없다.** 크론이 두 번 돌거나 같은 날 재실행되면
   **중복 알림이 그대로 INSERT 된다.** S3-1 은 알림 함수보다 먼저
   `(recipient_id, type, 날짜)` 부분 UNIQUE 인덱스를 깔아야 한다. 이게 S3-1 의 진짜 위험이다.

3. **pg_cron 관용구가 고정돼 있다**(최신 예: `20260809150000_push_pipeline_batching.sql:656-686`).
   `DO $do$` 안에서 `cron.job` 존재 확인 → `cron.unschedule` → `cron.schedule` 재등록,
   URL/키는 `vault.decrypted_secrets`, 그리고 **`EXCEPTION WHEN undefined_table OR
   undefined_function`** 로 pg_cron 미설치 로컬을 WARNING skip.
   🚨 이 EXCEPTION 가드를 빠뜨리면 **로컬 `db reset` 이 죽는다.** 그대로 복사해 쓸 것.

4. **`job_posting_collaborators` 에는 role 컬럼이 없다** — '가입/제외' 이진 모델이다.
   RLS 정책 3개(`jpc_select` / `jpc_insert_ws_owner` / `jpc_delete_owner_or_self`)와
   트리거 3개(추가·제거 알림, 감사로그)가 그 전제 위에 있다. S3-4 는 컬럼 추가로 끝나지
   않고 **정책 재작성**이다 — 원장 지시대로 `/guard` 를 먼저 태워라.

5. **`analytics_events` 에 event 화이트리스트 CHECK 가 있다**
   (`analytics_events_event_check`, 최신 갱신 `20260811100000`). 즉 S3-5 의 "공유 출처"를
   **계측까지 연결하려면 마이그가 필요하다.** URL 에 `?src=` 만 붙이고 아무도 읽지 않으면
   그건 기능이 아니다. 그 마이그의 관용구(제약을 **이름이 아니라 정의로 찾아** 정확히 1개
   지우고 재생성, 개수가 다르면 RAISE)도 같은 파일에 있으니 따라 쓸 것.

6. **출퇴근 QR 문구가 두 파일에 하드코딩 분산돼 있다**
   (`QRCodeScanner.tsx`, `eventQRService.ts`) — 상수 파일이 없다. S3-5 의 "지원 QR 과
   문구 분리"는 새 상수 파일 신설 + 두 파일 import 전환이 선행이다.
   현재 출퇴근 QR 페이로드는 `{type:'venue', jobPostingId}` — 지원 QR 은 **다른 type** 을 써서
   스캐너가 즉시 구분하고 "이건 출근 QR 이 아니다"라고 말할 수 있어야 한다(오스캔 사고 방지).

7. **`markAsNoShow`/`cancelNoShow` RPC 의 정의 파일을 이번 정찰에서 확인하지 못했다.**
   S3-3 착수 전 `grep 'markAsNoShow|cancelNoShow'` 로 실제 정의를 먼저 찾아라 —
   집계 RPC 를 새로 만들기 전에 기존 노쇼 경로의 계약을 알아야 한다.

🔑 **마이그레이션 공통**: 접두사 충돌을 **머지 직전**에 재확인한다(08-13 현재 병렬 세션
2개 활성 — `cleanup-batch1`, `schedule-posting-top3`. 둘 다 이 세션 중에도 커밋이 늘었다).
PR 전 `list_migrations` 로 prod 반영을 실측하고, `prod-migrate` 워크플로우 경유면
**레포 파일명 = prod 기록명**이다.
⚠️ 로컬 Supabase 는 조용히 낡는다 — pgTAP 실패를 CI 대조 전에 "선재 결함"으로 단정하지 말 것.

---

## 5. 코드로 닫을 수 없는 것 — 사람 게이트로 인계

감사 §07 의 PARTIAL 항목 + 1·2단계 구현의 실기기 미검증분.

| 확인할 것 | 방법 |
|---|---|
| 오프라인 에러 문구·재시도 숨김 | 기기 비행기모드에서 상세 진입 |
| 웹 페이드아웃 중 이중 클릭 차단 | 웹 빌드에서 삭제 확인 더블클릭 |
| 조회수 실제 증가 | 인증된 **다른 계정**으로 공고 상세 진입 후 `view_count` 조회 |
| `ContactActions` 교체 후 지원자 카드 레이아웃 | 실기기에서 카드 높이·줄바꿈 |
| 펼침 상태 유지 여부 | 상세→지원자→뒤로 후 `isInfoExpanded` 관찰 |
| 웹 직접 URL 진입 후 삭제 시 잔류 | 웹에서 상세 URL 직접 진입 → 삭제 |
| `accessibilityState` 웹 무효 | react-native-web 0.21.2 — 상태는 라벨에도 담았는지 확인 |

### 2단계에서 새로 생긴 실기기 확인 항목 (2026-08-13)

| 확인할 것 | 방법 | 왜 코드로 못 닫나 |
|---|---|---|
| 마감 → **되돌리기 토스트** 실제 왕복 | 상태 뱃지 → 마감 → 6초 안에 [되돌리기] | 토스트는 앱 루트 단일 마운트라 화면을 떠나도 살아 있다. 화면을 나간 뒤 눌렀을 때의 재오픈 성공 여부는 렌더 테스트 범위 밖 |
| 확정 해제 되돌리기 **실패 경로** | 협업자 2명이 같은 자리를 두고 해제/확정 경합 | 재확정은 서버 정원 가드에 걸릴 수 있다. 실패 토스트가 실제로 뜨는지는 서버 왕복이 필요 |
| 새 지원 알림 **햅틱** | 실기기에서 다른 계정으로 지원 → 진동 확인 | jest 는 `triggerHaptic` 호출만 검증한다. OS 햅틱 설정 존중·200ms throttle 은 기기에서만 관찰 가능 |
| 🚨 새 지원 알림이 **소리를 내지 않는지** | 야간 모드/무음 아닌 상태에서 지원 유입 | 소리 금지가 이 기능의 핵심 제약(고소음·야간 현장)인데, 코드에 소리 경로가 없다는 것만으로는 푸시 채널 쪽 소리까지 보장하지 못한다 |
| 관리 화면 **스켈레톤 형상** | 느린 회선에서 지원자·정산·수정·취소요청 진입 | 형상이 도착 화면과 맞는지는 눈으로만 판정된다 |
| 상태 시트 — `capacity_full` 사유 문구 | 정원이 찬 공고에서 상태 뱃지 탭 | 트리거가 만든 상태라 로컬에서 재현하려면 좌석을 실제로 채워야 한다 |
| 재게시 프리셋이 **날짜만 비었는지** | 끝난 공고 → 다시 올리기 → 주문서 확인 | `grouped:false` 강제는 단위 테스트가 덮지만, 사용자가 새 날짜를 고른 뒤 묶음지원이 되살아나지 않는지는 폼 전체를 태워야 보인다 |
| ops 뒤로가기 맥락 보존 | **웹에서 ops 대회 상세 URL 직접 진입** 후 뒤로가기 | `fallbackHref` 는 `canGoBack()===false` 일 때만 쓰인다 — 히스토리 없는 진입을 만들어야 검증된다 |

---

## 6. 착지 절차

1. 2단계·3단계를 **의미 단위로 커밋 분리**(한 PR에 몰지 말 것 — 리뷰 불가능해진다).
2. 커밋 컨벤션 `<type>(<scope>): <한글>`. 커밋은 사전 승인 — **push·PR 은 명시 요청 시에만**.
3. 머지 직전 최신 master 재통합 + 재검증. squash 저장소라 rebase 금지, merge 사용.
4. 완료 후: `/session-end` 로 착지·최신화·정리·인계.
5. 워크트리 정리 시 정션은 `rm <path>` (재귀 금지 — 재귀면 원본 `node_modules` 가 날아간다).

---

## 7. 🔴 사람 게이트 — prod 마이그레이션 7종 (지금 남은 유일한 코드측 잔여)

> ⚠️ **2026-08-15 재리뷰에서 6번이, 2026-08-16 2축 리뷰에서 7번이 추가됐다.** 이 표를
> "5종"·"6종"으로 기억하고 움직이면 뒤가 빠진다(§8·§9 참조). 숫자를 다시 세지 말고 표를 볼 것.

이 브랜치는 마이그레이션 7개를 만들었고 **전부 prod 미적용**이다. 로컬에서는
clean `db reset` 으로 순차 적용 + pgTAP 119파일 1370건 통과를 확인했다.

| 순서 | 파일 | 내용 | 되돌리기 |
|---|---|---|---|
| 1 | `20260813110000_posting_capacity_gap_notification.sql` | 크론 + 멱등 인덱스 + 알림 함수 | 크론 unschedule + 함수 drop |
| 2 | `20260813120000_applicant_no_show_counts.sql` | 집계 RPC + 부분 인덱스 | 함수·인덱스 drop |
| 3 | `20260813130000_share_source_analytics_events.sql` | analytics CHECK 확장 | CHECK 되돌리기(값 제거) |
| 4 | `20260813140000_job_posting_announcements.sql` | 이력 테이블 + RLS + RPC | 테이블 drop |
| 5 | `20260813150000_job_posting_collaborator_role.sql` | 🔴 **RLS 권한 모델 변경** | 아래 참조 |
| 6 | `20260813160000_analytics_anon_share_events.sql` | anon INSERT 정책에 공유 2종 허용 | 정책을 옛 정의로 재생성(완전 가역) |
| 7 | `20260813170000_collaborator_role_notification_scope.sql` | 알림 팬아웃 2종을 manager 로 좁힘 | 함수를 옛 정의로 `CREATE OR REPLACE`(완전 가역) |

> 7번은 **5번이 있어야 의미가 있다**(`role` 컬럼에 의존). 다만 5번 없이 적용해도
> 컬럼 부재로 실패할 뿐 조용히 지나가지는 않는다. 1·5번 파일은 2축 리뷰 결과가
> **파일 안에 직접 반영**돼 있다(§9) — 옛 버전을 prod 에 넣지 말 것.

**순서를 지켜야 한다.**
- 5번이 4번이 만든 `jpa_select_manager` 정책을 교체하므로, 4번 없이 5번만 적용하면
  `DROP POLICY IF EXISTS` 는 조용히 지나가고 **정책이 사라진 채** 남는다.
- 6번은 3번이 넣은 CHECK 화이트리스트에 의존한다. 6번의 스모크가 그 전제를 단언하므로
  3번 없이 6번을 넣으면 **적용이 실패한다**(조용히 지나가지 않는다 — 의도한 설계다).

### 🚨 5번(S3-4)은 되돌리기가 비대칭이다 — 적용 전에 읽을 것
`is_posting_collaborator()` 의 **의미를 바꾼다**. 적용 즉시 쓰기 RPC 14종·쓰기 정책 5개가
manager 전용이 된다. `role` 이 전부 `'manager'` 기본값이라 **동작은 안 바뀌지만**,
되돌리려면 헬퍼를 옛 정의로 `CREATE OR REPLACE` 해야 하고 그 사이에 누군가 viewer 를
지정했다면 그 viewer 가 **다시 전권을 갖는다**. 롤백 시 `role='viewer'` 행을 먼저 확인할 것.

### 적용 절차
1. `mcp__supabase__list_migrations` 로 prod 최신 기록 확인(현재 `20260813100000`).
2. `prod-migrate` 워크플로우 경유 — 그러면 **레포 파일명 = prod 기록명**이 된다.
3. 적용 후 파리티 재측정: 함수 **214** / 정책 **112** 가 나와야 한다.
   (6번은 정책을 **같은 이름으로 DROP+CREATE** 할 뿐이라 net 0 이다 — 마커를 올리지 말 것.
    pgTAP 재실행으로 실측 확인했다.)
   (이 브랜치가 `parity_baseline_guard.test.sql` 마커를 이미 214/112 로 올려 놨다 —
    적용 전까지는 주간 parity-smoke 가 불일치를 보고하는 것이 **정상**이다.)
4. 🔴 **크론 확인**: `SELECT * FROM cron.job WHERE jobname='notify-posting-capacity-gap'`
   — prod 에 pg_cron 이 있으므로 EXCEPTION 가드를 타지 않고 실제로 등록되어야 한다.
   등록되면 **매일 KST 10:00 에 실제 사장들에게 알림이 나가기 시작한다.** 그 사실을 알고 적용할 것.

### 남은 정리 작업 (코드 잔여는 아니지만 빚이다)
- **Edge Function `send-job-posting-announcement` 제거** — S3-2 RPC 가 대체했다. 지금은
  호출부 0곳 + RPC 와 기능 중복. `supabase/config.toml:128` 등록 해제 + 배포가 필요해 분리했다.
- **QR 문구 전면 상수화** — `QRCodeScanner.tsx` / `.web.tsx` / `eventQRService.ts` 에 문구가
  여전히 인라인 중복이다. `e2e/` 가 리터럴을 수동 동기화하고 있어(quality 범위 밖) 한 번에
  옮기면 조용히 깨진다. S3-5 는 **이번에 실제로 건드린 문구만** 상수로 옮겼다.
- **`uniqn://` 스킴 딥링크의 `?src=` 소실** — `navigateToDeepLink` 가 `parsed.queryParams` 를
  네비게이션에 싣지 않는다. 공유 링크는 웹 URL 이라 실사용 경로는 덮이지만, 스킴 경로로
  들어온 출처는 기록되지 않는다.

---

## 8. 재리뷰 (2026-08-15) — 확정 9건 수정 · 커밋 `ba72a981f`

3차 세션의 자동 리뷰는 에이전트 20개 중 18개가 한도로 죽어 **사실상 실패**했다(`confirmed: []`
는 "결함 없음"이 아니라 "미검증"이었다). 재리뷰에서 9건을 확정하고 전부 고쳤다.

### 이번에 고친 것 — 판정축이 틀렸던 3건이 핵심

| | 무엇이 틀렸나 | 왜 안 보였나 |
|---|---|---|
| 공유 퍼널 `opened` | **양쪽 인구 모두** 기록 불가. 비로그인은 RLS+가드 트리거 이중 차단, 로그인은 별칭 리다이렉트가 `?src=` 유실 | 계측은 throw 금지라 에러가 삼켜지고 프로덕션엔 로그도 없다. 대상이 하필 "앱 없는 구직자"(=anon)라 `apply_qr` 은 영원히 공집합이었다 |
| "오늘 출근 확인" | `total - checkedIn` 뺄셈이 **퇴근자를 미출근으로** 셌다 | `checkedIn` 이 정확일치라 퇴근하면 빠진다. 전원 정상 퇴근한 저녁에 미출근이 최대가 된다 |
| "정산할 근무" | 미래 근무·취소·노쇼까지 셌다 | work_log 행은 **확정 시점**에 미래 날짜까지 생긴다. 아무도 일하기 전에 "정산할 근무 N건" |

뒤 두 건은 표시로 끝나지 않고 `selectPrimaryAction` 입력이라 **"지금 할 일" 카드를 유령 숫자가
점거**했다. 나머지 6건: blind replace 가 `write_allowed` 를 넓힌 것(제거) · 공지 연타 방어의
동시성 구멍(advisory xact lock) · 크론의 `capacity_full` 제외(포함) · 공지 수신자 예상치 축 ·
`(SELECT auth.uid())` 통일.

### 🔑 이번 재리뷰가 남긴 교훈 3가지

1. **뺄셈으로 세면 상태가 늘 때마다 조용히 틀려진다.** `total - checkedIn` 을 `scheduled` 열거로
   바꾸자 tsc 가 구성 지점 **3곳**을 잡아냈고 그중 하나는 프로덕션 코드였다. 뺄셈이었다면
   전부 지나갔다. 판정축은 타입에 이름으로 박아야 컴파일러가 대신 세어 준다.
2. **"읽기 전용 함수" 와 "읽기 가시성 판정" 은 다른 축이다.** S3-4 가 `ops_resolve_staff_work_logs`
   를 함수 단위로 "읽기" 라 세어 `_any` 로 넓혔는데, 그 안의 호출은 `write_allowed` 를 만드는
   **쓰기 권한 판정**이었다. 함수 단위로 세면 틀린다.
3. **CHECK 화이트리스트와 RLS 정책은 다른 층이다.** 값만 늘리면 "통과할 것 같은데 조용히
   거부" 가 된다. 새 이벤트를 추가할 땐 CHECK · RLS · 클라 `tk` 를 **함께** 움직일 것.

### 🔴 아직 검증되지 않은 것 (다음 세션이 반드시 할 일)

- ~~**rls-security · sql-correctness 2축은 끝내 실행되지 못했다.**~~ → **2026-08-16 완료. §9 참조.**
  (원문 보존: fable 크레딧 소진 → opus 재시도는 세션 한도. 위 9건은 검증됐지만 그 2축은 미검증이었다.)
- **미판정 4건**: 확정 해제 토스트 2개 발행 · "새 지원" 인라인 알림이 확정 해제에도 발화 ·
  확정 해제 시 즉시 푸시 · `placeholderTextColor` 다크모드.
- 검증 증거(이번 세션 실행): `npm run quality` exit 0 · jest 23스위트 226건 ·
  `db reset` 후 마이그 6종 순차 적용 · pgTAP 119파일 1370건 PASS ·
  anon INSERT 를 엔진에서 red-green 관측(tk 있으면 성공 / 없으면 가드 거부 / 화이트리스트 밖은 RLS 거부).

---

## 9. rls-security · sql-correctness 2축 리뷰 (2026-08-16) — 확정 6건, 5건 수정 · 1건 결정 기록

§8 이 "prod 적용 전 반드시" 로 남겨 둔 2축을 실행했다. **메인 세션 단독**이라 원장이
요구한 "독립 리뷰"의 형식 요건은 못 채웠다 — 다만 지난번 `confirmed: []`(=미검증)과 달리
**모든 판정에 로컬 엔진 실측 근거**가 붙어 있다. 로컬 DB 는 7종이 모두 적용된 상태였고,
그것이 prod 적용 후의 상태와 같으므로 진실원으로 썼다.

### 확정 결함과 처분

| # | 축 | 결함 | 처분 |
|---|---|---|---|
| 1 | rls-security | `is_posting_collaborator_any` 에 **anon EXECUTE** 부여 — 선언되지 않은 권한 확대 | ✅ 수정(150000 파일 내) |
| 2 | rls-security | 노쇼 이력 게이트가 `_any` 로 완화 — 배치에서 가장 좁게 설계한 프라이버시 축이 가장 넓은 티어로 | 🟡 **현행 유지 결정**(사용자 승인). 사유를 150000 주석에 기록 |
| 3 | rls-security | viewer 가 **처리할 수 없는 알림**을 받는다(취소 요청·새 지원) | ✅ 수정(신규 170000) |
| 4 | sql-correctness | 크론의 `filled` CTE 가 매일 `work_logs` **전량** Seq Scan | ✅ 수정(110000 파일 내) |
| 5 | sql-correctness | anon 공유 계측이 **공고당 시간당 120건**에서 무음 절단 | ⏸ 미수정 — 아래 잔여 |
| 6 | 규약 | `jpc_update_role_owner` 만 `auth.uid()` 를 initPlan 으로 안 감쌈 | ✅ 수정(150000 파일 내) |

### 🔑 이번 리뷰가 남긴 것

1. **헬퍼 의미를 뒤집는 설계는 "헬퍼를 안 거치는 경로"에서 샌다.** 5번(S3-4)은 쓰기 게이트
   19곳을 헬퍼 한 줄로 fail-closed 로 만들었지만, **알림 수신자 축 2곳은 헬퍼를 거치지 않고**
   `job_posting_collaborators` 를 직접 읽고 있었다. 170000 이 그래서 **직접 참조 전수 스모크**를
   같이 넣는다 — 다음에 같은 축이 또 생기면 마이그레이션이 거기서 실패한다.
2. **"권한이 안 새면 됐다"가 아니다.** 3번은 보안 구멍이 아니라 **막다른 길**이었다.
   150000 이 `ops_resolve_staff_work_logs` 에서 정확히 이 실패 모드를 피했으면서 알림 축은
   안 봤다. 권한을 나누면 **가시성·쓰기·호출(알림) 세 축**을 따로 세어야 한다.
3. **공허한 통과를 조심하라.** 크론 함수를 그냥 부르면 `0` 이 나온다 — 데이터가 없어서다.
   시드를 넣고서야 D-1/urgent/missing=3/멱등이 실제로 맞는지 알 수 있었다.

### 검증 증거 (2026-08-16 실행)

- **red-green 1건**: 170000 의 role 필터를 옛 정의로 되돌리면 viewer 가 새 지원 알림을
  받는다(`viewer_notified = t`), 되돌린 뒤 받지 않는다(`f`). owner·manager 는 양쪽 다 받는다.
- 크론 함수 시드 실행: 필요 3·배정 0 → `D-1 · 아직 3자리가 비었어요`(urgent, missing=3) 1건,
  재실행 0건(멱등). 날짜 필터 추가 후 필요 3·유효배정 1·과거 1·취소 1 → missing **2**(불변).
- 공지 RPC 실행: 같은 사람 2일치 배정 → 수신자 **1**(DISTINCT), 60초 내 재호출 `RATE_LIMITED`.
- 구조 실측: `_any` EXECUTE = authenticated/postgres/service_role(anon 제거 확인) ·
  `jpc_update_role_owner` qual initPlan 감쌈 확인 · 알림 함수 2종 role 필터 확인.
- 정책 5개 DROP+CREATE 는 baseline(`20260710000002`) 원문과 대조해 **헬퍼 이름 외 차이 없음**
  (`TO` 절 유무까지 보존). 이 배치에서 가장 위험한 조작이었으나 깨끗하다.
- E9 래칫은 UPDATE/DELETE/INSERT/ALL 4종 + 역방향까지 덮는다(마이그 인라인 스모크보다 넓다).

### 🔴 남은 잔여

- **결함 5 (미수정)**: `tk = job_id.slice(0,8)`(`analyticsService.ts:518`)이라 anon 상한이
  **공고 단위**로 걸린다. 121번째 익명 열람부터 P0001 거부 → repository 가 삼켜 무신호.
  잘리는 쪽이 하필 **가장 잘 공유된 공고**라, 인기 공고일수록 전환율이 낮게 보인다.
  160000 이 고친 결함과 **같은 계열(무음 유실)**이 더 높은 임계에 남아 있다.
  런칭 초기 트래픽에서는 도달하지 않으므로 보류했다. 고치려면 공유 이벤트를 상한
  계산에서 분리하거나, 상한 도달 자체를 별도로 세야 한다.
- **미실측**: `work_logs.no_show_at` 은 **jsonb** 다. 새 소비자 3곳이 `IS NULL` 로 판정하는데
  jsonb `'null'` 이 저장되면 SQL 은 "노쇼", 클라(`Boolean(noShowAt)`)는 "정상"으로 읽어
  축이 갈린다. 해제 경로는 `no_show_at: null` 을 보내고 PostgREST 가 SQL NULL 로 변환하는
  것으로 보이나 **이번에 실측하지 못했다.** 선재 조건(`20260813100000` 은 이미 prod)이라
  이 7종이 새로 만든 위험은 아니다.
- **결함 2 의 UI 후속**: viewer 도 타인의 노쇼 횟수를 본다. 협업자 지정 UI 의 viewer 설명
  문구가 이 사실을 담아야 한다 — 사장이 모르고 지정하면 안 된다.
- §8 의 **미판정 4건**은 이 리뷰 범위 밖이라 그대로 남아 있다.
