# 핸드오프 — 공고 도메인 W1 이어서 (다음 세션 메인 프롬프트)

> 아래 블록을 다음 세션 첫 프롬프트로 그대로 붙여넣으면 된다.

---

공고 도메인 감사 W1(즉시 수정) 12항목 중 2개를 마쳤다. 나머지 10개를 이어서 구현해줘.

## 0. 작업 위치 — 이미 격리돼 있다 (새로 만들지 말 것)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\posting-flow-audit`
- 브랜치: `feat/posting-flow-completeness` (베이스 `origin/master` = `254592ada`)
- node_modules 정션·`.env.local` 셋업 완료. **다른 워크트리 3개(`T-HOLDEM-posting-close`·`T-HOLDEM-schedule`·메인)는 접촉 금지.**
- 커밋 4개 완료: `c798cc7eb`(감사 문서) `b0bd9dbde` `34b9b489f`(W1-7) `7b43b3bb4`(W1-1). **미push.**

## 1. 필독 (순서대로)

1. `docs/analysis/2026-07-27-posting-domain-audit.md` — 감사 본문. **§4 실행 계획의 W1 항목이 작업 지시서**이고 각 항목에 `왜/어떻게/파일/위험/완료 증명`이 있다. §3 메타패턴 8개를 먼저 읽어야 "개별 수정이 아니라 공통 관문을 세우는 일"이라는 설계 의도가 잡힌다.
2. §0 **감사의 한계** — 적대 검증이 189건 중 반박 0건이다. 확정(CONFIRMED)은 "증명됨"이 아니라 "근거가 인용된 유력 가설"이다. **구현 착수 전 건별로 file:line 을 직접 열어 재확인할 것.** 실제로 이번 세션에서 재확인이 결론을 바꾼 사례가 있다(아래 §5).
3. 원자료 JSON(영역별 리뷰 전문·판정)이 필요하면 감사 문서 맨 끝의 스크래치패드 경로. 세션이 바뀌면 사라질 수 있으니, 없으면 문서 §7 표의 file:line 으로 직접 코드를 읽으면 된다.

## 2. 남은 10항목 (권장 순서)

| 순서 | 항목 | 결함 | 규모 |
|---|---|---|---|
| 1 | **W1-4** 정산 편도 잠김 | SET-1(시간 수정해도 정산 영구 거부) · SETTLE-3(지급 완료 되돌리기 부재) | M |
| 2 | **W1-3** 금액 진실원 정렬 | SETTLE-5 · SETTLE-8 · STAFF-3(스태프측) · SETTLE-18 | M |
| 3 | **W1-2** 보장시간 미반영 | SETTLE-2 | M |
| 4 | **W1-6** realtime 훅 계약 | STAFF-1(무한 스피너, CRITICAL) · STAFF-11 · APPL-5 · ORDER-9(허브) | M |
| 5 | **W1-5** 부분 확정 소실 | APPL-1(CRITICAL) · EDIT-9 | L |
| 6 | **W1-8** QR 무결성 | RPC-1(노쇼 되돌리기) · QR-2(거짓 성공) · QR-7 | M |
| 7 | **W1-9** 공고 수정 덮어쓰기 | EDIT-1 · EDIT-2(낙관적 잠금 부재) | L |
| 8 | **W1-10** 취소 사유 공개 게시 | CANCEL-12 (검증에서 UPGRADED) | S |
| 9 | **W1-11** 제출 피드백 공통화 | APPL-7 · CANCEL-14 · STAFF-4 · ORDER-3(허브) · CANCEL-15 · ORDER-5 | M |
| 10 | **W1-12** 주문서 무음 유실 | ORDER-3 · ORDER-11 · ORDER-4 · ORDER-8 · ORDER-9 (주문서 영역) | M |

W1-3 과 W1-2 는 같은 정산 계산 경로를 건드리니 연달아 하는 편이 낫다. W1-11 은 5개 화면을 관통하는 공용 훅이라, 개별 수정으로 흩뿌리지 말 것.

## 3. 작업 절차 (이번 세션에서 실제로 통한 방식)

1. 항목 착수 전 **감사 주장을 코드로 재확인**한다. 라인이 어긋났으면 주변을 찾는다.
2. **TDD**: 실패 테스트 먼저 → RED 확인(출력을 실제로 볼 것) → 최소 구현 → GREEN.
3. **로직은 순수 함수로 뽑아 테스트**한다. 컴포넌트/훅을 직접 렌더해 검증하려 들면 §4 의 함정에 걸린다.
4. 항목 1개 = 커밋 1개. 커밋 전 `cd uniqn-mobile && npm run quality` **exit 0** + 관련 jest green.
5. 항목 몇 개마다 전체 jest 1회. **현재 기준선 = 549 스위트 / 6060 테스트 전부 통과**(이 숫자보다 줄면 회귀다).
6. 마지막에 code-reviewer(`model: fable`, 한도 걸리면 opus) 디스패치 → CRITICAL/HIGH 수정 → push/PR 여부를 사용자에게 질문.

