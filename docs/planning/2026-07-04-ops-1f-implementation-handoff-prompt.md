# T-HOLDEM ops 1f 잔여 상금 — 구현 핸드오프 (설계 완료 → writing-plans부터)

> 아래 "다음 세션 첫 프롬프트" 블록을 그대로 사용. **신선 세션 권장.**
> 작성: 2026-07-04. 상태 = **정찰·브레인스토밍·스펙 완료(사용자 승인·커밋)**. 코딩 0줄. 다음 = writing-plans → 적대검증 WF → SDD 3배치 → 검증 → prod 게이트.

---

## 다음 세션 첫 프롬프트 (복붙용)

```
T-HOLDEM ops 1f 잔여 상금 — 구현 세션. 설계는 전 세션에서 완료·승인됨.

권위 스펙(반드시 전체 읽기): T-HOLDEM-ops-1f 워크트리
  uniqn-mobile/docs/superpowers/specs/2026-07-03-ops-1f-prizes-design.md
+ 메모리 project_tholdem_ops_revival_20260623 (1f 설계 섹션)
+ 핸드오프 docs/planning/2026-07-04-ops-1f-implementation-handoff-prompt.md (환경·가드)

작업 위치: 워크트리 C:\Users\user\Desktop\T-HOLDEM-ops-1f (브랜치 feat/ops-1f-prizes, master 97a7bcaf6 기반).
⚠️ 착수 전: ①node_modules 정션 연결(PowerShell New-Item -ItemType Junction, mklink는 MSYS 경로변환 실패)
②git -C 워크트리 status 확인 ③list_migrations+get_advisors로 prod 재확인(그 사이 타 세션 머지 가능).

이번 작업(스펙 §11 파이프라인):
1. superpowers:writing-plans로 구현 계획(스펙 §3~§10을 태스크 분해, SDD 3배치 구조 = B1 DB토대/B2 RPC/B3 클라·UI)
2. 적대검증 WF(7차원: 락·동시성/anon 보안/데이터 정합/에러 매핑/pgTAP 무위/UI 배선/스펙-계획 diff) — 스펙 §12 E1~E10이 우선 타깃. verify는 신선하게 완주
3. 스펙·계획 하드닝 반영 → SDD(태스크당 implementer + 배치별 리뷰 + 최종 whole-branch opus)
4. 전 검증 GREEN 증거: npm run db:reset && npm run test:db:helpers && npx supabase test db · npx tsc --noEmit · npx jest · npm run quality
5. prod 게이트는 명시 "go" 후에만: MCP apply 4마이그 → advisor(ERROR0·anon SECDEF=monitor/player 2개 유지) → supabase.ts 수술적 정합 → push+단일 PR

가드: 한글 · 작업디렉토리 uniqn-mobile/ · 쓰기=SECDEF RPC actor바인딩 · 기존 마이그 수정 금지 ·
SDD implementer 브랜치 생성/전환 금지·mcp__supabase__* 금지(로컬 docker/npm만) · 에러코드 E6132~ ·
이벤트 컬럼명 type · enum ADD VALUE 별도 txn 마이그 · pgTAP RED-GREEN(무위 시드 금지).
```

---

## 확정 상태 (2026-07-04 설계 세션 산출)

