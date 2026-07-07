# ops 1e 후속 보강 + 전체 리뷰 — 다음 세션 핸드오프 프롬프트

> ops 1e 스태프 연동 SDD **코드 구현은 완료·로컬 GREEN**(HEAD `f59dcb51e`, 브랜치 `docs/ops-1e-staff-design`, 미push). 이 세션은 **비차단 follow-up 2건(테스트 커버리지 보강 + openExternalUrl 데드코드 제거) 처리 후 전체 리뷰**만 남았다. 아래를 다음 세션 첫 프롬프트로 복붙.

---

## 다음 세션 첫 프롬프트 (복붙용)

```
ops 1e 후속 보강 + 전체 리뷰를 진행한다. 본체(SDD 10태스크)는 이미 구현·로컬 GREEN·미push 상태다.

작업 위치: 워크트리 T-HOLDEM-ops-1e, 브랜치 docs/ops-1e-staff-design, HEAD f59dcb51e
(origin/master 6d960c4b5 리베이스 기반 + 문서3 + feat9 + fix1). 작업디렉토리 uniqn-mobile/.

가드(엄수): 브랜치 생성/전환 금지 · mcp__supabase__* 등 MCP 직접호출 금지(로컬 docker/npm만) ·
기존 마이그레이션 파일(supabase/migrations/) 수정 절대 금지(로직 정확·검증됨 — 이번 작업은 테스트 파일·클라 TS만) ·
prod 접근·push·PR 금지 · 한글.

착수 절차:
1. 병렬세션 격리 확인: git status(내가 안 만든 미커밋 있으면 격리). node_modules 정션 확인
   (없으면 PowerShell New-Item -ItemType Junction).
2. Part A(테스트 커버리지 보강) → Part B(openExternalUrl 데드코드 제거) → Part C(전체 리뷰) 순서.
   Part A/B는 superpowers:subagent-driven-development 또는 직접 구현, 각 변경마다 검증 명령 실행 증거 필수.
3. 각 pgTAP 추가 시 plan(N) 카운트 갱신 필수. RPC/마이그 무변경(테스트만).

검증(모든 변경 후 GREEN):
  DB 변경 → npm run db:reset && npm run test:db:helpers && npx supabase test db
  TS 변경 → npx tsc --noEmit && npx jest && npm run quality

종료선: Part A/B 커밋 + 전체 리뷰(whole-branch opus) 통과 + 전 게이트 fresh GREEN.
prod 마이그 apply·push·PR·배포는 여전히 계획 밖 = 사용자 "go" 게이트(아래 §출하 게이트).
```

---

## Part A. 테스트 커버리지 보강 (비차단 Minor — 코드는 전부 정확, 테스트 강화 여지)

> whole-branch 리뷰(opus)가 전부 **follow-up**으로 트리아지한 항목. RPC/컴포넌트 로직은 정확하므로 **테스트 추가만**(pgTAP는 `plan(N)` 갱신). 이미 fix 배치(`f59dcb51e`)에서 T4-M1·T2-M1·T3-M1·T8-M2·T8-M3·forPosting invalidate는 처리됨 — 아래는 **잔여분**.

| ID        | 파일                                                      | 보강 내용                                                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T2-M2** | `supabase/tests/ops_staff_link_import.test.sql`           | **비-NULL 동일값 no-op** 단언(현재 NULL→NULL만 검증). 이미 연결된 공고를 같은 값으로 재설정 → 이벤트 미증가·반환 동일 단언. ⚠️주의: 비-NULL 재설정은 공고 접근 게이트가 no-op 단락보다 먼저 실행됨(리뷰 T2-M2 참고) — owner가 접근권 유지하는 시나리오로 시드 |
| **T2-M3** | `supabase/tests/ops_staff_link_import.test.sql`           | **date 필터 신규 import 신원 단언**. 현재 [33]~[36]은 already-imported skipped 카운트로만 증명. 깨끗한 대회에 `p_date='특정일'` import → imported=N **및** 삽입된 ops_staff.staff_id 집합이 그 날짜 스태프와 일치 실증                                        |
| **T3-M2** | `supabase/tests/ops_staff_roster_assign.test.sql`         | 로스터 RPC 3종(add/remove/assign) **공통 에러경로** 단언: TOURNAMENT_NOT_FOUND(무효 대회 id) · actor 불일치(p_actor_id≠auth.uid() 비-admin) · outsider 멤버십 거부(`대회 운영 권한이 없습니다`). Task2가 실질 커버하나 회귀 안전망                            |
| **T4-M2** | `supabase/tests/ops_staff_security.test.sql`              | actor 바인딩 `throws_ok`의 **3번째 인자에 메시지 패턴 앵커**(예: `'%본인 계정으로만%'` 또는 `'PERMISSION_DENIED'`). 현재 P0001 SQLSTATE만 검사 → 다른 P0001 false-green 방지                                                                                  |
| **T7-M1** | `src/components/ops/__tests__/DealerPickerSheet.test.tsx` | **현재 배정자 "(현재)" 라벨** 렌더 단언 1건. `currentStaffId` 설정된 기존 테스트에 `expect(getByText(/…\(현재\)/)).toBeTruthy()` 추가                                                                                                                         |
| **T9-M2** | (fix 아님 — 문서)                                         | `new.tsx` "공고 연결 해제" 버튼은 브리프 미명시 추가 UX(테스트로 보호됨). Part C 리뷰 시 "브리프 대비 추가 = 수용" 기록만                                                                                                                                     |

