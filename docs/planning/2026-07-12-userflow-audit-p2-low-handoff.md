# 핸드오프 — 유저플로우 감사 잔여(P2·LOW·리뷰 재실행·출하 게이트) (다음 세션 메인 프롬프트)

> 이 파일을 다음 세션 첫 프롬프트로 그대로 붙여넣으면 된다. 2026-07-11~12 세션에서 **P0·P1 전항을 출하**했고(마이그 3종 prod 적용·md5 파리티), 이 문서는 그 뒤를 잇는다.

---

## 붙여넣을 프롬프트 (여기부터)

너는 UNIQN(홀덤펍·대회사 대상 단발 인력매칭 앱, Expo/RN/TS/Supabase)의 유저플로우 감사 후속을 이어받는다. 이전 세션들이 감사(확정 24건/8뿌리) → **P0 5건 + P1 7건 + 후속 LOW 2건 전항 구현·prod 출하**를 끝냈다. 남은 것은 ①**코드 리뷰 재실행(최우선)** ②P2·방어심화 LOW ③파리티 부채 ④push/PR 게이트다.

### 먼저 읽어라 (재탐색 금지)
- 메모리 `project_userflow_audit_20260710` — 전체 맥락·완료분·함정
- `docs/analysis/2026-07-10-userflow-audit.md` — §4 백로그(P0/P1 체크 완료 상태), §9(P0 실행기록), §10(P1 실행기록 + 잔여 목록)
- 이 파일

