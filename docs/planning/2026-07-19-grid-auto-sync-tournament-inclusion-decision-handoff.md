# 핸드오프 — grid-auto-sync "대회 포함" 결정 분석 (다음 세션 메인 프롬프트)

> 아래 `---` 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣는다.
> 작성 2026-07-19. 성격: **설계 결정 분석**(구현 아님, 먼저 판단).

---

grid-auto-sync에 **"대회(tournament) 포함"** 을 넣을지/어떻게 넣을지를 결정 분석한다. 구현하기 전에 설계 판단이 먼저다(brainstorming → 필요시 plan). 실사용자 0.

## 배경 — 무엇이 이미 끝났나 (건드리지 말 것)

"공급측 완결 v1"(팀 rename + grid-auto-sync **가게용**)이 **완성·리뷰·검증 완료**됐고 **머지 대기(보존 중)** 상태다.
- 워크트리: `C:/Users/user/Desktop/T-HOLDEM-team-grid`, 브랜치 `feat/team-rename-grid-autosync`, base `5b7daafdd`(master #272). 8 커밋(`58691f085`..`5f132d9a8`). node_modules junction.
- 검증(모두 실측): `npm run quality` exit0 · 전체 jest **499스위트/5645 pass** exit0 · pgTAP fresh db:reset에서 `grid_auto_sync` ok(jpc_rls5-7=사전존재 baseline, 무관) · 최종 전-브랜치 리뷰(opus) **Ready to merge**.
- SDD 진행 원장: 워크트리 `.superpowers/sdd/progress.md`. 태스크별 브리프/리포트/design-notes 동 폴더.
- **머지·push/PR·prod 마이그·OTA·flag ON은 전부 사용자 게이트.** 아직 아무것도 안 함(브랜치 보존).

## 새 요구사항 (원 스펙을 뒤집음)

사용자(도메인 오너) 확정: **"대회도 근무표에 껴도 된다 — 대회 기간 동안 몇 명 구했고 몇 명 부족한지 알아야 한다."**
- 이는 grid-auto-sync 설계 스펙(`docs/superpowers/specs/2026-07-18-grid-auto-sync-design.md` §2 D1·§3)의 **"대회 제외(venue_id NULL 유지)" 결정을 반전**한다.
- 대회 생성 경로: **주문서(order sheet)로 누구나 올림 + 관리자 승인**(ops 전용 RPC만이 아님 — 이전 가정 정정됨). 즉 `app/(employer)/my-postings/create.tsx` → OrderSheetScreen 타입 세그먼트에서 대회 선택 가능.
- **두 케이스 모두 존재(사용자 확정)**:
  - (A) **사장이 자기 가게에서 여는 대회** → 그 가게(지점) 근무표에 넣으면 자연스러움.
  - (B) **대회사가 가게 없이 여는 독립 대회** → 붙일 "가게(venue 컨테이너)"가 없음. 어디에/어떻게 인원 추적을 표면화할지 설계 필요.

## 핵심 기술 실측 (분석 출발점 — 재확인하되 신뢰도 높음)

- **파생 계산 B1은 이미 posting_type 불문**이다. `get_venue_grid_summary`(마이그 `uniqn-mobile/supabase/migrations/20260718100000_grid_auto_sync_required_count.sql`)의 `required` CTE는 venue 스팬에 걸린 공고면 종류 무관하게 requirements 좌석합을 센다. **즉 대회가 스팬에 들어오기만 하면(venue_id 세팅) 자동으로 required_count에 반영된다.**
- 대회를 뺀 지점은 딱 **연결(linkage) 두 곳**:
  1. **B4** `uniqn-mobile/src/services/jobs/jobManagementService.ts` `resolveDefaultVenueId` — `getCanonicalPostingType(input.postingType) !== 'tournament'` 조건으로 대회면 venue 자동연결 스킵(→ venue_id NULL → 스팬 밖).
  2. **B5** `uniqn-mobile/src/utils/order-sheet/venueSelection.ts:411` `applySelectedVenue` — `postingType !== 'tournament'` 가드로 칩 선택도 대회엔 미적용.
- 따라서 **케이스 (A)는 소규모 변경 가능성**: B4/B5의 대회 배제를 풀면 대회도 가게 venue에 붙어 그 가게 근무표에 인원/부족이 잡힌다. (단 아래 설계질문 검토 후.)
- **케이스 (B)는 진짜 설계 필요**: 독립 대회는 venue 컨테이너가 없음. venue_span_posting_ids(가게 스팬 SSOT)는 가게 기준이라 (B)를 자연히 못 담는다.

## 분석할 설계 질문 (이번 세션의 산출 = 판단 + 계획)

1. **"근무표(grid)"가 대회 인원 추적의 올바른 표면인가?** grid는 가게 **주간** 도구(날짜별 headcount vs required=부족). 대회는 **기간(period) 이벤트**다. 같은 grid에 얹을지, 대회 전용 hired/short 뷰가 맞는지.
2. **케이스 (A) — 가게 대회**: 대회를 가게 venue에 자동연결할까? 그러면 D-7 버스트 대회가 주간 가게 grid에 섞이는데 UX·개념상 괜찮은가? 자동연결 vs 명시 선택(칩)?
3. **케이스 (B) — 독립 대회**: venue 컨테이너 없이 어떻게? 대회 자체를 일종의 "venue 컨테이너"로 승격? 아니면 대회 전용 인원현황 화면(별도 파생)? DB SSOT(venue_span_posting_ids) 확장 필요성?
4. **관리자 승인 상호작용**: 대회는 승인 전 pending 상태. 승인 전 대회의 requirements가 required_count에 잡혀야 하나(승인 대기 중 인원 계획), 아니면 승인 후만? (B1은 현재 status 필터가 없음 — 실측 확인.)
5. **좌석 규약 정합**: 대회 requirements도 seat SSOT(`_total_positions_from_schedule` = count→headcount COALESCE·음수clamp·빈role스킵)와 같은 합으로 세는지(B1은 이미 그 식) — 대회 requirements 스키마가 동일 구조(requirements→timeSlots→roles→count)인지 확인.
6. **결정: 어디에 담나** — 이 배치(`feat/team-rename-grid-autosync`)에 **폴드인**해서 한 PR로 낼지, vs 현 가게용 배치를 **먼저 머지**하고 "대회 포함"을 **별도 후속 PR**로 낼지. (가게용은 독립적으로 완성·정확·유효.)

## 하지 말 것 (방향 반전)

- 이전 세션이 검토했던 **"대회면 venueId strip"(mappers.ts:157 `valuesToCreateInput`) 하드닝은 채택 금지** — 대회가 venue_id를 갖는 게 이제 **원하는 방향**이다. 라우트파라미터 venueId→대회 경로도 이제 (의도적으로 다듬으면) 기능에 부합한다.

## 실행 규칙

- **먼저 판단**(brainstorming/office-hours로 3렌즈: 사장·대회사·제품). 결론 나오면 `/autoplan` 또는 writing-plans로 계획. 코드는 그 다음.
- 구현하게 되면 **기존 워크트리 `T-HOLDEM-team-grid`에서 이어서**(가게용 배치가 거기 있음). 병렬 세션 있으면 격리 규칙.
- DB 변경 시: 로컬 db:reset/test:db만, **prod apply_migration은 사용자 게이트**, `mcp__supabase__*` 직접호출·기존 마이그 수정 금지. 러너=`npm run test:db:helpers && npx supabase test db`(bare `supabase` 미탑재). seat 합=SUM(SSOT식).
- ⚠️ `npx --no-install rg` 이 레포서 미동작 → `rg` 직접/Grep 도구.

## 완료 정의 (이 세션)

- 위 6개 설계질문에 대한 **명시적 판단** + (A)/(B) 각각의 처리 방안 + 폴드인/별도PR 결정 + (구현한다면) 계획 문서.
- 그 전 가게용 배치(`feat/team-rename-grid-autosync`)는 보존 상태 유지(사용자가 머지 지시 전까지).

## 참고 맥락

- 원 배치 스펙: `docs/superpowers/specs/2026-07-18-supply-launch-v1-design.md` + `.../2026-07-18-grid-auto-sync-design.md`.
- 대회 주문서화 이력: 메모리 `project_order_sheet_unification_all_types` / wiki `sources/order-sheet-unification` (대회가 주문서로 생성되는 근거).
- ops 대회 엔진: wiki `architecture/ops-engine`(대회 운영 별 트랙 — 독립 대회 케이스 B와 연관 가능).
- 배포 순서(가게용 배치, 여전히 유효): prod 마이그(20260718100000, flag OFF 안전) → OTA → `weekly_grid_enabled` ON(맨 마지막).
