# 핸드오프 — ops 전면 개방 S1 구현 (다음 세션 메인 프롬프트)

> 2026-07-16 /autoplan 3중 리뷰(CEO·디자인·엔지니어링) 완료 + 사용자 결정 9건 확정 후 작성.
> **이 세션의 범위는 S1만.** S2(한도+entitlement)·S3(웹 결제)는 별도 핸드오프.

---

## 메인 프롬프트 (새 세션에 그대로 붙여넣기)

ops(라이브 대회 운영) 전면 개방 S1을 끝까지 구현해줘.

**필독 (착수 전 전부 Read)**:
1. `docs/planning/2026-07-16-ops-open-access-monetization-design.md` — 확정 설계. 특히 §5-S1(스코프)·§9(상태 매트릭스·다크패턴 3원칙·a11y)·§11(k-holdem 갭 — S1 흡수분)·§12(모드/유저플로우/UX 하드 룰)·§7.4(결정 기록)
2. `wiki/architecture/ops-engine.md` — ops 데이터 모델·이벤트 스파인·RLS 계약
3. 결정 확정본: §12.0 — F1(S3는 수동판매 실증 후)·F3(1차 owner 단위)·F7(패키지 정의)·한도 동시1/엔트리40 잠정(누적)·d4 복제 포함·D3 하드컷+사전배너·D5 진입표면 조합
4. `docs/superpowers/specs/2026-07-17-ops-tv-monitor-preset-slots-design.md` — **C6(TV 프리셋+5슬롯) 확정 설계**(결정 T1~T6). C1·C2를 확대·대체하는 계약이므로 C 계열 착수 전 필독

**작업 시작 프로토콜 (병렬 세션 상존 — 필수)**:
- `git status` 확인 → 내가 만들지 않은 미커밋 변경이 있으면 **새 워크트리+브랜치**(`feat/ops-open-access-s1`)로 격리
- 워크트리 시 함정 2개: ①node_modules는 `mklink /J`로 메인 레포 junction(5분 절약) ②expo 실행 시 `EXPO_ROUTER_APP_ROOT=<워크트리>/app` 절대경로+`--clear` (라우트 0 함정)
- 미커밋 산출물 주의: 설계 문서·TODOS.md 변경이 메인 트리에 미커밋 상태로 있음 — 먼저 docs 커밋 1개로 격리 후 시작 권장

**모델 라우팅**: 구현=메인(opus급)·코드 직후 code-reviewer(fable)·완료 전 verify. 서브에이전트 금지사항: `mcp__supabase__*` 직접 호출 금지·기존 마이그레이션 수정 금지·PROD 우회 금지.

---

## S1 태스크 (설계 §5-S1 + §11 흡수분 + §9 디자인 게이트)

### A. 진입 개방 (서버 변경 0)
- [ ] **A1. 진입 표면 "조합"(D5 확정)**: ①프로필 메뉴에 "라이브 운영" 항목 ②1회성 신기능 안내(기존 튜토리얼/안내 패턴 재사용) ③스케줄 빈 상태 크로스링크. 홈 탭 상시 노출은 하지 않음
- [ ] **A2. 재개 카드(d2, 규칙 확정)**: active 최신 1건 > 당일 upcoming 1건 > 없으면 카드 미노출. 구성 3요소: 대회명/상태 배지/보조 메타. "당일" 판정 KST 00~09시 고정 시계 테스트 필수(알려진 플레이크)
- [ ] **A3. (ops) 목록 개편(D11)**: 빈 상태 3단 구성(인지+가치+"첫 대회 만들기" CTA)·raw gray→디자인 토큰·스피너→Skeleton(공간 예약, impeccable 룰16)
- [ ] **A4. 대회 복제(d4 확정)**: "지난 대회와 같은 설정으로 새 대회" — 블라인드 구조+설정 복사. 신규 RPC 필요 시 신규 마이그레이션으로(기존 수정 금지), anon+authenticated EXECUTE REVOKE+`has_function_privilege` pgTAP

### B. 악용 방어 (F2 — 개방 전제조건, 개방과 같은 PR)
- [ ] **B1. 공개뷰 noindex** (`live/[view_token]`·`monitor/[token]` 웹 meta)
- [ ] **B2. 신고 경로(D7 스펙)**: 헤더 오버플로 ⋯ 또는 최하단 캡션급 링크(상시 버튼 금지)·익명 폼(사유: 사행성/불법 도박/기타+선택 상세)·접수 후 재신고 rate limit·터치 44px hitSlop
- [ ] **B3. 약관 사행성 금지 조항** — 단일소스 `src/constants/legal/`만 수정(HTML/화면 직접 수정 금지)
- [ ] **B4. 금액 필드 노출**: 1차는 전 티어 동일 노출(E11 확정 — 차등 없음, 작업 없음 확인만)

