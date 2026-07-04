# T-HOLDEM ops 1f 잔여 상금 — SDD 구현 핸드오프 (계획+적대검증+하드닝 완료 → SDD부터)

> 아래 "다음 세션 첫 프롬프트" 블록을 그대로 사용. **신선 세션 권장 · 구현 모델 = Opus 4.8(사용자 지정).**
> 작성: 2026-07-05. 상태 = **계획 v2(적대검증 하드닝 18건 반영·커밋). 코딩 0줄.** 다음 = SDD 3배치 → 전 검증 GREEN → prod 게이트("go" 대기).

---

## 다음 세션 첫 프롬프트 (복붙용)

```
T-HOLDEM ops 1f 잔여 상금 — SDD 구현 세션. 계획·적대검증·하드닝은 전 세션에서 완료됨(재계획 금지).

권위 문서(반드시 전체 읽기): 워크트리 C:\Users\user\Desktop\T-HOLDEM-ops-1f
  ① 계획(구현의 유일 준거): uniqn-mobile/docs/superpowers/plans/2026-07-04-ops-1f-prizes.md
     — 12태스크(B1: T1~T2 / B2: T3~T6 / B3: T7~T12), SQL·TS 전문 인라인, 🔨H 마커 = 적대검증 하드닝
  ② 스펙(계약 준거): uniqn-mobile/docs/superpowers/specs/2026-07-03-ops-1f-prizes-design.md
     — §12.5 적대검증 하드닝 이력(H1~H21) 필독. 계획과 충돌 시 스펙 §12.5 > 계획 > 스펙 본문
  ③ 메모리 project_tholdem_ops_revival_20260623 (1f 섹션)

작업 위치: 워크트리 C:\Users\user\Desktop\T-HOLDEM-ops-1f (브랜치 feat/ops-1f-prizes,
  HEAD = docs 커밋 3개: 720a22458 계획 / c64a6b4ab 하드닝 / b68aacd4e 스펙). 코드 0줄 — 마이그·src 무변경.
착수 전 점검: ①node_modules 정션은 이미 연결됨(Test-Path로 확인만, 끊겨 있으면 PowerShell
  New-Item -ItemType Junction -Target 메인레포 uniqn-mobile\node_modules — mklink는 MSYS 경로변환 실패)
②git -C 워크트리 status(clean 확인) ③docker 로컬 스택 기동(npm run db:start) — prod 재확인은 불필요
  (직전 실측: 마이그 최신 ops_seat_assignment_*, advisor ERROR0, anon SECDEF ops 2개. 단 prod 게이트 직전 재실측).

이번 작업(계획 §11 파이프라인 3~5단계):
1. superpowers:subagent-driven-development로 계획 T1~T12 실행 — 태스크당 fresh implementer +
   배치별 리뷰(B1/B2/B3 경계) + 최종 whole-branch 리뷰(opus). 태스크 순서 엄수(T2가 기존 pgTAP를
   이행해야 T3~ 테스트가 성립).
2. 전 검증 GREEN 증거(컨트롤러 직접 재실행): npm run db:reset && npm run test:db:helpers &&
   npx supabase test db · npx tsc --noEmit · npx jest · npm run quality
   + 계획 "최종 게이트" 체크리스트(TODOS LS-데드락 완료 처리·E1 grep 전수·H8 ops_prizes 권한 실측)
3. prod 게이트는 사용자 명시 "go" 후에만: MCP apply_migration 4종(20260704100000~100300) →
   get_advisors(ERROR0·anon SECDEF=monitor/player 2개 유지) → H8 권한 실측 → supabase.ts MCP gen
   정합(수술본과 diff) → push + 단일 PR(D8) → CI → squash.

가드: 한글 · 작업디렉토리 uniqn-mobile/ · 쓰기=SECDEF RPC actor바인딩 · prod 적용된 기존 마이그 수정 금지
  (신규 1f 마이그 4종은 T3~T5가 같은 파일에 이어서 작성 — 계획 명시) · SDD implementer 브랜치 생성/전환
  금지·mcp__supabase__* 금지(로컬 docker/npm/npx만) · 에러코드 E6132~E6134 · 이벤트 컬럼명 type ·
  enum ADD VALUE 별도 txn(마이그1) · pgTAP RED-GREEN·무위 시드 금지·plan(N) 정확 일치.

⚠️ 세션 한도 주의: 전 세션에서 서브에이전트 대량 병렬(WF finder 7 + verify 25)로 계정 세션 한도를
  2회 소진했음(각 ~5h 리셋). SDD는 태스크당 순차 1 implementer라 부담이 훨씬 작지만, 병렬 리뷰를
  과하게 띄우지 말 것. 한도 도달 시: 진행분 커밋 → 리셋 시각 확인 → ScheduleWakeup 체인으로 자동 재개.
```

---

## 전 세션(2026-07-04) 산출 요약

- **계획 작성**(`720a22458`): 정찰(DB 마이그 전문 6종 직접 + 클라 데이터/UI Explore 2) → writing-plans.
  12태스크 = B1(T1 마이그1: enum2·knockouts·**ops_events.seq**·CHECK 2종·ops_prizes REVOKE / T2 LS DEFERRED
  풀 사이클) · B2(T3 bust v2+**자동확정 보류 가드** / T4 undo / T5 correct+create/update+스냅샷2 / T6 grants+
  security pgTAP+supabase.ts 수술+HistoryTab 라벨) · B3(T7 prizeCurve / T8 에러·스키마 / T9 데이터 레이어 /
  T10 PlayersTab 추출+bust 확인 다이얼로그+피커 스크롤 / T11 PAYOUTS 2부 / T12 결과뷰·KO POOL·바운티 폼·공개 표면).
- **적대검증 WF**(7차원 find → verify): 발굴 25건(중복 제거 18건) — **전건 실재 판정·하드닝 반영**(`c64a6b4ab`).
  verify 서브에이전트가 세션 한도로 1건만 완주 → 나머지 24건은 컨트롤러가 스펙·계획·실코드 실측으로 직접
  판정(ConfirmModal 실존·SelectBottomSheet 비스크롤·create/update 배선은 추가 실측). 기각 0.
  상세 = 스펙 §12.5 표(H1~H21). 핵심: H11 `ops_events.seq`(created_at은 txn 상수 — undo 최신 이벤트
  선별 비결정), H12 자동확정 보류(checked_in 생존자 고아화 차단), H3 피커 스크롤(CRITICAL — 6인 이상
  도달 불가), H4 bust 확인 단계 복원(D2 비가역), H9/H10/H13 pgTAP 흐름·무위 교정.
- **의도된 편차 3건**(계획 Self-Review §2): ①bounty 음수=DB CHECK(+상한 1억) ②update bounty=key-presence
  ③수정 폼 Out(update RPC는 서버 선행 계약만 — 클라 update 배선 넣지 말 것).

## 환경·게이트 리마인드

- prod ops 전 테이블 0행(스키마 자유). 로컬 db:reset = prod 재현(드리프트 해소 상태).
- anon-executable SECDEF ops = monitor/player **2개 불변 계약**(prod 게이트에서 재실측).
- 검증 명령 순서 필수: `db:reset` → `test:db:helpers` → `npx supabase test db`(reset이 헬퍼를 지움).
- docker psql 직접 실행 시 `MSYS_NO_PATHCONV=1`.
- OTA는 계속 보류 가능(prod ops 0행). ops.uniqn.app 2nd CF Pages = 사용자 게이트(비차단).
- 1f 이후 로드맵: 1e 스태프 연동(마지막 슬라이스 — 설계 전 prod staff_management_direct_add 파일+prod 대조).
