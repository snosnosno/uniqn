# 핸드오프 — 공급측 완결 v1 SDD 구현 (다음 세션 메인 프롬프트)

> 아래 `---` 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣는다.

---

"공급측 완결 v1"(팀 rename · grid-auto-sync)을 **subagent-driven development**로 끝까지 구현한다. 실사용자 0 상황에 맞춰 재범위화된 완결 배치를 **원자적 출시** 준비 상태까지 만든다(배포 자체는 사용자 게이트).

## 무엇을 / 왜

세 기능(공유·워크스페이스·주간그리드) 통합 개선을, 실사용자 0에 맞춰 3조각으로 좁힌 배치. ①지금레인 #270(공유가드·OG·용어·진입점통일)은 **이미 구현됨(PR OPEN)** — 머지만. ②"워크스페이스"→"팀" 전역 rename(은닉 대신 이해 가능한 단어). ③grid-auto-sync(공고→근무표 필요인원 자동 파생)로 이중입력을 없애 그리드를 켤 수 있게 함. **홈 스트립·isSolo 숨김은 뺐고**(제로 유저엔 빈 화면·과투자), **대회사 승인 SLA·딜러(수요측) 획득은 별도 트랙**이다.

## 착수 전 필수 로드

1. **상위 스펙**: `docs/superpowers/specs/2026-07-18-supply-launch-v1-design.md` — 범위·왜·출시 순서(진실원 요약).
2. **계획 A(팀 rename)**: `docs/superpowers/plans/2026-07-18-team-rename.md` — 1 태스크.
3. **계획 B(grid-auto-sync)**: `docs/superpowers/plans/2026-07-18-grid-auto-sync.md` — 6 태스크, 실 SQL·TDD 스텝.
4. **grid-auto-sync 원죄 스펙**: `docs/superpowers/specs/2026-07-18-grid-auto-sync-design.md` — D1~D4·리스크.
5. 스킬: `superpowers:subagent-driven-development`.

## 실행 순서 (권장)

- **먼저 계획 A(팀 rename)** — 문자열 전용 저위험, 워밍업. Task 1(grep 확정 → 실패 테스트 → 일괄 교체 → 잔여 grep 0 → 커밋).
- **다음 계획 B(grid-auto-sync)** — Task 1(DB required_count 파생) → 2(repo 매핑) → 3(max 병합) → 4(비-대회 자동 venue_id) → 5(멀티 지점 칩) → 6(전체 검증).

## 실행 규칙 (엄수)

- **워크트리 격리 먼저.** 레포 기본 트리(`feat/seat-basis-posting-count`)엔 타 작업 미커밋이 있다. `superpowers:using-git-worktrees`로 **새 워크트리 + 브랜치 `feat/team-rename-grid-autosync`**. node_modules는 `mklink /J` 정션(메모리 `feedback_worktree_node_modules_junction`), Expo 라우트 0 함정 시 `EXPO_ROUTER_APP_ROOT` 절대경로(메모리 `pitfall_worktree_junction_expo_router_empty_routes`).
- **기반(#270) 결정**: 팀 rename은 #270이 새로 만든 ⋯ 메뉴 라벨('워크스페이스')을 건드린다 → **#270 base 필요**. 두 길 중 택1(세션 시작 시 확정):
  - (a) 사용자가 **#270(PR OPEN) 먼저 머지** → 최신 master에서 새 브랜치. (권장 — 리뷰 단위 정리)
  - (b) `feat/now-lane-improvements`(now-lane 워크트리)에서 이어서 작업 후 하나로 머지.
- **Task 순서 = 계획서 순서.** 각 Task: 새 서브에이전트(구현=`model: opus`)에 해당 Task 블록만 → 완료 보고 → 메인에서 **독립 검증**(VCS diff + 그 Task 테스트 실제 실행) → 통과 후 다음.
- **TDD 준수**: 실패 테스트 → 실패 확인 → 최소 구현 → 통과 → 커밋. Red-Green 스킵 금지.
- **완료 게이트(fablize)**: 커밋 전 그 Task 테스트를 이 세션에서 실제 실행한 출력으로만 통과 주장.
- **DB·서버(grid-auto-sync)**: 마이그레이션은 **작성·로컬 검증(`npm run db:reset && npm run db:test`)만**. **prod `apply_migration`은 사용자 게이트.** `mcp__supabase__*` 직접 호출·기존 마이그레이션 수정 금지(서브에이전트 프롬프트에 명시). SECDEF 하드닝(anon REVOKE·search_path) 유지. 좌석 합 = **SUM**(peak MAX 아님).
- **grid-auto-sync Task 4·5**는 대상 파일 grep 확정 스텝(경로·`get_or_create_venue_container` 반환 jsonb 키·폼 venueId 필드)을 **먼저** 밟는다(값 가정 금지).

## 완료 정의 (exit proof)

- 계획 A: `rg "워크스페이스" app src` 화면 문자열 0 + 관련 jest PASS.
- 계획 B: `npm run quality` 0/0/OK + `npx jest src/domains/weeklyGrid src/repositories src/services` PASS + `npm run db:test`(grid_auto_sync) Red→Green PASS.
- 두 계획 전 태스크 커밋됨.

## 완료 후 (사용자 게이트 — 자동 진행 금지)

- **배포 순서 BLOCKING** (역순이면 구 클라가 새 RPC 반환 형태 못 받아 깨짐):
  1. prod DB 마이그 `apply_migration`(grid-auto-sync) — `weekly_grid_enabled` OFF라 안전.
  2. OG용 CF env(`SUPABASE_URL`/`SUPABASE_ANON_KEY`) 등록 + web 재배포 + 크롤러 UA curl 실측(#270 OG).
  3. OTA(신규 클라 — 팀 rename·공유가드·venue_id 쓰기).
  4. `weekly_grid_enabled` ON (맨 마지막).
- **#270 머지·push/PR은 명시 요청 시만.** PR 전 최신 master 재통합(squash 저장소 → merge). 병렬세션이면 워크트리 격리.
- 실기기 QA(팀 rename·공유 시트·근무표 자동채움)는 사용자. 머지 후 `/ingest` wiki 졸업 + MEMORY.md 갱신.

## 참고 맥락 (이번 세션 산출)

- **3렌즈 다각 판정**(사장·대회사·제품, fable→opus 폴백, 만장일치 조건부 GO): 공유+OG=핵심 성장 루프 · "워크스페이스" 노출=1순위 사장 HIGH 마찰(→팀 rename으로 해소) · 그리드=이중입력 제거 시 생존(→grid-auto-sync) · **제품 렌즈 HIGH 맹점=로드맵 전체가 공급측, 딜러(수요측) 리텐션 부재** · 대회사 HIGH=승인 대기 대회 공유 차단 × D-7(별도 트랙).
- **왜 이 범위**: 실사용자 0 → 증분/리텐션 게이트 무의미 → 완결 한 덩어리. 단 **수요측(딜러) 획득은 이 배치가 못 푸는 별도 존재적 숙제**.
- 비개발자용 설명 아티팩트: claude.ai/code/artifact/176d2363-4c04-4fde-9259-9d685ec501ac.
