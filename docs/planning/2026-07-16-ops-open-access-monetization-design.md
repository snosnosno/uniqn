<!-- /autoplan restore point: ~/.gstack/projects/snosnosno-uniqn/docs-order-sheet-unification-design-autoplan-restore-20260716-223532.md -->
# ops(라이브 대회 운영) 전면 개방 + 수익모델 연결 — 설계 v2 (CEO 리뷰 반영)

> 작성: 2026-07-16 · 브랜치: docs/order-sheet-unification-design · 상태: /autoplan Phase 1(CEO) 완료
> 리뷰 모드: SELECTIVE EXPANSION · 외부 목소리: [subagent-only] (codex 계정 모델 거부 — 알려진 베이스라인)

## 1. 배경 / 실측 근거 (이 세션에서 코드로 확인)

- `ops_create_tournament`(baseline `20260710000002_baseline_schema_from_prod.sql:6686-6741`)는 **caller-binding만 검사**(`auth.uid() == p_owner_id` OR admin). employer 역할 게이트 없음.
- `p_job_posting_id`는 **선택 파라미터** — NULL 허용, 연결 시에만 공고 관리권 검사. `new.tsx`도 "공고 연결(선택)" 필드로 이미 구현.
- `app/(ops)/_layout.tsx`는 **authenticated만** 게이트. 데이터 접근은 RLS `is_ops_member`.
- `useOpsTournaments()`는 이미 postingId 없이 "내 대회 전체"를 반환 — 목록 화면(`(ops)/tournaments/index.tsx:20-24`)이 클라이언트 필터만 수행. **허브용 데이터 레이어 추가 작업 0.**
- 현재 유일한 인앱 진입점: employer 공고 상세의 "라이브 운영" 카드(3중 조건: tournament 타입+승인+활성).
- 플레이어 표면: `(public)/live/[view_token]` + `(public)/monitor/[token]`, 무계정 토큰. claim = view_token 읽기 + 8자 PIN 쓰기.
- **결론: 서버는 이미 "회원 전원 사용" 모델 지원. 막는 것은 클라이언트 진입점뿐.**

## 2. 변경 불가 제약 (이력)