### C. 실데이터 표면 보강 (§11 S1 흡수분)
- [ ] **C1. 다음 브레이크 카운트다운 — 3표면 동시**(운영 STATUS·플레이어 뷰·TV 모니터): `ops_blind_levels.is_break`+클럭 앵커로 계산. 운영자 표면은 클라 계산 가능(전체 레벨 보유). 공개 2표면은 RPC(`ops_get_monitor_snapshot`·player view) 반환 필드 확장 필요 — **함수 교체는 신규 마이그레이션**(CREATE OR REPLACE, 기존 파일 수정 금지)+SECDEF 3규칙(search_path·REVOKE·NULL 가드) 준수. 표면별 드리프트 금지(§12.4-4: 동일 데이터 소스)
- [ ] **C2. TV 모니터 보강 → C6로 확대·대체 (2026-07-17)**: payouts는 상위 5를 프라이즈 패널로, 등록 마감은 `regStatus` 슬롯 모듈로 노출(패널 배지 없음 — 스펙 T4). 스냅샷 확장 편승은 동일하되 구체 계약은 C6 스펙 §4를 따름
- [ ] **C3. HISTORY 라벨 6종 보완**: `HistoryTab.tsx` EVENT_LABEL에 posting_linked/unlinked·staff_imported/added/removed·table_staff_assigned/unassigned 한글 라벨
- [ ] **C4. 상금 지급 마킹**: 지급 완료 체크(참가자 상금 행 paid_at) — 신규 마이그+이벤트(`prize_paid` 등 enum 추가 시 **모든 status-필터 리더 전수 감사** 함정 주의)+PayoutLedger UI 체크. 취소 가능(undo-first)
- [ ] **C5. 가입 CTA(D4 확정)**: claim 실효과 문구만("이 대회 참가 기록이 내 계정에 연결돼요"). 기존 카피 `[view_token].tsx:172` 동일 감사
- [ ] **C6. TV 모니터 프리셋 레이아웃+5슬롯 설정 (2026-07-17 추가 — 스펙 `docs/superpowers/specs/2026-07-17-ops-tv-monitor-preset-slots-design.md` T1~T6)**:
  ① `ops_tournaments.monitor_config` jsonb 컬럼(신규 마이그, NULL=기본)
  ② `ops_set_monitor_config` SECDEF RPC — owner 전용·actor 바인딩·화이트리스트 검증(P0001)·anon/PUBLIC REVOKE(**anon-executable =2 계약 유지**)
  ③ 스냅샷 RPC 교체(C1과 같은 신규 마이그 1개)에 `monitorConfig`·`payouts[]`(상위 5) 동시 편승
  ④ `monitor/[token].tsx` 개편 — 프리셋 3종(full 기본/mirror/classic)+모듈 레지스트리(기본 5=players·totalChips·avgStack·regStatus·nextBreak, 데이터 없으면 자동 숨김, 미지 id 무시)+반응형 세로 스택
  ⑤ 설정 UI: ops 대회 화면 "TV 모니터 구성"(프리셋 세그먼트+슬롯 5 SelectBottomSheet)
  ⑥ A4 복제 RPC에 monitor_config 복사 포함

### D. 계측 (F8)
- [ ] **D1. 퍼널 이벤트**: 허브 노출→진입→생성→공개뷰 열람→가입 전환 + 한도 도달(S2 대비 선배선 가능하면). 분모=노출 대비 진입율(배치 실패와 가설 실패 분리)
- [ ] **D2. P1 성공 기준 문서화**: 30일 내 비-employer 생성 대회 수 목표치를 설계 문서에 기록

### 디자인 게이트 (구현 중 상시)
- §9.1 상태 매트릭스 7표면 그대로 구현(특히 Skeleton 공간 예약·에러 시 진입점 유지)
- §9.4 a11y: 신고 링크 hitSlop 44px·배너 accessibilityLiveRegion·Pressed 다크 역방향
- 다크 leading 가산(+5~10%) — 복붙 역전 함정(최근 실증)
- 골드는 CTA 1곳 한정(60-30-10)

---

## 검증 게이트 (완료 주장 전 이 세션 안에서 실행 증거)

1. `npm run quality` EXIT 0
2. Jest: 신규/변경 스위트 green + **재개 카드 KST 00~09시 고정 시계 케이스**
3. 서버 변경분(A4·C1·C4·C6): pgTAP **red-green 실측**(fix 되돌려 RED 확인) + `has_function_privilege` REVOKE 단언 + anon-executable =2 카운트 + 로컬 `npm run db:reset` 파리티 통과
4. 렌더 관찰: 모니터/플레이어 웹 표면은 실제 브라우저에서 관찰(gstack browse 가능) — 모니터는 **가로(TV)/세로(폰) 각 1회**(C6 프리셋·슬롯 포함), 브레이크 카운트다운이 클럭과 어긋나지 않는지
5. 커밋: `feat(ops): ...` 한글 컨벤션, 로컬 커밋만(push/PR은 사용자 명시 요청 시)

## 금지/주의

- S2(ops_entitlements·한도 집행)·S3(PortOne) **착수 금지** — S1 출하 후 별도 핸드오프
- 기존 마이그레이션 파일 수정 금지(신규 파일만)·`supabase db push` 금지(MCP apply_migration은 메인 세션만)
- 시크릿 값 채팅/문서 기입 금지
- 병렬 세션이 같은 레포에 활동 중일 수 있음 — 커밋 전 `git branch --show-current` 재확인(브랜치 섞임 실증 이력)

## 완료 기준

A1~A4·B1~B3·C1~C6·D1 전부 구현+검증 증거, B4·D2 확인 기록, 설계 문서 §5-S1에 DONE 마킹, 잔여(실기기 QA·OTA)는 사용자 게이트로 보고.

## 참조

- 설계: `docs/planning/2026-07-16-ops-open-access-monetization-design.md` (§8 게이트 재론은 번호로)
- 비개발자 요약 아티팩트: https://claude.ai/code/artifact/f32b64a5-2e0d-4e81-beef-6251e2a2cd2a
- 테스트 플랜: `~/.gstack/projects/snosnosno-uniqn/user-docs-order-sheet-unification-design-test-plan-20260716-231012.md`
- 이후 로드맵: S2(한도+entitlement 원장, 수동 콘시어지 판매 도구) → 게이트(수동 판매 3~5건) → S3(웹 PortOne)
