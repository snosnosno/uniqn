# 핸드오프 — 용어 정리 · 멤버초대 닉네임 통일 · 근무표/공고 구조 재설계 (다음 세션 메인 프롬프트)

> 작성: 2026-07-19 세션 (실기기 QA UI 결함 6뿌리 수정 완료 직후)
> 선행 브랜치: `fix/ui-foundation-6roots` (커밋 4개)
> 이 문서는 **그대로 다음 세션 첫 프롬프트로 붙여넣어도 되는** 형태로 작성했다.

---

## 0. 시작 전 확인

```bash
git -C C:/Users/user/Desktop/T-HOLDEM log --oneline -6
git -C C:/Users/user/Desktop/T-HOLDEM status --short
```

- 선행 UI 수정(6뿌리)이 master 에 반영됐는지 확인. 안 됐으면 그 처리부터.
- **실기기 QA 결과를 먼저 물어라.** 6뿌리 수정은 시각 결함이라 기계 검증으로는
  "안 깨졌다"까지만 증명됐다. 특히 SheetModal 은 앱 전역이라 회귀 보고가 있으면
  아래 작업보다 그게 우선이다.

---

## 1. 작업 A — "워크스페이스" 용어 잔재 제거 (DB 트리거)

### 배경 (중요: 클라이언트는 이미 끝났다)

클라이언트 JSX 는 이미 "팀"으로 리네이밍되어 있다. 그런데도 화면에 "내 워크스페이스"가
뜬 이유는 **그 문자열이 UI 텍스트가 아니라 DB 트리거가 생성한 데이터**이기 때문이다.
지난 리네이밍이 코드만 고치고 데이터 생성부를 놓쳤다.

### 확정된 대상 (2026-07-19 실측 확인)

`supabase/migrations/20260710000002_baseline_schema_from_prod.sql`

| 행 | 함수 | 내용 |
|---|---|---|
| 3266 | `handle_new_user()` | `... \|\| ' 워크스페이스'` → 신규 employer 가입 시 팀 이름 생성. 이름/이메일 없으면 `'내 워크스페이스'` |
| 5697 | `notify_on_workspace_invitation_insert()` | `COALESCE(v_workspace_name, '워크스페이스')` |
| 5706 | 같은 함수 | `format('%s님이 워크스페이스에 초대했어요', ...)` → 인앱/푸시 알림 문구 |

클라이언트 폴백은 이미 `'내 팀'` 을 쓴다 (`workspaceService.ts:92`,
`useEnsureDefaultWorkspace.ts:20` `DEFAULT_WORKSPACE_NAME`) — 즉 생성 경로 3개 중
DB 트리거만 옛 이름이라 **경로별로 다른 이름이 나오는 상태**다.

### 해야 할 일

1. **새 마이그레이션**으로 두 함수를 `CREATE OR REPLACE` — 기존 마이그레이션 파일 수정 금지.
2. ⚠️ **`CREATE OR REPLACE` 는 `ALTER FUNCTION ... SET search_path` 보정을 유실시킨다.**
   REPLACE 전에 `pg_proc.proconfig` 를 실측하고, 재적용해야 한다.
   (재발 2회차 함정 — wiki `sources/nickname-search-unification` 참조)
3. 기존 데이터 처리 결정 필요: 이미 `"OOO 워크스페이스"` 로 만들어진 행을
   소급 UPDATE 할지 그대로 둘지. **실사용자 0 이라 지금이 가장 싼 시점.**
4. 마이그레이션은 `mcp__supabase__apply_migration` 전용 (`db push` 금지).

### 결정 대기 항목 (사용자에게 물을 것)

- 새 기본 이름을 무엇으로 할지: `'내 팀'` / `'<이름> 팀'` / 다른 것
- 알림 문구: `"OOO님이 팀에 초대했어요"` 로 충분한지

### 곁다리로 발견된 용어 불일치 (같이 처리할지 물어볼 것)