- **IAP 재도입 금지** — 지갑/RevenueCat 전량 제거(PR#196~206, wiki `wallet-iap-removal`). 앱 결제표면 0 유지.
- **구직자 매칭 과금 금지**(직업안정법). ops는 도구 과금이므로 법적 제약 무관이나 전략상 개인 무료.
- **정산-레일/노쇼 보증** 핀테크는 보류 유지(범위 아님, 장기 방향).
- 쓰기는 SECDEF RPC 전용 패턴 유지(P0001 + `mapOpsRpcError`). 신규 함수는 anon EXECUTE REVOKE(학습: `atomic-wrapper-rpc-leaves-sub-rpc-exploit-surface`).

## 3. 전제 (2026-07-16 사용자 승인 — D1=A)

- **P1**: 회원 전원 개방 = 확산 채널. *리뷰 보강: 계측 없는 3링크 체인 → S1에 퍼널 이벤트+성공 기준 수치 필수(F8).*
- **P2**: 과금 경계 = 규모·연동·브랜딩. *열린 재프레임 후보: "규모" 중심 vs "대회 운영 패키지(도구+스태프 연동+공고 연계)" 번들 중심(F7 — 최종 게이트 결정).*
- **P3**: 결제 = 앱 밖 웹 PortOne. *보강: 국내 대체결제도 Apple ~26% 부과 → iOS 앱에는 외부 결제 링크·유도 문구 0(넷플릭스 모델), 웹 전용 인지. 법률/심사 검토 1회 게이트(F6).*
- **P4**: 플레이어 = 무계정 토큰 뷰 유지. *보강: 가입 CTA는 실존 가치로만 표기 — "기록 모아보기"는 플레이어-계정 연동 기능이 생기기 전 금지(F9).*
- **P5**: entitlement = owner_id 계정 단위. *열린 결정: 대회사 팀(사장 결제→직원 생성) 시나리오가 계정 단위에서 깨짐 → hybrid(개인=계정, 사업장=워크스페이스 승계) 여부 최종 게이트 결정(F3). 스키마는 `workspace_id nullable`로 양쪽 대비.*

## 4. 목표 모델 (3단 사다리)

| 층 | 대상 | 표면 | 비용 |
|---|---|---|---|
| 플레이어 | 무계정 | `live/[view_token]` 공개뷰 + PIN claim | 무료 (가입 퍼널 CTA — 실존 가치만) |
| 회원 | 구직자 이상 전원 | (ops) 스택 전체 — 생성/운영 | 무료 (한도 내) |
| 사업장 | 유료 entitlement 보유 | 한도 해제 + 프리미엄 | 웹 PortOne — **event_pass(단건) 우선, 구독 후순위**(F10) |

시장 벤치마크(2026-07 실측): NextBlind free→$7→$29/월(상업)→$149/월(화이트라벨), LynxPoker 클럽 $59/월, 무료 타이머 다수(Travis 등). **차별점은 타이머가 아니라 매칭 연동·공개뷰·기록.**

## 5. 슬라이스 (리뷰 반영판)

### S1 — 공용 진입 허브 + 악용 방어 + 계측 (마이그레이션 0~1개)
- 진입 표면(위치는 게이트 취향 결정 — 프로필 단독은 저빈도 매몰 리스크 D5): 후보 = 프로필 메뉴 / 홈 탭 노출 / 스케줄 빈 상태 크로스링크 / 1회성 신기능 안내 조합. `useOpsTournaments()` 재사용.
- "최근 대회 이어서 운영" 재개 카드(d2) — **선택 규칙 확정(D8)**: active 최신 1건 > 당일 upcoming 1건 > 없으면 카드 미노출. 구성 3요소: 대회명 / 상태 배지 / 보조 메타(엔트리 수 or 시작 시각).
- **(ops) 목록 화면 개편(D11 — 전 회원 개방 = 이 화면의 실질 첫 출시)**: 빈 상태 3단 구성(인지+가치+행동 CTA "첫 대회 만들기"), raw gray 팔레트 → 디자인 토큰 준수, 스피너 → Skeleton(impeccable 룰 16).
- 기존 employer 공고 상세 카드는 바로가기로 유지(3중 조건 그대로).
- **악용 방어(F2 — 개방 전제조건)**: ①공개뷰 `noindex` 메타 ②신고 경로(D7 스펙: 헤더 오버플로 ⋯ 메뉴 또는 최하단 캡션급 링크 — 상시 노출 버튼 금지 / 익명 신고 폼: 사유 택소노미[사행성·불법 도박·기타]+선택 상세 / 접수 후 재신고 rate limit) ③약관 사행성 금지 조항(단일소스 `src/constants/legal/`) ④무료 개인 티어 공개뷰의 금액 필드 노출 정책 — **1차 출시 제외(E11: anon 경로에 entitlement 결합 유발, 전 티어 동일 노출로 시작, 별도 게이트)** ⑤admin 모니터링 뷰.
- **퍼널 계측(F8+D5)**: 허브 노출→진입→생성→공개뷰 열람→가입 전환 이벤트. 성공 기준은 **노출 대비 진입율을 분모로** — 배치 실패와 가설 실패를 분리. 가입 전환은 보조 지표(D4).
- 공개뷰 가입 CTA(D4 — 실존 가치만): claim의 실제 효과("이 대회 참가 기록이 내 계정에 연결돼요")로 한정. 기존 카피(`[view_token].tsx:172`)도 동일 감사. 기록 조회 화면은 TODOS(플레이어 기록 연동)와 배선 — 생기기 전 "모아보기" 류 약속 금지.

- **S1 구현 완료 마킹(2026-07-17)**: 진입 표면 조합(A1) DONE · 재개 카드(A2) DONE · (ops) 목록 개편(A3) DONE · 대회 복제(A4) DONE · 공개뷰 noindex(B1) DONE · 신고 경로(B2) DONE · 약관 사행성 조항(B3) DONE · B4 확인(아래) DONE · 브레이크 카운트다운 3표면(C1) DONE · TV 모니터 보강(C2→C6) DONE · HISTORY 라벨 6종(C3) DONE · 상금 지급 마킹(C4) DONE · 가입 CTA(C5) DONE · TV 모니터 프리셋/5슬롯(C6) DONE · 퍼널 계측(D1) DONE · P1 성공 기준 기록(D2, 아래) DONE. **미완(사용자 게이트, DONE 마킹 제외)**: 실기기 QA · OTA · prod 마이그레이션 적용 · `ops_hub_enabled` 플래그 ON · CI parity 동기.
- **B4 확인**: 금액 필드 전 티어 동일 노출 — 작업 없음 확인(E11: anon 경로에 entitlement 결합 유발, 별도 게이트).
- **D2 — P1 성공 기준(2026-07-17)**: "출시 30일 내 비-employer 계정 생성 대회 N건" — 목표치 N = **제안 기본값 10건(사용자 확인 대기)**. 분모 = `ops_hub_impression` 대비 `ops_hub_entered` 진입율(배치 실패와 가설 실패 분리 — F8+D5). 측정 쿼리 소스 = `analytics_events` 테이블.

### S2 — 무료 한도 + entitlement 스키마 (Phase 3 반영판)
- **`ops_entitlements` = grant 원장(ledger) 모델(E2)** — owner당 N행: `owner_id`, `plan text + CHECK`(E8 — PG enum 금지: free/pro/event_pass/legacy, 확장=CHECK 교체 1줄), `expires_at`(NULL=무만료, 평가는 `expires_at IS NULL OR expires_at > now()` — NULL fail-open 차단 규약), `source`(webhook/manual), `source_payment_id UNIQUE`(웹훅 멱등의 근간), `granted_by`, `revoked_at`. 행 자체가 감사 기록(E16). event_pass 스태킹·pro 이력 보존·부분 환불(revoked_at) 전부 자연 표현.
- **resolver `ops_check_entitlement`는 순수 해석 전용(E6)**: 유효 grant 집계 → 최상위 plan/limits 반환. STABLE·락 없음·카운트 없음. 카운트·비교·RAISE는 각 RPC가 자기 락 아래에서. **anon+authenticated 모두 EXECUTE REVOKE** + `has_function_privilege` pgTAP 단언.
- **생성 한도(E1)**: `ops_create_tournament`에 owner 축 advisory lock 신설 → COUNT(`status IN ('upcoming','active')`) → 한도 비교 → INSERT. 한도 에러 UX에 **"이전 대회 종료/취소" 액션 직접 배선**(E5 — 서버 전이 기존, 방치 upcoming의 슬롯 영구 점유 방지). 생성 rate limit은 기존 `check_user_rate_limit` 재사용(E14).
- **엔트리 한도 = 생성 시점 `entry_cap` 스냅샷(E3)**: `ops_tournaments.entry_cap` 컬럼에 생성 시점 entitlement를 박제. register는 resolver를 조회하지 않고 자기 행 cap만 평가(기존 FOR UPDATE 하) — 만료-중-대회 절벽 0·resolver 결합 0. 업그레이드는 raise-only(`GREATEST(스냅샷, 현재)`) 평가. 재진입·리바이·애드온은 한도 비대상 명문화.
- **한도 수치는 prod `ops_tournaments` 실측 분포 기반으로 결정**(F5) — 결정 전 기본 제안: 무료 동시 1개·엔트리 40명. *게이트 부속: 엔트리 한도의 의미(누적 등록 수=next_entry_seq 비교 vs 현재 인원=COUNT) 정의 필요(E3).*
- **Grandfathering(F5+E7)**: 정적 UUID 목록 금지 — **단일 마이그레이션 안에서** 테이블 생성→`INSERT ... SELECT DISTINCT owner_id FROM ops_tournaments`(legacy 무만료)→RPC 교체(같은 트랜잭션=무방비 창 0). fresh reset 파리티에선 시드 0행(무해). pgTAP은 자체 픽스처(+명시적 테이블 GRANT — 알려진 함정)로 검증. *게이트 부속: "기존 활성" 정의 — 대회 owner 기준 vs employer 역할 전체(E7).*
- **테이블 grant 위생(E10)**: FORCE ROW LEVEL SECURITY + authenticated INSERT/UPDATE/DELETE 명시 REVOKE(SELECT만, RLS 본인+admin 스코프) + anon 전체 REVOKE. pgTAP 4종(본인 SELECT/타인 0행/authenticated INSERT 거부/anon 거부).
- **인덱스(E15)**: 부분 인덱스 `ON ops_tournaments(owner_id) WHERE status IN ('upcoming','active')` — 카운트 쿼리와 1:1.
- 다계정 우회(F4): 수용하고 유료 가치를 한도가 아닌 기능·연동·브랜딩에 배치. 생성 RPC에 계정당 rate limit만.
- **한도 안내 UX — 축별 재정의(D2, d1 대체)**: 동시 대회 축(한도 1 제안)은 "임박" 상태가 없으므로 배너 없이 **생성 시도 시점 에러 UX만**. 엔트리 축은 대회 운영 화면에 **35/40(87.5%) 도달 시 인라인 배너** 선행 노출(D3 — 현장 절벽 방지). 배너는 레이아웃 공간 예약으로 pop-in 금지(D6).
- **엔트리 한도 도달 = 라이브 현장(D3)**: 에러 메시지에 현장 사실 명시("이 대회는 40명까지 등록할 수 있어요"). 당일 소프트 초과 유예 vs 하드컷은 **게이트 결정 항목**.
- **플랫폼별 CTA 매트릭스(D1 — F6와의 모순 해소, 3곳: 배너·한도 에러·플랜 화면)**:
  | 표면 | iOS | Android/웹 |
  |---|---|---|
  | 한도 에러/배너 | 사실 안내만("무료 플랜은 동시 1개까지") — 결제 언급·링크 0 | +업그레이드 CTA(웹 결제 링크) |
  | 플랜 화면 | 플랜·사용량 표시만 | +플랜 변경 링크 |
  F6 법률/심사 검토의 입력물에 이 3곳 포함.
- **다크패턴 경계 3원칙(D10)**: ①배너는 임박/도달 시에만 — 상시 업셀·dismiss 후 무조건 재노출 금지(재노출 조건 명시) ②한도 에러는 사실+대안 1개, 손실 공포 문구 금지, "진행 중 대회는 끝까지 무료 운영" 잔존 가치 병기 ③만료 시 완주 허용 정책을 UI에도 고지. 골드는 CTA 1곳 한정(60-30-10).
- **플랜/사용량 화면(d5)을 S2로 승격(D9 — 시퀀싱 갭 해소)**: 무료 사용량 투명성만으로 독립 가치. 상태 필수 포함 — "결제 반영 중"(웹훅 지연 partial, 수동 문의 경로 병기). 진입 위치: 설정센터(게이트 부속 결정).
- admin 수동 grant 경로 — **수동 콘시어지 판매 도구**(F1): 연락→admin grant+계좌이체/세금계산서로 S3 없이 유료 검증 가능.

### S3 — 웹 PortOne 결제 표면 *(착수 게이트: 최종 승인 게이트에서 결정 — F1)*
- 결제/플랜 페이지는 웹(ops.uniqn.app 또는 uniqn.app) 전용. **iOS 앱에는 결제 링크·유도 문구 0**(F6, 넷플릭스 모델). Android/웹은 정책 범위 내 안내.
- 상품: event_pass(단건, 대회 1회+기간) 우선 → 구독(pro)은 수동 판매 관찰 후(F10).
- **웹훅 표면 = Supabase Edge Function(E9)** — 기존 PortOne EF 규약(`verify-portone-identity`+`_shared/portone-caller-binding.ts`·IP rate limit) 재사용, `config.toml` `verify_jwt=false`+서명 검증. 시크릿은 `supabase secrets set`(채팅/문서 노출 금지). EF 소스/배포 drift 런북 명시. 로그는 최소 필드(구매자 PII 금지).
- **PortOne V2 웹훅 필수(E4)**: webhook-id/-timestamp/-signature 표준 검증 + timestamp 허용창(5분) = replay 방어. **상태는 payload 신뢰 금지 — PortOne API 재조회로 확정**(out-of-order 근본 해결). 저장은 ledger INSERT(`source_payment_id UNIQUE` — 중복 no-op, cancelled 후 늦은 paid 재전송의 부활 불가). V1 웹훅(단순 시크릿 비교) 금지.
- 실패 재시도·영수증·환불 정책 문서.
- 앱: 내 플랜/사용량 read-only 화면(d5) — TanStack Query 조회만.
- 착수 전 1회 게이트: 스토어 심사·전자상거래 법률 검토.

## 6. NOT in scope (사유 포함)

- 정산-레일/노쇼 보증 — 별도 핀테크(PG제휴·세무·법률), 보류 유지.
- 화이트라벨(공개뷰 커스텀 브랜딩) — 유료 기능 후보, 후속 슬라이스. NextBlind $149 티어 등가물.
- 공고 연계 혜택(상단 노출/연장, Lane D) — 별도 설계. 단 **가격·번들 차원은 F7 결정에 따라 동시 설계 가능성 열림**.
- 플레이어 기록-계정 연동(전적/프로필) — 10x 후보로 TODOS 승격(F9). 복제 불가능한 네트워크 자산.
- 대회 종료 결과 공유 카드(d3) — 바이럴 증폭기, TODOS.
- 운영 통계/기록 보존(d7) — 유료 기능 후보, TODOS.
- IAP/스토어 결제 · ops 신규 운영 기능.

## 7. CEO 리뷰 산출물 (Phase 1)

### 7.1 0B — 이미 존재하는 것 (What already exists)

| 하위 문제 | 기존 자산 | 재사용 |
|---|---|---|
| 허브 대회 목록 | `useOpsTournaments()` — 전체 목록 반환, 클라 필터 | 그대로 |
| 생성/운영 전 화면 | `(ops)/tournaments/{index,new,[id]}` 3화면 | 그대로 |
| 한도 집행 지점 | `ops_create_tournament`(⚠️락 없음 — E1 교정: owner 축 advisory lock 신설 필요)·`ops_register_participant`(대회 행 FOR UPDATE 기존) SECDEF+P0001 | 락+체크 삽입 |
| 생성 rate limit | `check_user_rate_limit(p_user_id, p_operation, p_max, p_window)` baseline 기존 함수(E14) | 재사용 |
| 에러 → UI | `opsRpcError.ts` `mapOpsRpcError` | 코드 추가 |
| 본인인증 | PortOne 본인인증(안티스팸용 기존 배선) | 벤더 관계·SDK 재사용 |
| 웹 표면 | CF Pages(uniqn-app.pages.dev)+Edge Functions | 결제 페이지·웹훅 호스팅 |
| 약관 단일소스 | `src/constants/legal/` | 사행성 조항 추가 |
| 공유/스토어 링크 | #144 앱설치 링크 | 공개뷰 CTA 패턴 |
| 피처 플래그 | `weekly_grid_enabled` 패턴 | `ops_hub_enabled` 동일 패턴 |
| 재구축 없음 | 지갑 인프라 부활 금지 — entitlement는 wallet_ledger와 무관한 신규 최소 테이블 | — |

### 7.2 0C — Dream State

```
  CURRENT                        THIS PLAN                       12개월 이상형
  ops=승인된 대회공고             ops=전 회원 무료 도구            ops=국내 홀덤 대회 운영 표준
  소유자 전용, 수익 0     --->    +사업장 유료(수동→웹결제)  --->   +스태프 연동·공고 번들 유료 패키지
  플레이어=익명 토큰 뷰           +퍼널 계측·악용 방어              +플레이어 기록 네트워크(구직 공급측 획득)
                                                                +정산-레일 진입 지점
```
**Dream state delta**: 본 설계는 이상형의 "배포·과금 레일"을 놓는다. 남는 간극 = 플레이어 기록 자산(TODOS 승격), 스태프 연동 번들(F7), 정산-레일(보류).

### 7.3 0C-bis — 구현 대안 (자동 결정)

| | A) 개방만 (S1) | B) 3슬라이스+리뷰 보강 ✅채택 | C) 이상형(B+기록연동+화이트라벨+Lane D 번들) |
|---|---|---|---|
| Completeness | 3/10 | 9/10 | 10/10 |
| Effort | S | M~L (CC 기준 며칠) | XL |
| Risk | 낮음(수익 미검증 지속) | 중간 | 높음(신규 서브시스템 3개 동시) |
- **자동 결정: B** (원칙 P1 완결성 — 목표 범위 내 최고 커버리지; C의 초과분은 TODOS로). B vs C의 번들 축 근접성은 F7 취향 결정으로 게이트 상정.