## 4. 이 세션에서 부딪힌 함정 (반복하지 말 것)

- 🚨 **`jest.setup.js:198` 이 `useMutation` 을 전역 no-op 스텁으로 모의한다.** 그래서 **어떤 훅 테스트도 mutationFn 을 실행하지 못한다** — "서비스에 무엇을 넘기는가" 부류의 결함은 훅 테스트로 검출 불가다. 파일 안에서 `jest.mock('@tanstack/react-query', () => jest.requireActual(...))` 로 되돌리면 **테스트가 행에 걸린다**(실측). 대안: 로직을 순수 함수로 뽑거나, **타입으로 강제**한다(이번에 `actorType` 기본값을 제거해 컴파일 타임 가드로 바꿨고 기본값 의존 호출부 3곳을 즉시 검출했다).
- 🚨 **마이그레이션은 `uniqn-mobile/supabase/migrations` 에 있다.** 리포지토리 루트의 `supabase/` 를 grep 하면 **조용히 0건**이 나온다(이번 세션에서 거짓 음성으로 잘못된 근거를 한 번 냈다).
- 🚨 **`src/types/supabase.ts` 는 낡았다**(최종 갱신 07-20). prod 에 있는 `clocked_out_raw`·`end_time_source`·`edited_by` 가 빠져 있다. 스키마 판정 근거로 쓰지 말 것 — prod 덤프 베이스라인이나 `information_schema` 실측을 쓴다.
- `toCamelCase`(`src/utils/supabase.ts:704`)는 **얕은 변환**이다. 중첩 JSONB 키는 snake_case 로 남는다.
- 큰 SQL 함수를 `CREATE OR REPLACE` 로 옮길 땐 **손으로 베끼지 말고 스크립트로 복사·치환**하라(전사 오류 방지). 이번 마이그레이션도 그렇게 만들었다.
- 한글 파일 조작은 Edit/python 으로. PowerShell 5 `Get/Set-Content` 는 cp949 로 깨진다.

## 5. 재확인이 결론을 바꾼 사례 (§0 한계의 실제 사례)

- 감사 보고서 §5 는 STAFF-3(`settlement_breakdown`)을 "prod 드리프트일 개연성이 높으니 실측 전 착수 금지"로 보류했다. → prod `information_schema.columns` 실측 결과 **컬럼이 정말 없었다**. 보류 판단이 틀렸고 결함이 맞았다.
- 반대로, 어떤 주장은 근거 라인이 어긋나 있었다. **항상 열어볼 것.**

## 6. 사용자 게이트 — 임의로 진행 금지

- 🔴 **`uniqn-mobile/supabase/migrations/20260727100000_fix_cancellation_request_camel_keys.sql` 는 prod 미적용.** 적용 전 오염 행 수를 실측하고(`SELECT count(*) FROM applications WHERE cancellation_request ? 'reviewed_at'`) 사용자 승인을 받아라. 클라 관용 계층이 이미 사용자 영향을 해소했으니 급하지 않다.
- **prod 조회는 매번 사용자 승인**을 받는다(이번 세션은 컬럼 확인 1건만 승인받아 실행).
- **push·PR 은 명시 요청 시에만.** 로컬 커밋은 사전 승인돼 있다.
- 마이그레이션 적용은 `mcp__supabase__apply_migration` 전용, `db push` 금지. **기존 마이그레이션 파일 수정 금지.**

## 7. 완료 후 남는 것

- W2(핵심 완성도 10항목)·W3(구조 6항목)은 감사 문서 §4 에 그대로 있다. W3-1(고정 공고를 1급 시민으로 — `work_logs` 행 수명 재설계)은 홀덤펍 상시 알바가 주 타깃이라 **W3 중 최우선**이다.
- 실기기 QA·웹/OTA 배포는 별도 게이트.

---

## 부록 — 이번 세션에서 고친 것 (재보고 금지)

| 결함 | 내용 | 커밋 |
|---|---|---|
| STAFF-3 | 근무시간 수정이 prod 에서 전량 실패 — `work_logs` 에 없는 `settlement_breakdown` 을 UPDATE (두 경로) | `b0bd9dbde` |
| ATT-1·STAFF-2 | '출근 예정으로 변경' 이 QR 실측 시각을 이력·알림 없이 삭제 | `b0bd9dbde` `34b9b489f` |
| ATT-2 | 수동 출퇴근에 감사 로그 부재 | `b0bd9dbde` |
| ATT-3 | 출근 기록 없는 스태프에 '퇴근 처리' 노출 → 근무 0분 확정 | `34b9b489f` |
| GRID-1 | 근무표 시트가 정한 적 없는 `02:00` 을 저장 → 없던 8시간이 정산 근거로 | `34b9b489f` |
| CANCEL-1 | 취소 승인 직후 지원서가 양쪽 목록에서 증발 | `7b43b3bb4` |
| CANCEL-2 | 사장님 '확정 해제' 가 항상 unauthorized | `7b43b3bb4` |