- **워크트리**: `C:\Users\user\Desktop\T-HOLDEM-ops-1f` · 브랜치 `feat/ops-1f-prizes`(master `97a7bcaf6`). 커밋: 스펙 v1 `b9e6f2cab` + 리뷰 보완 1건(§4.2 undo 잠금 순서 — 이벤트 무잠금 선조회→id asc 잠금, §7.5 uuid Zod 그룹형 정규식).
- **사용자 결정 D1~D8**(스펙 §0): ①% = 클라 환산(서버 무변경)+"풀 기준 재계산" ②undo = active 중에만(completed 재개방 없음) ③정정/회수 = completed 후에도 허용 ④flat KO만 ⑤바운티 노출 최대(플레이어뷰 본인+전광판 KO POOL) ⑥LS-데드락 DEFERRED 전환 동반 ⑦UI 풀 재설계(PAYOUTS 2부+종료 결과 뷰, 전광판 페이아웃 표 제외) ⑧단일 PR.
- **범위 압축**: 신규 컬럼 1(`ops_participants.knockouts`)·신규 RPC 2(`ops_undo_bust`·`ops_correct_participant_prize`)·교체 1(bust v2 3인자, 구 시그니처 DROP)·확장 4(create/update·monitor/player 스냅샷)·recompute 산식 2(재진입 가산·knockout_pool)·트리거 5종 DEFERRED 전환+tournaments 트리거 신설·enum 2값·에러 E6132~E6134·마이그 4종.

## 환경 (실측 2026-07-03)

- **prod ops 전 테이블 0행** → 스키마·payload 변경 하위호환 부담 없음. OTA 계속 보류 가능.
- **환경 드리프트 해소됨**: 구 핸드오프(2026-06-30)의 "prod에만 있는 마이그 14종" 경고는 stale — staff 1종+weekly_grid 13종 전부 로컬 master `supabase/migrations/`에 존재(#219/#221). 로컬 `db:reset` = prod 재현.
- advisor: ERROR 0(184 WARN). anon-executable SECDEF ops = monitor/player **2개만**(불변 계약).
- 활성 워크트리: T-HOLDEM(master)·review·ux-fix·weekly-grid·**ops-1f**. 병렬세션 격리 준수(타 워크트리 불간섭).

## 스펙 핵심 요약 (상세는 스펙 본문이 권위)

- **§4 RPC**: bust v2(eliminator 가드 4종·참가자 2행 id asc 잠금·payload에 chips_before/eliminator_id/freed_seat_id) · undo(이벤트 선조회→복원·좌석 3분기 원좌석/auto/checked_in·KO GREATEST 0) · correct(fp NOT NULL 대상·NULL=회수·reason≤200·no-op도 이벤트).
- **§5 DEFERRED**: 5트리거 DROP→`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`(WHEN 유지·OR REPLACE 불가라 DROP→CREATE 필수) + tournaments 비용 4컬럼 트리거 신설. **기존 pgTAP 중 live_stats 단언 파일 전수에 `SET CONSTRAINTS ALL IMMEDIATE` 삽입**(grep 전수 — 최소 ops_live_stats_recompute·ops_bust_participant·ops_reseat_participants). LS 락 커밋 직전 최후 → TODOS [MED] LS-데드락 해소(완료 처리할 것).
- **§6 도메인**: `src/domains/ops/prizeCurve/` 순수함수 2종 — 환산(1,000원 내림+잔여 1위 가산, 0원 행이면 100원 강등→그래도 0이면 POOL_TOO_SMALL)·곡선표(ITM 1~10, 합계 100 고정표).
- **§12 적대검증 타깃 E1~E10**: DEFERRED 가시성(RPC가 자기 txn서 LS 읽는지 grep 전수)·이벤트 소스 의존·동시성·fp 시간순·correction↔reenter·라운딩·bounty 중도변경·enum 별도 txn·CONSTRAINT TRIGGER 제약·bust 시그니처 교체.

## 남은 ops 로드맵 (1f 이후)

- **1e 스태프 연동**(마지막 슬라이스): `ops_staff`·공고 확정 딜러 import. ⚠️설계 전 prod `staff_management_direct_add` 실체(테이블/RPC/enum) read-only 실측 필수 — 이제 로컬 마이그 파일도 있으니 파일+prod 양쪽 대조.
- 배정 2종 fast-follow 3건(TODOS)은 1f 미포함 유지. (ops) 앱 내 진입 동선 부재·칩 수동 수정 RPC는 후속 후보(스펙 §13).
- 슬라이스2+: 플레이어 포털→랭킹/포인트→전국 포털(별도 spec).