### 7.4 0D — SELECTIVE EXPANSION 결정 (자동, 원칙 표기)

| # | 항목 | 결정 | 원칙/사유 |
|---|---|---|---|
| F2 | 악용 방어 4종 S1 전제조건화 | ✅수용 | P1 완결성 — blast radius 내, 도메인 리스크 Critical |
| F5 | grandfathering+실측 기반 한도 | ✅수용 | P1 — 공급측 핵심 고객 takeaway 방지 |
| F6 | iOS 무링크 web-only 인지+법률 게이트 | ✅수용 | P5 명시적 — 심사 리스크 제거 |
| F8 | 퍼널 계측+P1 성공 기준 | ✅수용 | P1 — 가설 판정 가능성 |
| F9(단기) | CTA 실존 가치 문구 | ✅수용 | P5 — 실체 없는 약속 제거 |
| F10 | event_pass 우선, 구독 후순위 | ✅수용 | P3 실용 — 대회사 지출 패턴 정합 |
| F4 | 다계정 우회 수용+가치를 기능으로 | ✅수용 | P3 — 본인인증 게이트는 무료 퍼널 마찰(P1 상충) |
| d1 | 한도 임박 배너 | ✅수용 | S, blast radius 내 |
| d2 | 최근 대회 재개 카드 | ✅수용 | S, blast radius 내 |
| d5 | 플랜/사용량 화면 | ✅수용 | S3 필수 부속 |
| d3 | 결과 공유 카드 | 📋TODOS | 증폭기, 코어 아님 |
| d4 | 대회 복제(설정 재사용) | ⚖️취향 결정(게이트) | 신규 RPC 필요, 3-5파일 경계 — 데일리 토너 킬러 기능 후보 |
| d7 | 통계/기록 보존 | 📋TODOS | 유료 후보, 신규 인프라 |
| F9(전략) | 플레이어 기록 연동 슬라이스 | 📋TODOS(10x 후보) | blast radius 밖, 신규 인프라 |
| F1 | S3 착수 게이트(수동 유료 3~5건) | ⚖️사용자 챌린지(게이트) | 사용자 지정 방향(S3 포함) 변경 제안 |
| F3 | P5 hybrid(사업장=워크스페이스 승계) | ⚖️사용자 챌린지(게이트) | 승인된 전제 P5 수정 제안 |
| F7 | 유료 티어 번들 재프레임 | ⚖️취향 결정(게이트) | P2 경계 재정의 — 모트 논거 강함 |
| — | 무료 한도 수치(동시1·엔트리40 제안) | ⚖️취향 결정(게이트) | 제품 결정, prod 실측 선행 |