| 용어 쌍 | 증거 |
|---|---|
| 스태프 / 직원 / 일반 | `constants/index.ts:166-168` 주석에 충돌 명시. 같은 `staff` 키가 문맥별로 3가지로 표시 |
| 배치 / 근무표 / 스케줄 | 구직자="내 스케줄", 사장="이번 주 근무표", 내부="주간 배치" |
| 대회 / 토너먼트 | 화면은 "대회", **법적 문서(약관)는 "토너먼트"** — `constants/legal/termsOfService.ts:16` |
| 팀 / 지점 | `VenueSelector.tsx:82,102` 한 화면에 나란히. 1지점 사장은 둘이 같은 실체 |

**사용자가 이미 요청한 것**: "이번 주 근무표" → "근무표" 리네이밍.

---

## 2. 작업 B — 멤버 초대를 닉네임 검색으로 통일

### 현재 상태 (2026-07-19 실측)

"사람 찾아서 추가" 흐름이 3개인데 **멤버 초대만 이메일**이고 나머지 둘은 닉네임이다.

| 화면 | 검색 방식 | 구현 |
|---|---|---|
| 멤버 초대 (`app/(employer)/workspace/invite.tsx`) | 이메일 **정확 일치** | `workspaceService.ts:204` `lookupUserByEmail` — RPC 아님, `from('users').eq('email',...)` 직접 쿼리 |
| 스태프 직접 추가 | 닉네임 prefix | RPC `search_users_by_nickname` |
| 공고 협업자 추가 | 닉네임 prefix | RPC `search_collaborator_candidates_by_nickname` |

즉 멤버 초대만 **구식 직접 테이블 쿼리**이고, 다른 둘은 SECURITY DEFINER RPC +
rate limit 까지 갖춘 최신 패턴이다. 사장이 상대방 이메일 주소를 정확히 알아야 하는
UX 부담도 이질적이다.

### 해야 할 일

1. 기존 두 닉네임 RPC 를 참고해 멤버 초대용 RPC 신설 (또는
   `search_collaborator_candidates_by_nickname` 재사용 가능한지 검토 —
   후보 필터가 "employer 로 등록된 사용자"로 달라서 아마 신설 필요).
2. **SECDEF 하드닝 3규칙 준수** (wiki `decisions/secdef-hardening`):
   - 신규 함수 anon EXECUTE REVOKE
   - `search_path` 명시
   - plpgsql NULL fail-open 차단 (`IS NULL` + `IS DISTINCT FROM`)
3. `invite.tsx` UI 를 `NicknameSearchField` 패턴으로 교체.
   플레이스홀더 `user@example.com` 와 안내문 `"구인자로 등록된 사용자만..."` 교체.
4. 구 `lookupUserByEmail` 제거 (knip 래칫 **2214** 갱신 확인).

### 주의

- ILIKE 는 btree 인덱스를 못 쓴다 — 기존 RPC 들과 같은 인덱스 전략 확인.
- 마이그레이션은 MCP `apply_migration` 전용.

---

## 3. 작업 C — 근무표/공고 구조 재설계 (가장 큼, 설계부터)

### 이미 확정된 사실 (재조사 불필요)

**두 기능은 이미 DB 레벨에서 하나다.** 재조사에 시간 쓰지 말 것.

```
근무표 "추가"  → add_direct_staff()    → work_logs (application_id = NULL)
공고 지원→확정 → confirm_application() → work_logs (application_id = 지원서id)
                                              ↓
                        venue_span_posting_ids() 로 근무표가 둘 다 읽음
```

- 운영처(venue) 컨테이너도 `job_postings` 행이다 (`status='container'`).
  `work_logs.job_posting_id NOT NULL` 제약이 이 설계를 강제했다.
- `venue_span_posting_ids(V)` = `{id | id = V OR venue_id = V}` — 집계 SSOT.
- 공고→근무표 자동연결(`resolveDefaultVenueId`)은 이미 구현됨. 지점 1개면 항상 자동 연결.

**따라서 데이터 마이그레이션은 거의 필요 없다. 문제는 순전히 UX 표면이다.**

