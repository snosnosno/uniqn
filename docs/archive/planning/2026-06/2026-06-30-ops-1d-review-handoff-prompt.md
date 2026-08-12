# T-HOLDEM ops 1d(bust/재진입/ITM) — 리뷰·출하 게이트 핸드오프 프롬프트

> 아래 블록을 다음 세션 첫 프롬프트로 그대로 사용. **신선 세션 권장.**
> 작성: 2026-06-30 (1d 구현·SDD·최종리뷰 완료 직후). 이 세션은 **재구현이 아니라 검토→출하 게이트**.

---

T-HOLDEM ops 1d(bust/재진입/ITM)가 **로컬 브랜치에 구현·전 검증·최종 whole-branch 리뷰(opus)까지 완료**됐다. 다음은 **신선 컨텍스트 검토 후 출하 게이트**(prod 마이그 apply → advisor → supabase.ts → push+PR+CI+머지)를 진행한다. 재구현 금지.

## 현황 (직전 세션 2026-06-30 완료)
- **브랜치 `feat/ops-1d-bust-reentry-itm` @ `3a857df51`** (master `de8706d15` 기준 19커밋, **로컬·미push**). 워킹트리 깨끗.
- **범위**: bust(탈락→finish_position/busted_at·상금 자동매핑·좌석해제·우승 자동확정) + 재진입(카운터/가드) + 고정금액 상금구조(`ops_prizes`·PAYOUTS 탭). 사용자 결정으로 1f였던 ITM 서피스를 1d로 통합.
- **신규 마이그 3종(additive·prod 미적용)**: `20260630120000_ops_1d_prizes_table.sql`(테이블+RLS+enum `prize_structure_set`) · `20260630120100_..._rpcs.sql`(RPC 3종) · `20260630120200_ops_1d_grants.sql`(anon REVOKE). `ops_participants` ALTER 0(1a forward-set). 기존 1a/1b/1c RPC 무변경.
- **신규 RPC**: `ops_bust_participant(p_participant_id, p_actor_id)` · `ops_reenter_participant(p_participant_id, p_actor_id)` · `ops_set_prize_structure(p_tournament_id, p_actor_id, p_prizes jsonb)`. 전부 SECDEF·actor 바인딩·P0001.
- **데이터레이어/UI**: Repository 명시 snake→camel 매핑·`OpsPrizeRepository`·Service(Zod)·훅(`useBustParticipant`/`useReenterParticipant`/`useOpsPrizes`/`useSetPrizeStructure`)·PLAYERS 탭 bust/재진입·PAYOUTS 6번째 탭(dirty 플래그)·플레이어뷰 비-ITM 순위.
- **에러코드** E6123~E6128(opsRpcError PREFIX_MAP).
- **검증(직전 세션, 로컬)**: pgTAP 368(38파일·신규 bust22/reenter15/prize12 포함)·jest 4533·tsc0·quality0err. **재진입 충돌 회귀 RED-GREEN 증명**(v_finish:=v_active 직접대입→23505 FAIL→원복→GREEN).
- **방법론 산출물**: 스펙 `uniqn-mobile/docs/superpowers/specs/2026-06-29-ops-1d-bust-reentry-itm-design.md`(적대검증 §14) · 계획 `uniqn-mobile/docs/superpowers/plans/2026-06-30-ops-1d-bust-reentry-itm.md` · SDD ledger `.superpowers/sdd/progress.md`(태스크 1~14 + 최종리뷰).

## 확정 불변식 (검토 시 회귀 없는지 재확인)
①finish_position="생존수 이상 최소 미사용 순위"(generate_series — 재진입/좌석전이로도 부분UNIQUE 23505 불가, ❌`v_active` 직접대입 금지) ②in-play=`status='active'` 단일정의(bust적격·v_active·우승후보 일치) ③advisory xact 락 키=로컬 `v_tournament_id`(bust/reenter 동일키, 락먼저→대회 FOR UPDATE) ④마지막 active(v_active<=1) bust 거부(PARTICIPANT_LAST_SURVIVOR) ⑤우승: v_active2=1시 winner FOR UPDATE→fp=1+rank1 prize+completed·winner status 유지·비-active 마지막이면 미확정 ⑥좌석 id 오름차순 FOR UPDATE ⑦set_prize_structure: completed 거부·rank>0/amount>=1/중복/NULL 거부·replace-all ⑧RPC snake→Repository camel 명시매핑 ⑨E6123~E6128·anon REVOKE·SECDEF search_path.

