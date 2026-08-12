# 구인자 공고상세 개선 — 실행 원장 (2026-08-13 개설)

> **다음 세션은 이 문서부터 읽는다.** 감사 원본은 `docs/analysis/2026-08-12-employer-posting-detail-ux-audit.md`
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

## 1. 현재 상태 (2026-08-13 실측)

```
브랜치   fix/posting-detail-honesty-20260813   (origin/master +2, 미푸시)
워크트리 C:/Users/user/Desktop/T-HOLDEM-wt-honesty
커밋     e1b41c15c feat(employer): 공고상세 허브 신호 묶음
         7be60d83c fix(employer): 공고상세 정직성 묶음
base     8b08010aa (origin/master)
```

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

---

## 3. 2단계 — 구조 (12건). 권장 순서대로.

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

## 4. 3단계 — 신규 기능 (7건)

| # | 항목 | 규모 | 비고 |
|---|---|---|---|
| S3-1 | D-2·D-1 정원 미달 크론 알림 + 배정 줄 D-day 경고 | `M` | 멱등키 `posting_id + d_offset`. 마이그 필요 |
| S3-2 | 확정 스태프 일괄 공지 (신규 타입 `employer_notice` + 발송 이력) | `M~L` | 단톡방 이탈을 막는 유일한 수단. 마이그 필요 |
| S3-3 | 지원자 노쇼 이력 칩 (집계 RPC, 횟수만·업장 비노출) | `M~L` | **낙인 방지 설계 필수**. warning 틴트만 |
| S3-4 | 협업자 권한 2단 (viewer / manager) | `L` | **RLS 가 진짜 게이트** — `/guard` 먼저 |
| S3-5 | 공유 출처 파라미터 + 지원용 QR | `M` | 🚨 출퇴근 QR 과 **문구를 반드시 분리**(오스캔 사고) |
| S3-6 | 상세 트리 탭 컨테이너 개편 (형제 push → 상단 탭) | `L~XL` | 원장 **W2-6** 트랙과 통합 계획. 단독 착수 금지 |
| S3-7 | ops 스택 브레드크럼 / `fallbackHref` 정비 | `S~M` | ops 3화면의 `fallbackHref` 가 구인자 맥락 상실 |

🔑 **마이그레이션이 있는 항목(S3-1·2·3)은**: 접두사 충돌을 **머지 직전**에 재확인하고
(병렬 세션이 같은 슬롯을 딴다), PR 전 `list_migrations` 로 prod 반영을 실측한다.
`prod-migrate` 워크플로우 경유면 **레포 파일명 = prod 기록명**.

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

---

## 6. 착지 절차

1. 2단계·3단계를 **의미 단위로 커밋 분리**(한 PR에 몰지 말 것 — 리뷰 불가능해진다).
2. 커밋 컨벤션 `<type>(<scope>): <한글>`. 커밋은 사전 승인 — **push·PR 은 명시 요청 시에만**.
3. 머지 직전 최신 master 재통합 + 재검증. squash 저장소라 rebase 금지, merge 사용.
4. 완료 후: `/session-end` 로 착지·최신화·정리·인계.
5. 워크트리 정리 시 정션은 `rm <path>` (재귀 금지 — 재귀면 원본 `node_modules` 가 날아간다).