### 왜 사장이 "연결이 되는 건지 모르겠다"고 했는가 (원인 2개, 실측 확인)

1. `utils/order-sheet/venueSelection.ts` `shouldShowVenueChips()` 가
   `venueCount >= 2` 일 때만 true → **1지점 사장은 지점 선택 칩을 평생 못 본다.**
   연결된다는 사실이 화면에 한 번도 안 나온다.
2. `components/weeklyGrid/venueDayDetailMapping.ts` 가 스태프의 출처
   (`jobPostingId` / `isContainer`)를 **매핑 단계에서 버린다** → 근무표에서
   "이 사람이 어느 공고로 왔는지" 표시 불가.
   `types/confirmedStaff.ts` 에 출처 필드 자체가 없어 타입 레벨부터 막혀 있다.

레포의 `docs/analysis/2026-07-03-weekly-grid-uxflow-dependency-analysis.md` 가
이미 이걸 예견했다 — *"밑은 튼튼하나 표면은 별관"*. W-2 항목의 "인력 허브 단일화"가
사용자 요청과 같은 방향이다.

### 사용자와 합의된 방향

**공고 = 主, 근무표 = 결과 보기** (사용자가 선택지에서 명시 선택).

그리고 재정의 하나:

> **"공고"를 "모집 광고"가 아니라 "그 날 일할 자리"로 재정의하고, 모집 여부는 스위치로.**
> - 자리 만들고 모집 ON → 지원자 받음
> - 자리 만들고 모집 OFF → 단골 직접 배정

사용자 반응: *"맞는거같은데 이설계의 장단점이 뭐지"* → 장단점 설명함(아래) → 그 후
"UI 결함 먼저" 를 선택해 이번 세션은 UI 만 했다. **구조 작업 착수 승인은 아직 안 받았다.
다음 세션에서 다시 확인할 것.**

### 이 재정의를 뒷받침하는 결정적 근거

**지금 근무표로 꽂은 단골은 급여 정보가 없어 정산이 비어 있다.**

- `add_direct_staff(p_job_posting_id, p_staff_id, p_assignments)` — **급여 파라미터가 없다.**
  assignments 는 날짜/역할만.
- 정산은 `roles[].salary`(공고 `schedule.requirements`) 또는 `workLog.customSalaryInfo`
  를 읽는다 (`domains/settlement/helpers.ts:74,94,180`).
- 컨테이너는 rigid JobPosting 이 아니다 — `domains/weeklyGrid/venueContainer.ts:4` 명시.
  따라서 `schedule.requirements[].roles[].salary` 가 없다.

→ **UX 문제가 아니라 이미 발생 중인 데이터 결함.** 자리 기반으로 가면 자동 해소된다.
이게 재정의의 가장 강한 근거이므로 설계 문서에 반드시 실을 것.

### 장단점 (사용자에게 이미 설명한 내용 — 재활용)

**장점**
1. 지금 깨진 정산이 고쳐진다 (위 근거)
2. DB 거의 안 건드림 — 이미 `work_logs` 통합
3. 개념 3개(워크스페이스/운영처/공고) → 2개
4. QR 출퇴근·알림·정산이 이미 공고 기준 배선이라 단골도 그대로 혜택

**단점 — 이쪽이 더 중요**
1. **단골 한 명 넣는 마찰 증가** (지금은 날짜+역할, 앞으로는 시간·급여까지)
   → 완화 필수: `useCopyLastWeek`(이미 있음)와 템플릿을 전면 배치.
   **이 완화책 없이 출시하면 사장이 더 불편해진다.**
2. "모집 안 하는 공고"가 내 공고 탭에 쌓임 → 모집중/전체 필터 필수
3. 기존 급여 없는 work_logs 행 처리 결정 필요 (실사용자 0 = 지금이 최적기)
4. **`venue_span_posting_ids` · `get_venue_grid_summary` · 좌석 트리거 · R1 SKIP 로직
   연쇄 영향** ← 진짜 위험 구간