플랫폼 잠재력: `ops_entitlements`는 향후 모든 유료 기능(Lane D·화이트라벨·기록 보존)의 공통 인프라.

### 7.5 0E — 시간축 심문 (지금 확정해야 할 구현 결정)

- HOUR 1: 한도 상수의 단일소스 위치(서버 함수 상수 vs `ops_entitlements.limits` 기본행) → **limits jsonb 기본값+함수 fallback 상수** (Phase 3에서 확정).
- HOUR 2-3: 한도 카운트 정의 — "동시 활성" = status IN ('upcoming','active')? completed 전환 누락 대회가 한도를 영구 점유하는 함정 → 카운트 기준·만료 정책 필요.
- HOUR 4-5: 웹훅 멱등성(중복 결제 이벤트), entitlement 만료 시점 동작(진행 중 대회는 완주 허용).
- HOUR 6+: 허브 빈 상태(대회 0)의 온보딩, 한도 에러의 업그레이드 CTA 딥링크.

### 7.6 이중 목소리 — 합의 테이블

CODEX: 이 계정 전 모델 400 거부(gpt-5.4 등) — 알려진 베이스라인(학습 신뢰도 9/10). **[subagent-only] 강등.**
CLAUDE SUBAGENT(fable, 독립): Critical 2·High 5·Medium 3 = 10건(F1~F10, §7.4에 처리 기록).

```
CEO DUAL VOICES — CONSENSUS TABLE
═════════════════════════════════════════════════════════════
  차원                          Claude   Codex   Consensus
  ───────────────────────────── ──────── ─────── ────────────
  1. 전제 타당?                  조건부    N/A    [subagent-only]
  2. 올바른 문제?                예(방향)  N/A    [subagent-only]
  3. 범위 캘리브레이션?           S3 이견   N/A    → 게이트(F1)
  4. 대안 충분 탐색?             4건 보강  N/A    [subagent-only]
  5. 경쟁/시장 리스크?            F7 지적   N/A    → 게이트(F7)
  6. 6개월 궤적 건전?            조건부    N/A    [subagent-only]
═════════════════════════════════════════════════════════════
단일 목소리의 Critical 발견(F1·F2)은 규칙상 무조건 표면화 — F2는 수용, F1은 게이트.
```

### 7.7 11섹션 딥리뷰 (발견 요약 — 자동 결정 포함)

**S1 아키텍처** — 신규 컴포넌트 의존 그래프:
```
[프로필 허브 카드]──▶[(ops)/tournaments 목록]──▶[new/[id] 기존 화면]
                         │                          │
                         ▼                          ▼
              [useOpsTournaments 기존]   [ops_create_tournament RPC]
                                                    │ +한도 체크(신규)
                                                    ▼
[웹 결제페이지]──▶[PortOne]──▶[웹훅 EF(신규)]──▶[ops_entitlements(신규)]
                                                    ▲ RLS: 본인 SELECT
[플랜/사용량 화면]──읽기 전용──────────────────────────┘
```
결합: 앱→entitlement는 읽기 전용(안전). 웹훅→DB만 쓰기(단일 쓰기 지점). SPOF: 웹훅 EF 다운 시 결제-반영 지연 → 재시도+수동 grant 폴백. 롤백: `ops_hub_enabled` 플래그 OFF(S1), 한도는 limits 기본값 무제한 전환(S2), 웹 페이지 회수(S3). 발견 1건: 한도 체크를 RPC 내부에 인라인하면 향후 기능별 게이트마다 중복 → `ops_check_entitlement(owner_id, action)` 단일 함수로 — ✅수용(P4 DRY).

**S2 에러&레스큐 맵** (신규 경로 전수):
```
경로                          | 실패 모드                  | 예외/코드        | 레스큐            | 사용자 표시
------------------------------|---------------------------|------------------|-------------------|------------------
ops_create_tournament(한도)   | 동시 한도 초과             | P0001 OPS_LIMIT_TOURNAMENTS | 클라 매핑 | "무료 한도 도달" + 업그레이드 CTA
ops_register_participant(한도)| 엔트리 한도 초과           | P0001 OPS_LIMIT_ENTRIES     | 클라 매핑 | 한도 안내 + CTA
ops_check_entitlement         | entitlement 행 부재        | 기본 free 폴백    | 명시 기본값       | (투명)
웹훅 EF                       | 서명 불일치                | 401 거부+로그     | 재시도 없음       | (결제사 재전송)
웹훅 EF                       | 중복 이벤트                | 멱등 키 무시      | upsert            | (투명)
웹훅 EF                       | DB 쓰기 실패               | 5xx→PortOne 재시도| 알림              | 지연 반영
플랜 화면 조회                | 네트워크/RLS 거부          | AppError E1/E4    | 재시도 UI         | 에러 상태
공개뷰 신고                   | 중복/스팸 신고             | rate limit        | 무시              | "접수됨"
```
GAP 0 목표 — 전 행 레스큐 정의됨. LLM 경로 없음.

**S3 보안&위협 모델**:
| 위협 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| 웹훅 위조(가짜 결제) | 중 | 높음 | PortOne 서명 검증+시크릿 env+IP 검토 |
| entitlement 자가 상승 | 중 | 높음 | 쓰기 service_role 전용, authenticated REVOKE, `has_function_privilege` 실측(학습 반영) |
| 신규 RPC anon 기본 grant | 높음(전례) | 높음 | 마이그에 명시 REVOKE — 알려진 함정 |
| 공개뷰 도박성 콘텐츠 | 중 | 매우 높음(앱 존속) | F2 4종(noindex·신고·약관·모니터링)+금액 노출 정책 |
| view_token 열거 | 낮음 | 중 | 기존 토큰 엔트로피 유지(변경 없음) |
| 다계정 한도 우회 | 높음 | 낮음(수용) | F4 결정 — 가치를 기능으로 이동 |
| PII/결제 데이터 | — | — | 카드 정보는 PortOne 측, 우리는 결제 결과만. 영수증에 최소 정보 |