### 작업 환경 (엄수)
- **브랜치**: `analysis/userflow-audit-20260710` — **24커밋 미push**(`fd4ec652c`..`00291f083`). master는 별개로 전진 중.
- **워크트리**: `C:/Users/user/Desktop/T-HOLDEM-authority` (node_modules 정션됨). 반드시 여기서. 메인 체크아웃(`C:/Users/user/Desktop/T-HOLDEM`)은 병렬 세션이 master로 전환한다(실제로 겪음).
- ⚠️ **공유 Docker 스택 함정 (2026-07-12 신규 실측)**: 로컬 Supabase 스택(`supabase_db_uniqn`)은 **모든 체크아웃이 공유**한다. 병렬 세션이 prod 스냅샷으로 재구축해 이 미push 브랜치의 마이그레이션(P0#1 포함)과 픽스처가 로컬에서 증발했었다. **pgTAP 실행 전 반드시**: ①`wl_update` 정책에 staff self-update 부재 확인(P0#1) ②`cancel_application_atomically`에 employer_initiates 존재 확인 ③`supabase/fixtures/*.sql` 재적용. 복구는 `docker exec -i supabase_db_uniqn psql -U postgres -d postgres -q < <파일>` (마이그 이력 발산 때문에 `supabase migration up`은 LegacyMigrationMissingLocalError로 실패한다 — psql 직접 적용이 정답).
- 마이그레이션: **prod 함수/정책 본문 원본**(pg_get_functiondef 실측) 기반, 새 타임스탬프, `mcp__supabase__apply_migration` 전용, 적용 후 **prod md5 파리티 실측**. 기존 마이그 수정 금지. RLS/권한/마이그 전 `/guard`(편집 경계 `uniqn-mobile/`).
- 커밋 사전승인(로컬만). push/PR은 사용자 명시 요청 시만.
- 슬라이스 규약: TDD RED 확인 필수 → code+security 리뷰 → 커밋. 게이트=`tsc`+`jest 전체`+`pgTAP 전체`(직전 세션 기준선: jest 390/4955 · pgTAP 58/655 · tsc 0).

### 남은 작업 (우선순위 순)

**① 최우선 — P0·P1 앱코드 정식 code-review 재실행**
- 리뷰어(opus)가 세션 한도로 **2회 중단**됐다(계정 5시간 윈도우). 보안 리뷰는 3회 전부 완료(CRITICAL~MEDIUM 0)·마이그 SQL은 기존정의↔적용본 diff 실측으로 대체 완료 — **앱레이어 코드의 정식 code-review만 미완**.
- 범위: `git diff 79ef444eb^..2aa9295f8` 중 앱코드(마이그·pgTAP 제외 가능). 슬라이스별 커밋 메시지에 맥락 있음.
- 지적 나오면 후속 커밋으로 반영. **opus 한도 상태를 먼저 확인**하고 여유 시간대에 디스패치하라.

**② LOW 방어심화 배치 (DB 1슬라이스로 묶기 권장 — /guard 먼저)**
- 완료건 custom_* 변경 DB 트리거 차단 — work_logs UPDATE RLS는 payroll_status를 안 봐서 인가된 매니저가 PostgREST 직접 UPDATE로 완료건 custom_salary 변경 가능(P1 보안리뷰 LOW). 기존 `protect_work_log_payroll_columns` 트리거 확장 검토 — ⚠️P0#1 교훈: 이 트리거는 SECDEF+GUC 상호작용이 있어 **QR RPC를 깨뜨리지 않는지 pgTAP로 반드시 확인**.
- applications INSERT RLS/트리거에 approvalStatus 검사 — 미승인 대회 조기지원 직접 INSERT 우회 차단(P0-D 보안리뷰 LOW).
- 파리티 부채: `applications_updated_at`·`applications_xss_check` 트리거가 prod엔 있으나 레포 누락(20260420235202 드롭 후 prod만 재생성) — 마이그로 고정. ※더 큰 파리티 작업은 별도 트랙(`docs/planning/2026-07-11-parity-baseline-squash-handoff-prompt.md`)과 중복 조심.

**③ 앱레이어 LOW**
- ScheduleCard.tsx 66~98행 `payrollAmount > 0` 가드 → 동결 판정 헬퍼 SSOT 통일(settlementGrouping은 Number.isFinite로 0도 동결 존중 — 계약 어긋남).
- `CancelActorType` 인터페이스 배럴(interfaces/index.ts) 재수출.

**④ P2 (감사 §4 #13~16, 낮음)**
- #13 `confirm_application` 동시성 예외 문구 매핑 · #15 `CollaboratorSearch.tsx:56` 죽은 분기(미검증 — 실측 먼저) · #16 `useWorkspaces.ts:229` 초대 실패 캐시 무효화(미검증).
- #14 JPC 초대 수락/거절 계약(클러스터 G, 프라이버시)은 **설계 필요** — 기존 P2#14=R2 협업단일화와 같은 슬라이스라는 사용자 결정 있음(메모리 `project_ux_flow_review_20260710`). 착수 전 사용자 확인.

**⑤ 감사 §5-추가 백로그 (레포↔prod 파리티, 별도 판단)**
- `base_schema.sql:654` 느슨한 notifications INSERT 정책 제거 + `users.nickname` UNIQUE 추가(레포가 prod보다 위험 — db reset 시 구멍) · anon write grant 회수(notifications·applications·work_logs) · `notify_on_job_posting_update` malformed array 런타임 실패(prod 재현 미확인) · work_logs INSERT/DELETE 정책 파리티. ②의 파리티 항목과 같은 배치로 묶어도 된다.

**⑥ 출하 게이트 (사용자 명시 요청 시만)**
- **push/PR**: 24커밋 — 논리 단위 분할 제안: (a)P0 앱레이어 4커밋 (b)P0-B 마이그 2커밋 (c)P1 앱레이어 4커밋 (d)P1 마이그 1커밋 (e)rename/docs. 또는 단일 PR(squash 저장소 관례). ⚠️PR 머지 직전 최신 master 재통합+재검증(stale-base 재발 이력, rebase 금지=merge).
- 마이그 3종은 이미 prod 적용됨 — PR은 레포 정합화 목적.

### 범위 밖 (제품 결정 필요 — 사용자 확인 없이 착수 금지)
- `staff-role-collaborator-locked-out`: `app/(employer)/_layout.tsx` `useHasRole('employer')` 게이트 — "staff-role에게 employer 화면 노출?" 결정 필요.
- 기존 blocker **B1**(fixed 공고 취소 사유 미노출)·**B2**(crossesMidnight) — 별도 트랙.

### 오케스트레이션 (이전 세션 실측 교훈)
- 구현=opus 병렬(파일셋 상호 배타 명시·커밋 금지·메인이 diff/테스트 재실측 후 커밋), 설계·prod 실측·마이그=메인 세션(subagent는 mcp__supabase__* 금지).
- **opus 세션 한도 주의**: 리뷰어 2회·구현자 1회 중단됐다. 중단되면 부분 완료 트리를 tsc/grep으로 상태 파악 후 메인이 이어 완성(이번 세션 rename 슬라이스가 그 사례). fable(메인)은 도구 검증이 뒤따르는 기계 작업만 — 암산·비검증 판단 금지.
- 에이전트 "성공" 보고는 diff·테스트 직접 재실행으로 독립 검증 후 커밋.
- 기존 pgTAP가 취약 동작을 고정하고 있을 수 있다(P0#1·P1#7 두 번 재현) — 하드닝 시 하네스 충돌 예상하고 시드 방식 전환 검토.

### 마무리
- 각 슬라이스 완료 시 감사 §4 백로그 체크 + §N 실행기록 + 메모리 갱신. 세션 끝 `/session-wrap`.

## 프롬프트 끝