5. 인지 저항: "모집 안 하는데 왜 공고를 써?" → 이름 변경 검토 필요
   (사용자에게 선택지 제시했으나 미결)

### 착수 방법

1. `/autoplan` 또는 `superpowers:brainstorming` 으로 설계 먼저. **3+ 파일 = HARD-GATE, 코드 금지.**
2. 설계 문서에 반드시 포함: 위 단점 4번의 RPC 연쇄 영향 범위를 파일:라인 단위로.
3. 단점 1번(마찰) 완화 설계가 없으면 착수하지 말 것.
4. 사용자 명시 승인 후 구현.

### 함께 처리할 사용자 요청

- "이번 주 근무표" → **"근무표"** 리네이밍 (작업 A 와 묶어도 됨)

---

## 4. 이번 세션(2026-07-19)에서 이미 끝난 것 — 중복 금지

브랜치 `fix/ui-foundation-6roots`, 커밋 4개. 실기기 QA 결함을 원인별 6뿌리로 접어 수정.

| 뿌리 | 수정 |
|---|---|
| 1·2 | `SafeAreaView` → `useSafeAreaInsets()` 패딩 (SheetModal/Modal/QRCodeScanner/BoardImageViewerOverlay) + 시트 내용 기반 높이 |
| 3 | `Button` 보간 children 을 `React.Children` 평탄화로 판정 후 `<Text>` 래핑 |
| 4 | 선택 시트 옵션 `dark:` 짝 6곳 + 래칫 가드 |
| 5 | `useTabBarBottomPadding` 훅 추출 + 탭 화면 7곳 적용 |
| 6 | `Button` outline 테두리 WCAG 3:1 (secondary-600) |

검증: `tsc` 0 · `quality` 0 errors · `jest` 487 suites / 5571 tests 통과.
**갭: 시각 결함이라 실기기 확인 미완.**

### 이 과정에서 배운 것 (다음 세션도 해당)

1. **에이전트 보고를 그대로 믿지 말 것.** 확성기 버튼을 "테두리 대비 문제"로 결론낸
   보고가 스크린샷과 모순됐고(16:1 텍스트가 안 보일 리 없음), 파고드니 완전히 다른
   렌더 버그였다. 스크린샷/실측과 안 맞으면 그게 신호다.
2. **ESLint 훅이 막으면 우회하지 말고 규칙 근거를 읽을 것.** 2026-04-19 sweep 규칙을
   모르고 위반했는데, 근거를 읽은 덕에 더 정확한 원인(삼항 × 포탈 교집합)을 찾았다.
3. **다크모드 규칙**: 삼항/템플릿 안에서는 `dark:*-off-white` 금지(정적 추출 실패),
   CSS 변수 토큰 단독도 gorhom 포탈 안에서는 실패. 정답은
   `text-content-primary dark:text-content-primary` (같은 토큰 반복).

---

## 5. 권장 순서

```
0. 실기기 QA 결과 확인 (회귀 있으면 최우선)
1. 작업 A (용어) — 작고 독립적, DB 마이그레이션 1건
2. 작업 B (멤버초대) — 중간, RPC 신설 + UI 교체
3. 작업 C (구조 재설계) — 설계부터, 별도 승인 필요
```

A·B 는 서로 독립이라 병렬 가능. C 는 설계 승인 게이트가 있으므로 마지막.

---

## 6. 프로젝트 규약 리마인더

- 응답·커밋·문서·주석 **전부 한글**
- 커밋 사전 승인됨 (로컬). **push/PR 은 명시 요청 시만**
- 기본 브랜치면 feature 브랜치 먼저
- Supabase 마이그레이션 = MCP `apply_migration` 전용, `db push` 금지
- 기존 마이그레이션 파일 수정 금지 — 항상 새 파일
- 서브에이전트 모델 라우팅: 읽기=haiku/sonnet · 구현=opus · 설계/검증/판정=opus
  (**fable 은 현재 사용 불가** — 사용자 지시)
- 완료 주장 전 이 세션에서 실행한 증거 필수