**S4 데이터 흐름/상호작용 엣지** *(E1 교정 — 초판의 "advisory lock(기존)이 직렬화" 주장은 오류: create에는 락이 전무)*: 생성 동시 2건 경쟁은 **owner 축 advisory lock 신설**(`pg_advisory_xact_lock(hashtext('ops_owner_'||owner_id)::bigint)`, caller-binding 직후)로 직렬화 후 COUNT→INSERT. 락 순서 불변식 주석 명문화: owner advisory → tournament advisory → tournament FOR UPDATE → participant FOR UPDATE. 엔트리 등록 더블탭: 기존 대회 행 `FOR UPDATE`+gap-free 할당이 방어. 허브 목록 0건: 빈 상태=온보딩. 웹훅 2시간 지연: 수동 grant 폴백+플랜 화면 "결제 반영 중" 상태.

**S5 코드 품질**: 신규 로직 최소(체크 함수 1+EF 1+화면 2+카드 2). DRY: 한도 에러 문구는 `mapOpsRpcError` 단일 지점. 과잉 설계 경계: 플랜 관리 admin UI는 1차에서 SQL/기존 admin으로 충분 — 전용 UI는 TODOS.

**S6 테스트 리뷰** (신규 항목 전수):
```
NEW UX: 허브 진입/빈 상태 · 한도 배너 · 한도 에러+CTA · 플랜 화면 · 신고 경로 · CTA 문구
NEW DATA: 한도 카운트 → P0001 · entitlement 조회 폴백 · 웹훅 → upsert → 한도 해제
NEW CODEPATH: ops_check_entitlement(free 폴백/pro/만료/워크스페이스-nullable) · grandfathering 분기
NEW INTEGRATION: PortOne 웹훅(서명·멱등·재시도)
```
- pgTAP: 한도 도달 시 P0001, grandfathered 계정 통과, entitlement RLS(타인 SELECT 거부), REVOKE 실측. **Red-Green 필수**(전역 규칙).
- Jest: mapOpsRpcError 신규 코드, 한도 배너 조건, 플랜 화면 상태.
- EF 유닛: 서명 검증·멱등·실패 응답.
- 2am 금요일 테스트: "free 사용자 동시 2번째 대회 생성 → P0001 + 업그레이드 CTA 렌더".
- 적대적 QA: 만료된 pro가 진행 중 대회 완주 가능? (정책: 허용 — 테스트 고정).
- 플레이크 리스크: 시간 의존(expires_at) — 고정 시각 주입. KST toISOString 함정(학습) 주의.
- **E13 보강**: 동시성은 상태 기반 테스트("2번째 생성 P0001 → 1번째 취소 → 생성 성공"=슬롯 해제)+advisory lock 구조 단언. 경계: `expires_at == now()` / legacy NULL / 만료 pro+유효 event_pass 공존. 웹훅: 같은 webhook-id 2회→grant 1 / cancelled 후 늦은 paid→부활 금지 / timestamp 창 밖→거부. 바인딩: admin 대리 생성 한도는 p_owner_id 귀속·워크스페이스 멤버 등록도 owner entitlement 기준. 재진입=캡 비대상 고정 테스트. 구버전 앱: 신규 P0001은 UNKNOWN "알 수 없는 오류"로 표시됨(supabase.ts POSTGREST_ERROR_MAP 부재 — OTA 창 짧고 grandfathering이 기존 사용자 커버라 수용, 문서화). 재개 카드 "당일" 판정 KST 00~09시 고정 시계 케이스.

**S7 성능**: 한도 카운트 = `COUNT(*) WHERE owner_id AND status IN (...)` — `(owner_id, status)` 부분 인덱스 추가. 허브 목록은 기존 쿼리 재사용. 웹훅은 저빈도. N+1 없음.

**S8 관측성**: 퍼널 이벤트 4종(F8) + 한도 도달 이벤트(전환 시그널!) + 웹훅 성공/실패 로그 + 신고 접수 카운트. 대시보드 1일차: 신규 생성 대회 수(비-employer 분리)·한도 도달 수·결제 전환. 런북: 웹훅 실패 시 수동 grant 절차.

