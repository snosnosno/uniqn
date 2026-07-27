# 핸드오프 — 공고 도메인 W1 이어서 (2차, 남은 4항목)

> 아래 `---` 블록을 다음 세션 첫 프롬프트로 그대로 붙여넣으면 된다.

---

공고 도메인 감사 W1(즉시 수정) 12항목 중 8개를 마쳤다. 남은 4개를 이어서 구현해줘.

## 0. 작업 위치 — 이미 격리돼 있다 (새로 만들지 말 것)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\posting-flow-audit`
- 브랜치: `feat/posting-flow-completeness`, **미push**
- 베이스가 바뀌었다: 지난 세션에 `origin/master`(`638ef4110`, PR#353 가드 정리)를 병합했다(`2a8981fe2`).
  **회귀 기준선도 그때 바뀌었다 — 549 스위트 / 6022 테스트**(예전 6060 은 PR#353 이
  `ApplicationStatusMachine.test.ts` 를 지우면서 줄어든 것이다).
- 로컬 Supabase Docker 스택(`supabase_db_uniqn`)이 떠 있다. pgTAP 을 **실제로 돌릴 수 있다**(§4).

## 1. 필독 (순서대로)

1. `docs/analysis/2026-07-27-posting-domain-audit.md` — §0(한계) → §3(메타패턴 8) → §4 의 남은 W1 항목.
   **§4 항목이 작업 지시서**다.
2. 지난 세션의 **항목별 재확인 결과**가 `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-T-HOLDEM\<세션>\scratchpad\verify\W1-*.json` 에 있었다.
   세션이 바뀌면 사라진다 — 없으면 감사 문서의 file:line 으로 직접 읽어라(라인이 밀려 있을 수 있다).
3. 감사 결과를 그대로 믿지 마라. 적대 검증이 189건 중 반박 0건이라 확정 판정은 "유력 가설"이다.
   **지난 세션 10항목 재검증에서 REFUTED 는 0건이었지만 ADJUSTED(라인 이동·범위 오류)가 다수였고,
   두 건은 결론 자체를 바꿨다**(§3 참조).

## 2. 남은 4항목 (권장 순서)

| 순서 | 항목 | 결함 | 규모 |
|---|---|---|---|
| 1 | **W1-9** 공고 수정 덮어쓰기 | EDIT-1 · EDIT-2 | L |
| 2 | **W1-10** 취소 사유 공개 게시 | CANCEL-12 | S |
| 3 | **W1-11** 제출 피드백 공통화 | APPL-7 · CANCEL-14 · STAFF-4 · ORDER-3(허브) · CANCEL-15 · ORDER-5 | M |
| 4 | **W1-12** 주문서 무음 유실 5종 | ORDER-3 · ORDER-11 · ORDER-4 · ORDER-8 · ORDER-9 | M |

W1-11 은 5개 화면을 관통하는 공용 훅(`useSubmitGate`)이라 **개별 수정으로 흩뿌리지 말 것**.

## 3. 이미 내려진 제품 결정 (다시 묻지 말 것)

지난 세션에 사용자가 확정한 것:

- **W1-2 보장시간** = 표시 전용(금액 미반영). 단 `(금액에 미반영)` 같은 **명시 문구는 넣지 않는다**.
- **W1-8 QR no_show** = 구제 허용(스캔으로 출근 가능 + 이력 기록).
- **W1-10 대타 게시** = **절충안** — 기본 OFF + 사유 원문 제거 + 미리보기. 게시 시점은 요청 직후 유지.
- **W1-5 정원 가드 fail-open** = 관측만, 화이트리스트 전환은 보류(prod 실측 전).

아직 안 물어본 것 (W1-9 착수 전 사용자에게 물어라):
- **낙관적 잠금 충돌 시 UX**: (a) 즉시 실패 + 재조회 유도 vs (b) 서버 최신본 머지 vs (c) 충돌 필드 선택.
  UserRepository 선례는 (a)지만, 공고 편집 폼은 입력량이 커서 (a)면 사용자 입력이 통째로 날아간다.

## 4. 이번 세션에서 통한 방식 (그대로 쓰면 된다)

1. 항목 착수 전 **감사 주장을 코드로 재확인**. 라인이 어긋났으면 주변을 찾는다.
2. **TDD**: 실패 테스트 먼저 → RED 를 **실제 출력으로 확인** → 최소 구현 → GREEN.
   훅처럼 되돌리기 어려운 경우엔 `git checkout HEAD -- <파일>` 로 잠깐 되돌려 RED 를 찍고 복원했다
   (useConfirmedStaff 에서 실제로 이 방법으로 "신규 4개만 실패, 기존 12개 무영향"을 증명했다).
3. **pgTAP 은 로컬에서 진짜 돌릴 수 있다.** 공유 스택을 더럽히지 않는 방법:
   마이그레이션 + `CREATE EXTENSION IF NOT EXISTS pgtap` 을 **테스트의 BEGIN…ROLLBACK 안에 주입**해
   한 파일로 합친 뒤 실행한다. ROLLBACK 이 함수 정의와 확장 설치까지 전부 되돌린다.
   ```bash
   MSYS_NO_PATHCONV=1 docker cp <합친파일> supabase_db_uniqn:/tmp/x.sql
   MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/x.sql
   ```
   RED 는 **수정 전 함수 정의**를 대신 주입해서 만든다. 실제로 W1-5·W1-8 둘 다 이렇게 Red-Green 을 찍었다.
4. 항목 1개 = 커밋 1개. 커밋 전 `cd uniqn-mobile && npm run quality` **exit 0** + 관련 jest green.
5. 마지막에 code-reviewer(`model: fable`, 한도 걸리면 opus) → CRITICAL/HIGH 수정 → push/PR 여부 질문.

## 5. 함정 (이번 세션에서 실제로 걸린 것)

- 🚨 **`MSYS_NO_PATHCONV=1` 없이 `docker cp /tmp/...` 하면 Git Bash 가 경로를 Windows 로 바꿔 실패**한다.
  `/tmp` 대신 스크래치패드에 파일을 만들고 위 플래그를 붙일 것.
- 🚨 **pgTAP 픽스처는 앞선 케이스의 상태를 물려받는다.** `already_settled` 같은 **선행 가드가 먼저 걸려**
  정작 검증하려던 가드에 도달하지 못한다. 케이스마다 관련 컬럼을 초기화하라.
- 🚨 **`payroll_*` 컬럼은 `protect_work_log_payroll_columns` 가 막는다.** 테스트에서 리셋하려면 JWT 클레임에
  `app_metadata.role='employer'` 를 넣어야 한다 — **최상위 `role` 만 넣으면 통과하지 못한다**.
- 🚨 **`?? ` 로 3-값(undefined=미변경 / null=삭제)을 병합하면 삭제가 무시된다**(`null ?? x === x`).
  `workLogTimeStatus.ts` 에서 이 병합을 헬퍼 안으로 넣어 고정했다. 같은 패턴을 또 쓰지 말 것.
- 🚨 **기본값 제거가 최고의 검출 도구다.** `actorType` 기본값을 지우자 컴파일러가 **실제 프로덕션
  호출부**를 즉시 잡아냈다(W1-5). 인가·분기를 바꾸는 인자에 기본값을 두지 말 것.
- 🚨 **jest.setup.js 가 `useQuery`·`useMutation` 을 전역 모의**한다. `useConfirmedStaff.test.ts` 와
  `useApplicantManagement.test.ts` 는 파일 단위로 재모의하므로 **새 훅 테스트는 이 두 파일 안에 추가**하라.
  새 파일을 만들면 전역 스텁이 걸려 훅 로직이 아예 안 돈다.
- 🚨 **한글이 `\uXXXX` 이스케이프로 저장된 소스가 있다**(SettlementSummaryCard). Edit 이 매칭에 실패하면
  python 으로 라인 단위 치환하라.
- 마이그레이션은 `uniqn-mobile/supabase/migrations`. 리포 루트 `supabase/` 를 grep 하면 조용히 0건.
- 큰 SQL 함수 교체는 **손으로 베끼지 말고 스크립트로 복사·치환**. W1-5·W1-8 둘 다 그렇게 만들었다.

## 6. 사용자 게이트 — 임의 진행 금지

- 🔴 **prod 미적용 마이그레이션이 3개 쌓였다. 적용 순서가 중요하다.**
  1. `20260727100000_fix_cancellation_request_camel_keys.sql` (W1-1, 오염 row 백필 포함)
  2. `20260727150000_restore_original_assignments_on_cancel.sql` (W1-5) — 1번의 함수 정의를 이어받았다.
     **이것만 적용하면 1번의 백필 UPDATE 가 실행되지 않는다.**
  3. `20260727160000_qr_checkin_status_whitelist.sql` (W1-8)
- **prod 조회·마이그레이션 적용·push·PR 은 전부 사용자 승인**. 로컬 커밋만 자율.
- 마이그레이션 적용은 `mcp__supabase__apply_migration` 전용, `db push` 금지. **기존 마이그레이션 파일 수정 금지.**

## 7. 완료 후 남는 것

- W2(10항목)·W3(6항목)은 감사 문서 §4 에 그대로 있다. W3-1(고정 공고 1급 시민화)이 W3 중 최우선.
- 실기기 QA·웹/OTA 배포는 별도 게이트. 특히 W1-8 은 카메라 실물 경로라 유닛으로 못 덮는다
  (실패 후 즉시 재스캔 / 느린 네트워크에서 '확인 중...' 표시 2가지).

---

## 부록 A — 지난 세션에서 고친 것 (재보고 금지)

| 커밋 | 항목 | 핵심 |
|---|---|---|
| `2a8981fe2` | (병합) | origin/master 638ef4110 반영. 기준선 549/6022 로 재측정 |
| `d33b1cc77` | W1-4 | 시간 수정이 status 를 승격하지 않아 정산 영구 거부 + 지급 완료 되돌리기 배선 |
| `790ea29c3` | W1-3 | 동결값 SSOT 위반 5곳 → 0곳 + ESLint 기계 차단 + 거짓 카피 교정 |
| `26e69d410` | W1-2 | 보장시간을 수당 자리에서 분리(표시 전용 계약 테스트로 고정) |
| `c80dccb58` | W1-6 | realtime 훅 계약 — 무한 스피너·no-op 새로고침·낙관갱신 그림자·미처리 rejection |
| `5ce8e0cde` | W1-5 | 확정 해제 시 원본 assignments 복원(신규 컬럼 없이) + actorType 기본값 제거 |
| `e4a630a7e` | W1-8 | QR 출근 화이트리스트 + 실패 스캔 throttle 되돌림 + 거짓 초록 제거 |

## 부록 B — 재확인이 결론을 바꾼 사례 (§1-3 의 실제 근거)

1. **W1-9(EDIT-1)의 전제가 사라졌다.** 감사는 '축소 payload 가 schedule 키를 제거해 일정이 유실된다'
   고 했지만, 병합한 PR#353 이 `draftToUpdateJobPostingInput` 의 `hasConfirmedApplicants` 분기를
   **이미 삭제**했다. 그대로 구현했다면 없는 코드를 고치는 셈이었다.
   → W1-9 는 **EDIT-2(낙관적 잠금 + 영향 행 수 미검사)가 본체**다. EDIT-1 은 재판정부터 하라.
2. **W1-5 는 신규 컬럼이 필요 없었다.** 감사는 `original_assignments` 컬럼 신설을 처방했지만,
   `original_application` 이 이미 있고 최초 확정 때 클라이언트가 백필한다. 원본은 유실된 적이
   없었고 **되돌리는 코드만 없었다** — 마이그레이션 범위가 컬럼 추가에서 UPDATE 한 줄로 줄었다.