## 최종 리뷰 결과 (opus): Ready to merge — Yes
- **Critical/Important 0건.** 불변식 ①~⑨ 전부 최종 SQL/TS 실재 확인.
- **Minor(전부 데이터무해·자기치유·머지 차단 아님)**:
  - **[후속 견고화 1순위] 락 순서**: bust가 참가자 FOR UPDATE(step2)를 advisory(step4)보다 먼저 → 2명 active에서 서로 다른 참가자 동시 bust 시 데드락(40P01) 협소창. 자기치유(재시도 INVALID_STATUS)·**prod ops 0행**이라 실피해는 "친절 메시지 대신 일반 에러"뿐. 스펙 §3.1 설계 내재. 견고화=advisory를 참가자 락보다 먼저 취득(비잠금 SELECT로 tournament_id 선취→advisory→참가자 FOR UPDATE) + 스펙 동기화. pgTAP 단일 txn으론 미검증 영역.
  - set_prize_structure 비-숫자 jsonb 캐스트 22P02 미방어(클라 Zod가 막음·신뢰경계 방어깊이 보완 권장).
  - reenter auto-seat `ORDER BY table_no,seat_no`(register 미러, 스펙 텍스트는 id — 무해).
  - Repository null-data TypeError 이론상(기존 registerWithEvent 동일)·requireActor 3중복·listPrizes logger 부재·PayoutsTab isLoading 스피너색.

## 검토 절차 (신선 컨텍스트)
1. **메모리** `project_tholdem_ops_revival_20260623` + MEMORY.md. 스펙·계획·ledger 일독.
2. **로컬 재검증**(증거 기반): `cd uniqn-mobile && npm run db:reset && npm run test:db:helpers && npx supabase test db`(pgTAP 368) · `npx jest`(4533) · `npx tsc --noEmit`(0) · `npm run quality`(0err). 전부 GREEN 증거 확보.
3. (선택) **신규 리뷰 WF**: 불변식 ①~⑨를 다차원 find→adversarially-verify로 재확인(직전 적대검증이 세션 한도로 verify 절반 실패했던 이력 — 신선 세션서 보강 가치). 락 순서 Minor의 실제 데드락 재현/심각도도 판정.
4. **후속 견고화 결정**: 락 순서를 출하 전 고칠지 / 별도 PR로 미룰지 사용자 확인. (고치면 RPC 2종 재수정+pgTAP+적대검증 재실행 — 핵심 RPC 재손댐 위험 vs 데드락창 제거 trade-off.)

## 출하 게이트 ("go" 후에만 — 순서 엄수)
1. **prod 3마이그 MCP `apply_migration`**(20260630120000/120100/120200) — `ygfxukhktpqymahfrvbz`. ⚠️enum ADD VALUE(M1)와 RPC(M2) 별도 apply(다른 txn).
2. **`get_advisors`**: ERROR 0 · function_search_path_mutable에 신규 ops 부재 · **anon-executable SECDEF=monitor/player 2개만 유지**(신규 3종 anon REVOKE 확인) · ops_prizes RLS.
3. **`supabase.ts` MCP gen → prettier** 후 additive 확인(신규 RPC/테이블 타입).
4. **push + PR**(`feat/ops-1d-bust-reentry-itm`) → CI 9/9 → squash 머지.
5. **OTA 보류**(prod ops 0행). ops.uniqn.app 2nd CF Pages는 사용자 게이트.

## 세션 종료: 메모리+ledger 갱신 + `/session-wrap`. 졸업: 1d 완료분 `/ingest`로 wiki. 다음 게이트=1e(스태프 연동)·1f 잔여(백분율 prize·풀곡선·바운티·정정).

핵심 한 줄: 1d가 로컬에서 구현·전검증·최종리뷰(Ready:Yes)까지 끝났으니, 다음 세션은 신선 컨텍스트로 재검증·(선택)적대검증 보강 후 prod 마이그 apply→advisor→supabase.ts→PR→머지의 출하 게이트를 "go" 후 진행하고, 락 순서 데드락 협소창만 출하 전 고칠지 결정한다.