**S9 배포/롤아웃**: 순서 = ①마이그(ops_entitlements+인덱스+RPC 교체) ②앱 OTA(S1 허브, `ops_hub_enabled` OFF 상태) ③플래그 ON ④(게이트 통과 시) 웹 결제 배포. 마이그는 additive(기존 행 무영향, 한도는 entitlement 부재=free 폴백이므로 **배포 순간 기존 사용자에 한도 즉시 적용 — grandfathering 시드 선행 필수**(Critical 배포 순서). 롤백: 플래그 OFF+limits 무제한 UPDATE. 구버전 앱 공존: 한도 에러는 구버전에서도 P0001 일반 에러로 표시(기존 매퍼 폴백) — 안전.

**S10 장기 궤적**: 가역성 4/5(플래그·additive 마이그·웹 분리). 경로 의존: entitlement 스키마가 향후 유료 기능의 계약 — `limits jsonb`+`plan` enum 확장 여지 확보. 부채: 수동 grant 운영 절차(문서화로 상쇄). 1년 후 신규 엔지니어: 이 문서+wiki ops-engine으로 충분.

**S11 디자인&UX**(요약 — Phase 2에서 심화): 상태 커버리지 표(허브/배너/플랜 화면 × LOADING/EMPTY/ERROR/SUCCESS/PARTIAL)는 Phase 2 산출물로 이관. 저니: 딜러가 홈게임 생성→공개뷰 공유→플레이어 열람→(미래)가입. AI slop 리스크: 허브 카드가 generic 리스트가 되지 않도록 — Phase 2.

### 7.8 실패 모드 레지스트리

```
CODEPATH            | FAILURE MODE        | RESCUED? | TEST?  | USER SEES?      | LOGGED?
--------------------|---------------------|----------|--------|-----------------|--------
create(한도)        | 한도 초과            | Y(P0001) | pgTAP  | 안내+CTA        | Y
register(한도)      | 엔트리 초과          | Y(P0001) | pgTAP  | 안내+CTA        | Y
check_entitlement   | 행 부재              | Y(free)  | pgTAP  | 투명            | Y
웹훅                | 위조/중복/DB실패      | Y(3종)   | EF unit| 지연 반영        | Y
grandfathering 시드 | 누락→기존고객 차단    | 배포순서  | pgTAP  | ⚠️한도 오탐      | Y
공개뷰 악용         | 도박성 콘텐츠         | 신고+운영 | 수동   | 신고 버튼        | Y
```
CRITICAL GAP 0 (grandfathering 시드는 배포 순서 체크리스트로 방어 — S9).

### 7.9 Implementation Tasks (Phase 1 발췌 — 최종 게이트 후 확정)

- [ ] **T1 (P1, CC ~30min)** — S2/DB — `ops_entitlements` 테이블+RLS+REVOKE+인덱스 마이그 설계
- [ ] **T2 (P1, CC ~30min)** — S2/DB — `ops_check_entitlement` + create/register 한도 배선 + pgTAP(red-green)
- [ ] **T3 (P1, CC ~20min)** — S2/배포 — grandfathering 시드(prod 실측→legacy 무제한) — **마이그와 동일 PR**
- [ ] **T4 (P1, CC ~30min)** — S1/앱 — 허브 진입점+최근 대회 카드+빈 상태
- [ ] **T5 (P1, CC ~30min)** — S1/방어 — noindex·신고 경로·약관 조항·금액 노출 정책
- [ ] **T6 (P2, CC ~20min)** — S1/계측 — 퍼널 이벤트 4종+한도 도달 이벤트
- [ ] **T7 (P2, CC ~15min)** — S2/앱 — 한도 배너+mapOpsRpcError 코드+CTA
- [ ] **T8 (게이트 대기)** — S3 전체 — 웹 결제 페이지+웹훅 EF+플랜 화면

## 8. 리스크 / 열린 질문 (게이트 상정)

1. **[사용자 챌린지] F1** — S3 착수 게이트: 수동 콘시어지 판매 3~5건 실증 후 결제 인프라 착수 vs 즉시 병행.
2. **[사용자 챌린지] F3** — P5 hybrid: 사업장 entitlement의 워크스페이스 승계 허용 여부. *부속 결정(D12): 허브 목록 스코프·카피("내 대회" vs "참여 중인 대회"). ⚠️입력물 한계(E12): `workspace_id` 컬럼만으론 안 풀림 — 사장 결제→직원 생성은 소유 모델(생성 시 워크스페이스 위임 선택)+카운트 축 변경까지 필요. "컬럼 있으니 나중에 켜면 됨" 착시 금지.*
3. **[취향] F7** — 유료 티어 정의: 규모 중심 vs 운영 패키지(스태프 연동·공고 번들) 중심.
4. **[취향] 한도 수치** — 무료 동시 1·엔트리 40 제안(prod 실측 후 확정). *연동(D2): 배너 스펙은 이 수치에 종속.*
5. **[취향] d4** — 대회 복제 기능 포함 여부. *저니 의존성(D-저니): 딜러 리텐션 루프(매주 재입력 마찰)의 핵심 고리.*
6. **[취향] D3** — 엔트리 한도 당일 소프트 초과 유예 vs 하드컷.
7. **[취향] D5** — 허브 진입 표면: 프로필 메뉴 단독 vs 홈 노출 vs 스케줄 빈상태 크로스링크 vs 조합.
8. **[취향] E3** — 엔트리 한도의 의미: 누적 등록 수(next_entry_seq 비교, COUNT 불필요·레이스 0) vs 현재 인원(COUNT, 퇴장자 제외).
9. **[취향] E7** — grandfathering 대상 정의: 대회 owner 실적 기준 vs employer 역할 전체.
10. **[후속 게이트] E11** — 무료 티어 공개뷰 금액 노출 정책(1차 제외 확정, 재론 시점만).

## 10. 엔지니어링 리뷰 산출물 (Phase 3 — [subagent-only])

독립 엔지니어링 리뷰(fable, 코드 실측 20툴콜): Critical 1·High 4·Medium 7·Low 3·확인 2 = 17건. **판정: 조건부 승인** — E1~E4는 T1/T2 착수 전 반영 필수(→ §5 S2/S3에 반영 완료), E5·E7은 게이트 항목 추가(→ §8-8·9).

```
ENG DUAL VOICES — CONSENSUS TABLE
═════════════════════════════════════════════════════════════
  차원                        Claude        Codex   Consensus
  ─────────────────────────── ───────────── ─────── ──────────
  1. 아키텍처 건전?            조건부(E1·E2) N/A    [subagent-only]
  2. 테스트 커버리지?          갭 8건(E13)   N/A    [subagent-only]
  3. 성능 리스크?              부분인덱스     N/A    [subagent-only]
  4. 보안 위협 커버?           E4·E10 보강   N/A    [subagent-only]
  5. 에러 경로?                E5 슬롯 점유  N/A    [subagent-only]
  6. 배포 리스크?              E7 단일 마이그 N/A    [subagent-only]
═════════════════════════════════════════════════════════════
Critical E1(생성 락 부재)은 초판 계획의 주장 오류를 반증 — §7.1·S4 본문 교정 완료.
```

주요 교정 요약: ①생성 레이스(E1→owner advisory lock) ②event_pass 스키마 불일치(E2→grant ledger) ③만료 절벽(E3→entry_cap 스냅샷+raise-only) ④웹훅 순서 역전(E4→V2 표준+API 재조회+payment_id UNIQUE) ⑤방치 upcoming 슬롯 점유(E5→취소 액션 배선) ⑥resolver 순수화(E6) ⑦동적 시드 단일 마이그(E7) ⑧text+CHECK(E8) ⑨Supabase EF 확정(E9) ⑩grant 위생 4종(E10) ⑪금액 정책 1차 제외(E11) ⑫F3 입력물 한계(E12) ⑬테스트 갭 8건(E13) ⑭rate limit 재사용(E14) ⑮부분 인덱스(E15) ⑯ledger=감사 겸용(E16). §1 실측 주장은 전부 정확 판정(E17).

DX 리뷰(Phase 3.5): **스킵** — 개발자 대상 표면 없음(RPC/웹훅은 내부 구현이며 설치·통합 대상 아님, 제품=소비자 앱).

## 9. 디자인 리뷰 산출물 (Phase 2 — [subagent-only])

초기 디자인 완결성 **2/10**(UI가 한 줄 명사구) → 자동 수정 반영 후 **8/10**. 잔여 2점 = 게이트 결정(D3·D5·한도 수치)+목업 미생성.
독립 디자인 리뷰(fable): Critical 1·High 5·Medium 5·Low 1 = 12건. D1(iOS CTA 모순)·D2(배너-한도 모순)는 계획 본문 수정으로 즉시 해소(§5 반영). 목업 생성은 스킵 — 기존 DESIGN.md(Black&Gold)+impeccable 27룰이 시각 언어를 이미 고정, 신규 표면 4곳은 토큰 조합(감사 추적 #19).

### 9.1 상태 커버리지 매트릭스 (D6 — 구현 게이트)

| 표면 | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|---|---|---|---|---|---|
| 허브 재개 카드 | Skeleton(공간 예약) | 카드 미노출(진입점만) | 카드 숨김+진입점 유지 | 카드 렌더 | — |
| (ops) 목록 | Skeleton 3행 | 3단 온보딩("첫 대회 만들기") | 에러+재시도 | FlashList | pull-to-refresh 골드 |
| 엔트리 배너(35/40+) | 노출 안함(조회 전) | — | 배너 숨김(집행은 서버) | 인라인 배너 | dismiss 후 재노출 조건 |
| 한도 에러 | — | — | P0001→플랫폼별 매트릭스 | — | — |
| 플랜/사용량 화면 | Skeleton | free 기본 표기 | 에러+재시도 | 플랜+사용량 미터 | **"결제 반영 중"+문의 경로** |
| 공개뷰 신고 | — | — | rate limit 안내 | "접수됨" | — |
| 가입 CTA | — | — | — | claim 연동 문구 | 로그인 후 자동 연결 |

### 9.2 딜러 저니 (감정 아크)

발견(D5 게이트 — 표면 결정이 좌우) → 생성(기존 폼, 무난) → 공유(기존 공유 모먼트, d3 TODOS) → 플레이어 열람(현 공개뷰 위계 양호: 대회명→스택→클럭) → 가입(D4 — 실가치 문구로 파단 해소) → 재운영(d2 재개 카드, 반복 마찰은 d4 게이트).

### 9.3 App UI 리트머스 (요약)

브랜드 식별 Y / 시각 앵커 Y(재개 카드=허브 앵커) / 스캔 이해 Y / 섹션 단일 책무 Y / 카드 필요성 Y(카드=상호작용) / 모션 절제 Y / 그림자 제거 후 프리미엄 Y(토큰 기반). 하드 거부 패턴 0 — 단, D11 개편 전의 (ops) 목록은 raw gray로 위반 상태(개편 포함됨).

### 9.4 접근성/반응형 (Pass 6)

RN 단일 플랫폼 — impeccable 체크리스트 준수 전제 + 신규 표면 특이 사항: ①신고 링크(캡션급)도 hitSlop으로 터치 44px 확보 ②한도 배너 `accessibilityRole="alert"`+`accessibilityLiveRegion="polite"`(오프라인 배너 §25와 동일 규약) ③플랜 화면 사용량 미터는 수치 텍스트 병기(색 단독 전달 금지) ④재개 카드 Pressed 다크 역방향(룰 21).

### 9.5 교차 페이즈 테마 (2개 페이즈 이상 독립 지적 — 고신뢰 신호)

- **iOS 결제 표면 제약**: CEO F6 + Design D1 — 웹 전용 결제·앱 무링크가 두 리뷰에서 독립적으로 핵심 제약으로 지목.
- **한도가 라이브 현장을 깨면 안 됨**: Design D3 + Eng E3/E5 — 사전 배너·cap 스냅샷·슬롯 해제 액션으로 3중 대응.
- **기존 사용자 보호**: CEO F5 + Eng E7 — grandfathering을 마이그 원자성 수준까지 구체화.
- **실체 없는 약속 금지**: CEO F9 + Design D4 — CTA는 claim 실효과로만.

## 11. k-holdem 기능 벤치마크 갭 분석 (2026-07-16 추가 — 이미지 20장 + 코드 인벤토리 실측)

전제 확인: "타이머=실데이터 연결"은 이미 출하된 아키텍처 — 서버 앵커 클럭(`ops_clock.level_started_at`) + `ops_live_stats` 트리거 재계산(playing/entries/reentries_total/total_chips/average_stack/avg_stack_bb/prize_pool/knockout_pool). k-holdem 대비 커버리지 판정(근거: baseline 마이그·컴포넌트 실측):

| k-holdem 기능 | UNIQN 판정 | 갭 |
|---|---|---|
| 클럭(재생/정지/레벨 이동/±분) | 있음 | 레벨 내 초단위 시크(슬라이더)·알람만 없음 |
| STATUS(실플레이/누적/리엔트리/테이블/평균·총칩/바이인·피 분리/등록 토글) | 있음 | playerout-for-checkin류 세부 토글 없음 |
| 블라인드 에디터(브레이크 포함 라이브 수정) | 있음 | — |
| bust→아웃순위→ITM 상금 자동 안내(+undo) | 있음 | 일괄 bust 없음 |
| 재진입/리바이/애드온 카운트 | 있음 | — |
| 리드로우/개별 이동/대기 채움/테이블 close·lock·priority | 있음 | 테이블 단위 칩 실사(chips count 모드) 없음 |
| 상금 구조(%·금액) | 부분 | %는 클라 환산(DB는 amount) — 무해. **지급 완료 마킹(paid_at) 없음** |
| 감사 로그(HISTORY) | 부분 | ops_events 27종 append-only 완비, UI 라벨 21/27종(6종 enum 원문 노출) |
| TV 모니터(대형 클럭/AVG BB/총칩/PLAYING) | 있음 | **다음 브레이크 카운트다운 없음**(is_break로 계산 가능·로직 미구현), payouts 상위 미노출, 스폰서 브랜딩/사진 QR 없음 |
| 경고(warnings)/패널티 | 없음 | participant_status에 상태 없음 |
| 티켓 배정(새틀라이트)/멤버십 카드 QR | 없음 | — |
| 멀티데이/플라이트(Day1 A/B/C 병합) | 없음 | 스키마에 flight/day 구조 없음 |
| 멀티 베뉴 이벤트 목록/필터 | 해당 없음 | 제품 구조 상이(운영자 스코프) |

### 갭 처리 방침 (개방·수익 설계와 결합)
- **S1에 흡수(소형·무료 코어 완성도)**: ①다음 브레이크 카운트다운(모니터+운영 STATUS) ②HISTORY 라벨 6종 보완 ③상금 지급 마킹(paid_at — ledger 행 추가로 자연 표현).
- **P2(무료 코어 후속)**: 레벨 내 초단위 시크, 일괄 bust, 테이블 칩 실사 모드.
- **유료 티어의 실체(F7 "패키지" 재프레임의 기능 축 — 게이트 3번 입력물)**: 멀티데이/플라이트 병합·티켓 배정·멤버십 QR·경고/패널티·TV 스폰서 브랜딩(화이트라벨). 전부 "대회사급 운영"에만 필요한 기능 — 한도(규모)보다 방어력 있는 유료 경계.

## 12. 모드별 유저플로우/UX 설계 (2026-07-16 — 사용자 지시: "UX·유저플로우 최우선, 사용자/플레이어/모드 구분")

### 12.0 게이트 결과
사용자 "진행하자" 지시로 §8 게이트 9건 **권고안대로 잠정 확정**(F1 S3 착수게이트 수용·F3 1차 owner 단위·F7 패키지 정의·한도 동시1/엔트리40 잠정·E3 누적 등록·E7 owner 실적 기준·d4 복제 포함·D3 하드컷+사전배너·D5 조합 표면). 재론 시 §8 번호로.

### 12.1 모드 체계 (역할 × 표면)

| 모드 | 대상 | 표면 | 핵심 UX 계약 |
|---|---|---|---|
| **운영자 모드** | owner(회원 전원) | 앱 (ops) 7탭 콕핏 | 한 손·새벽·실수 방지(undo 우선, 파괴 액션 명도 분리). 준비 5분 목표(복제) |
| **스태프 모드** | 1e 연동 스태프 | 앱 (제한 뷰) | 현재 owner 중심 — 스태프 쓰기 권한 분리는 후속(F3 hybrid와 동축) |
| **플레이어 모드** | 무계정 | live/[view_token] 웹 | glanceable(어두운 매장·원거리): 내 스택>클럭>브레이크. 조작 없음, PIN claim만 |
| **TV 모드** | 매장 TV | monitor/[token] 웹 | 초대형 클럭+브레이크 카운트다운+payouts. 상시 방치 전제(번인·드리프트 0=서버 앵커) |

### 12.2 페르소나 플로우 (감정 아크 포함)

**펍 사장 — 데일리 루프(매일 반복이 제품의 심장)**: 오픈 전 [어제 대회 복제 1탭] → [TV에 모니터 링크](최초 1회 북마크) → 손님 도착 [현장 등록: 이름만·랜덤 좌석] → [클럭 시작] → 진행 중 [bust 2탭(좌석 메뉴→bust)·ITM 자동 팝업] → [우승 확정 자동] → [상금 지급 마킹] → 마감. 감정: "준비가 일이 아니다"(복제) → "안 끊긴다"(서버 클럭) → "정산이 남는다"(지급 마킹+감사 로그).
**딜러 — 홈게임**: 생성 → 링크 공유 → 친구 셀프 claim(PIN) → 진행 → 종료 → (전파: "펍에서도 쓰자").
**플레이어**: 링크 오픈 → [PIN claim] → 내 스택·다음 브레이크 확인(주머니에서 1초) → 아웃 → **내 순위·상금 즉시 확인** → "이 기록 내 계정에 연결" 가입 CTA.
**대회사(유료·후속)**: 플라이트 병합·티켓·멤버십 QR 스캔 동선 — 유료 티어 설계에서 별도.

### 12.3 표면별 정보 위계 (1st/2nd/3rd)

- **운영자 STATUS**: ①클럭+현재 블라인드 ②PLAYING/ENTRIES(실플레이·누적 분리) ③평균스택(BB)·상금풀. 조작(레벨 이동·±1분)은 위계 아래, 파괴(일괄 bust류)는 오버플로.
- **플레이어 뷰**: ①내 스택 ②클럭+블라인드 ③**다음 브레이크까지**(S1 신규)·상금표 접힘. 가입 CTA는 아웃 직후 순위 화면에서 최강(감정 피크).
- **TV 모드**: ①클럭(최대) ②블라인드+NEXT ③브레이크 카운트다운·PLAYING x/y·AVG(BB)·PRIZE POOL·payouts 상위 3(S1 신규)·등록 마감 배지.

### 12.4 UX 하드 룰 (이 도메인 특화)
1. 라이브 절벽 금지(§9 D3 계승): 모든 한도·만료는 사전 고지, 진행 중 대회 무중단.
2. bust 계열은 **undo-first**(이미 구현) — 확인 다이얼로그 최소, 되돌리기 노출.
3. 새벽 저조도: 다크 고정 표면(플레이어·TV), 골드는 금액·CTA만(60-30-10).
4. 브레이크 카운트다운은 3표면(운영 STATUS·플레이어·TV) 동일 데이터 소스로 동시 추가 — 표면별 드리프트 금지.
5. k-holdem 대비 차별 UX: 플레이어가 "구경꾼"이 아니라 claim으로 "참여자" — 기록 연결 퍼널이 유일무이.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | 리뷰 모드=SELECTIVE EXPANSION | Mechanical | autoplan 규칙 | 기존 시스템 반복 개선 | — |
| 2 | CEO | codex 강등 [subagent-only] | Mechanical | 학습 9/10+실측 400 | 전 모델 계정 거부 재확인 | codex 재시도 |
| 3 | CEO | 구현 대안 B 채택(3슬라이스+보강) | Taste(근접) | P1 완결성 | 목표 범위 내 최고 커버리지 | A(개방만)·C(이상형) |
| 4 | CEO | F2 악용 방어 S1 전제조건 수용 | Mechanical | P1 | 도메인 존속 리스크 | 미방어 개방 |
| 5 | CEO | F5 grandfathering 수용 | Mechanical | P1 | 핵심 고객 takeaway 방지 | 일괄 한도 |
| 6 | CEO | F6 iOS 무링크 수용 | Mechanical | P5 | 심사 리스크 제거 | 외부 링크 유도 |
| 7 | CEO | F8 퍼널 계측 수용 | Mechanical | P1 | P1 가설 판정 가능성 | 무계측 출시 |
| 8 | CEO | F10 event_pass 우선 수용 | Mechanical | P3 | 대회사 지출 패턴 | 구독 단일 |
| 9 | CEO | F4 다계정 우회 수용(가치→기능) | Taste(경계) | P3 | 본인인증 게이트=무료 퍼널 마찰 | 본인인증 강제 |
| 10 | CEO | d1·d2·d5 수용 / d3·d7·기록연동 TODOS | Mechanical | P2 blast radius | <1d CC 여부로 분기 | — |
| 11 | CEO | F1 S3 착수 게이트 → 최종 게이트 상정 | User Challenge | 규칙(자동결정 금지) | 사용자 지정 방향 변경 제안 | — |
| 12 | CEO | F3 P5 hybrid → 최종 게이트 상정 | User Challenge | 규칙 | 승인 전제 수정 제안 | — |
| 13 | CEO | F7 번들 재프레임 → 최종 게이트 상정 | Taste | 규칙 | P2 경계 재정의 | — |
| 14 | CEO | CEO플랜 spec리뷰 루프 1회 생략 | Mechanical | P3 실용 | Phase2/3 독립 리뷰 2회가 동일 문서 재검증 — 중복 | 3회 반복 루프 |
| 15 | CEO | 한도 체크 단일 함수화(ops_check_entitlement) | Mechanical | P4 DRY | RPC별 인라인 중복 방지 | 인라인 중복 |
| 16 | Design | D1 플랫폼 CTA 매트릭스 자동 반영 | Mechanical | P5 | 계획 내부 모순(F6↔d1) 해소 | 구현자 임의 분기 |
| 17 | Design | D2 배너 축별 재정의 | Mechanical | P5 | 동시한도 1이면 "임박" 부재 | 일괄 배너 |
| 18 | Design | D4 CTA=claim 실효과 한정+지표 강등 | Mechanical | P5 | 빈 약속 측정 방지 | 기존 카피 유지 |
| 19 | Design | 목업 생성 스킵 | Taste(공정) | P3 | DESIGN.md+impeccable이 시각 언어 고정, 표면 4곳=토큰 조합. /design-shotgun 후속 가능 | 12장 목업 생성 |
| 20 | Design | D6 상태 매트릭스 즉시 작성+T4/5/7 의존성 배선 | Mechanical | P1 | P1 태스크가 스펙 없이 착수되는 구조 차단 | Phase2 유예 유지 |
| 21 | Design | D7 신고 스펙·D8 재개 카드 규칙·D9 d5 S2 승격·D10 다크패턴 3원칙·D11 목록 개편 수용 | Mechanical | P1/P5 | 구조적 공백 — blast radius 내 | — |
| 22 | Design | D3 소프트초과·D5 표면·D12 허브 스코프 → 게이트 | Taste/Challenge | 규칙 | 제품 결정 | — |
| 23 | Eng | E1 owner advisory lock 신설(계획 오류 교정) | Mechanical | 정확성 | create에 락 전무 실측 — COUNT 레이스 | COUNT-only |
| 24 | Eng | E2 grant ledger 모델 채택 | Mechanical | P1 | event_pass 스태킹·이력·멱등·감사 동시 해결 | 단일행 upsert |
| 25 | Eng | E3 entry_cap 스냅샷+raise-only | Mechanical | P5 | 만료 절벽 제거·resolver 결합 0 | register 시점 평가 |
| 26 | Eng | E4 PortOne V2 웹훅+API 재조회 | Mechanical | P1 | replay·out-of-order 근본 방어 | V1+upsert |
| 27 | Eng | E5 취소 액션 배선·E6 resolver 순수화·E8 text+CHECK·E9 Supabase EF·E10 grant 4종·E14 rate limit 재사용·E15 부분 인덱스 | Mechanical | P1/P4/P5 | 실측 근거 §10 | — |
| 28 | Eng | E11 금액 노출 정책 1차 제외 | Mechanical | P3 | anon 경로 entitlement 결합 회피 | 1차 포함 |
| 29 | Eng | E3 한도 의미·E7 grandfather 정의 → 게이트 | Taste | 규칙 | 제품 결정 | — |
| 30 | — | DX 페이즈 스킵 | Mechanical | 규칙 | 개발자 대상 표면 없음 | — |