**시드/롤 전환은 기존 ops pgTAP 관례(`ops_test_seed`/`ops_test_set_user` 등) 준수. 무위 시드 금지(단언 전 매칭 행 수 사전 검증). pgTAP 트랜잭션 내 `now()` 고정 함정**(연속 이벤트 created_at 동일)은 1차 이벤트 id 배제 필터로 우회(기존 테스트 관례 답습).

커밋 제안: `test(ops): 1e 후속 커버리지 — no-op/date신원/공통에러/메시지앵커/현재배정 라벨`

---

## Part B. openExternalUrl 데드코드 제거

> ops 1e ActionCard가 인앱 `router.push`로 전환하며 **앱 내 유일 프로덕션 소비처 소멸**. monitor/player 버튼은 `Share.share` 사용(openExternalUrl 아님). `getOpsBaseUrl`/`getOpsMonitorUrl`/`getOpsPlayerUrl`는 **살아있으니 보존**.

**제거 대상(실측 완료):**

- `src/services/observability/deepLinkService.ts:93` — `export async function openExternalUrl(...)` 정의
- `src/services/observability/deepLinkService.ts:123` — deepLinkService 객체 멤버 export
- `src/services/observability/index.ts:77` — 재export
- `src/services/observability/__tests__/deepLinkService.test.ts:650-664` — `describe('openExternalUrl', …)` 블록(2 테스트) 제거

**주의:**

- `app/(employer)/my-postings/[id]/index.tsx:188`·`JobPostingDetailScreen.liveOps.test.tsx:3` 은 **주석**뿐 — 코드 참조 아님(주석은 정리 선택).
- `JobPostingDetailScreen.liveOps.test.tsx:77` 은 deepLinkService **mock 팩토리**의 `openExternalUrl` 항목 — openExternalUrl이 사라지면 mock에서도 제거(테스트가 `mockOpenExternalUrl` **미호출**을 단언하므로, mock 자체를 없애도 되는지 확인 후 조정. 인앱 전환 회귀 단언이 깨지지 않게).
- 제거 전 `grep -rn "openExternalUrl"` 재실행으로 잔존 참조 0 확인.

**⚠️ 브랜치 배치 결정(사용자 확인)**: whole-branch 리뷰는 "이 PR에서 제거=scope creep, 미사용 export triage 로드맵(`docs/planning/2026-07-05-unused-exports-triage-roadmap.md`) 배치로"라고 권고. 그러나 ops-1e가 **미push**이고 이 슬라이스가 직접 데드코드화했으므로, **ops-1e 브랜치에 별도 follow-up 커밋으로 함께 정리하는 것도 응집적**. 두 경로 중 사용자 결정:

- (권장) ops-1e에 `chore(ops): 1e 후속 — 죽은 openExternalUrl 제거(인앱 전환 귀결)` 별도 커밋
- (대안) ops-1e는 최소 유지, 제거는 triage 로드맵 배치로 이관

커밋 제안(권장 경로): `chore(ops): 1e 후속 — 죽은 openExternalUrl 제거`

---

## Part C. 전체 리뷰 (whole-branch)

1. **리뷰 패키지 생성**: 워크트리에서 `.claude/plugins/.../subagent-driven-development/scripts/review-package 6d960c4b5 <새 HEAD>` (merge-base=`6d960c4b5`).
2. **whole-branch 리뷰(opus)**: superpowers:requesting-code-review 템플릿. 특별 점검 = Part A/B가 회귀를 만들지 않았는지 + 기존 whole-branch 리뷰(2026-07-08, 병합가능 Yes·must-fix0)에서 지적된 교차 관심사 유지(보안 경계 5종·work_logs 읽기전용·락 순서·N:1 owner 게이트·계층 통합·id 혼동). openExternalUrl 제거 후 미사용 참조 0 확인.
3. **전 게이트 fresh 재실행**(리뷰와 별개, 증거): `db:reset && test:db:helpers && supabase test db`(pgTAP 전건) · `tsc --noEmit` · `jest`(전건) · `npm run quality`. 정적: 마이그 신규 3파일·삭제0 유지(`git diff --stat 6d960c4b5..HEAD -- supabase/migrations`) · work_logs 쓰기 0 · anon SECDEF=monitor+player 2개.
4. Critical/Important 발견 시 단일 fix 서브에이전트로 처리 후 재검증. must-fix 0이면 종료.

---

## 참고: 본체 SDD 산출물 (이미 완료)

- 마이그 3종: `20260707100000`(M1 테이블·enum7·백스톱·RLS) / `20260707100100`(M2 RPC 5종) / `20260707100200`(M3 grants·realtime·타입). pgTAP 4파일.
- 클라: OpsStaff 타입·zod·Repository·에러매핑 → Service·Hooks(Realtime) → DealerPickerSheet·StaffTab(7번째 세그먼트)·진입점 3곳(N:1).
- 전 태스크 리뷰 Approved(Critical/Important 0). whole-branch 병합가능 Yes(must-fix 0). 최종 게이트 fresh: pgTAP 629·tsc0·jest 4884·quality0.
- 진행 원장: `.superpowers/sdd/progress.md`(워크트리, git-ignored) — 태스크별 커밋·이월 Minor 전량 기록.

## 출하 게이트 (계획 밖 = 사용자 "go" — Part A/B/C와 무관하게 최종)

스펙 §8: prod 마이그 3종 **MCP apply_migration** → `get_advisors` ERROR 0 + anon-executable SECDEF 2개(monitor/player) 불변 실측 → **push + PR** → CI 9종 → squash.
**병행 BLOCKING**: 수동 QA — iOS `SelectBottomSheet` 피커 스크롤/back 복귀(실기기).
