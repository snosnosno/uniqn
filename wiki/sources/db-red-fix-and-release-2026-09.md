---
area: sources
updated: 2026-09-19
status: current
sources:
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - uniqn-mobile/supabase/tests/communication_comment_update_hardening.test.sql
  - uniqn-mobile/supabase/tests/work_schedule_qr_container_auto.test.sql
  - uniqn-mobile/supabase/migrations/20260918105900_qr_checkout_candidate_uses_scan_time.sql
  - uniqn-mobile/supabase/migrations/20260918110000_board_comment_permission_before_pin_invariants.sql
  - uniqn-mobile/src/services/notifications/__tests__/settlementNotifyCopy.parity.test.ts
  - uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx
  - .claude/skills/deploy/SKILL.md
  - docs/planning/2026-09-18-red-fix-review-merge-session-prompt.md
  - PR#497
  - PR#498
  - PR#501
  - PR#502
tags: [pgtap, parity, qr, notification, deploy, ota, migration, release]
---

# 소스 요약: DB red 4건 종결 → #497 머지 → prod 배포 전량 (2026-09-18~19)

09-15 판(`2026-09-15-db-red-and-release-session-prompt.md`)을 09-18 판이 대체했고, 09-19 에
그 문서의 §6 이 **계획에서 실측 기록으로** 바뀌었다. 여기 요약은 두 세션의 결과만 담는다.

## 착지 사실

| 항목 | 값 |
|---|---|
| PR#497 머지 | `e058f3215` (2026-09-18T02:52:45Z) · 아카이브 태그 `archive/employer-ia-followup-20260918`=`de734b729` |
| 최종 `origin/master` | **`12f5af375`** (#502) — 이후 #501(공고상세 UI)·#502(배포문서)까지 포함 |
| DB Tests | red 4 → **0**. `db:reset && test:db` = 123 files / **1394 tests** / PASS |
| 전체 jest | 691/691 suites · 7753/7753 tests (영향권을 **파일명 패턴으로 고르지 않고 전체**를 돌렸다) |
| fable 리뷰 | code-reviewer **APPROVE**(CRITICAL/HIGH 0) · database-reviewer MEDIUM 1 — 지적 3건 전량 반영 |
| prod 마이그 | **4건 적용 완료** (`20260915122335` · `20260915133500` · `20260918105900` · `20260918110000`) — prod 최신 = `20260918110000` |
| production OTA | `cf441657-e241-421f-b393-0ebe97029adf` (runtime 1.0.7, commit `2b4367da0`) · 직전 `b1dee268`(commit `2f6de5ba2`) |
| 웹 CF Pages | `38945720` (Production/master) · 직전 `74de3161` |
| EAS Build | **미실행** — 네이티브 변경 0건이라 version bump 불필요(1.0.7 유지) |

> ⚠️ **모순 플래그**: 원천 문서 §6-0-a 는 OTA `b1dee268` / 웹 `74de3161` / master `2f6de5ba2` 로
> 적혀 있다. 이는 **#501·#502 직전의 1차 배포 값**이고, 위 표가 09-19 2차 배포 후의 값이다.
> 원천은 raw 라 수정하지 않았다 — 라이브 값은 이 페이지를 정본으로 본다.

## red 4건의 정체 (처리 순서대로)

1. **`parity_baseline_guard`** — 조사 완료, 장부 갱신만. → [[prod-parity-baseline]]
2. **`posting_qr_attendance`** — 테스트가 **실제 UX 결함**을 드러냈다. 퇴근 후보 구간 하한이
   15분 **올림 정규화된** `check_in_ts` 라, 출근 직후 최대 15분간 후보가 0 →
   `checkout_too_early`("잠시 후") 대신 `no_eligible_work_log`("해당 근무가 없습니다")가 떴다.
   막히는 것 자체는 옳고 **막히는 이유가 다르게 보이는** 결함이다. 사용자가 (a)안을 택해
   하한을 원본 스캔시각 `COALESCE(wl.check_in_scanned_at, wl.check_in_ts)` 로 옮겼다
   (`20260918105900`). → [[worktime-ssot]]
   - 🚨 **기대값을 `no_eligible_work_log` 로 바꿔 통과시키는 것은 UX 결함을 계약으로 굳히는 것**이다.
3. **`work_schedule_qr_container_auto`** — 예상대로 2 와 같은 뿌리였고 함께 풀렸다.
4. **`communication_comment_update_hardening`** — 트리거 **발화 순서** 문제. 작성자가 자기 댓글을
   고정하면 권한 사유가 아니라 내부 메타데이터 규칙(`pinned comments require pin metadata`)이
   먼저 떴다. **권한 검사가 먼저**여야 한다(권한 없는 사람에게 내부 구조를 알려주지 않는다) →
   `20260918110000` 으로 트리거를 재등록해 순서를
   `parent_integrity → update_scope → updated_at → xss_check → zz_pin_invariants` 로 고정.

## 이 세션이 확립한 검증 기법 2종

- **컬럼 단위 ACL 은 `pg_attribute.attacl` 로 단언한다.** 픽스처의 블랭킷 GRANT 가
  `pg_class.relacl` 을 덮어써서 `has_column_privilege` 는 항상 참이다. → [[test-db-grants]] ·
  [[vacuous-verification]] 유형 6
- **시각 단언의 하한은 호출 직전 `clock_timestamp()` 로 캡처한다.** 고정 과거 상수
  (`> '2026-01-01'`)를 하한으로 쓰면 엉뚱한 값이 들어와도 통과한다 —
  fable 리뷰 지적. 실물 = `work_schedule_qr_container_auto.test.sql` 의 `raw_lower_bound_is_tight`
  (하한이 조여 있다는 것 **자체를 단언**한다). → [[vacuous-verification]] 유형 7

## 배포에서 새로 물린 것

- `eas update` 는 **비대화형에서 `--environment` 없이 거부**된다(eas-cli 21.7.0). 에이전트가
  도구로 호출하면 TTY 가 없어 항상 비대화형 → 사실상 필수 플래그. 09-19 OTA 가 이걸로 1회 실패.
  `--branch`(채널)와 `--environment`(EAS 환경변수 세트)는 **다른 축**이고, shell export 는
  그대로 필요하다. 정본 = `.claude/skills/deploy/SKILL.md` §5 규칙 2. → [[deploy-channel-skew]]
- **함대가 갈렸다** — 1.0.6 기기는 runtimeVersion 이 달라 이 OTA 를 못 받는다. 그런데 정산 알림
  문구는 **DB 트리거가 실질 정본**이라 1.0.6 도 새 문구를 본다. 반면 **#501 은 순수 클라 UI 라
  그런 우회가 없다** — 스토어 업데이트가 유일한 경로.
- 번들 grep 거짓음성의 **3번째 형태**: 이스케이프 범위를 틀리면(공백까지 ` ` 으로) 신규·구
  문구가 **둘 다 0건**으로 나와 배포 실패로 오판한다. 번들은 **비ASCII 만** `\uXXXX` 로 싼다.
  또한 구 문구를 대조군으로 쓸 때 `정산이 완료되었습니다` 는 사장용 처리결과 문구로 **정당히 남아
  있어** 거짓 FAIL 을 만든다 — 진짜 판별자는 `지급액`.

## 파리티 −11 의 규명

09-12 판이 남긴 숙제("정책 11개 감소의 정체")가 닫혔다. 차이 전부가 **장부에 누락된 9월 마이그
7건**이고, −11 = `20260910002240` 의 정책 순감 7 + **`DROP TABLE board_votes` 로 함께 사라진
`bv_*` 정책 4**. 🔑 **테이블을 지우면 그 위 정책도 사라진다** — CREATE/DROP POLICY 문장만 세면
설명이 안 된다. (09-18 판이 지목한 `20260809140000` 은 원인이 아니었다.)

## UI 후속 (#501)

공고 상세의 근무 정보(일정·급여·위치)를 **기본 접힘**으로 바꾸고, '함께 관리할 사람'을 헤더 `⋯`
시트에서 **'관리' 타일로 되돌렸다**. 비게 된 `⋯` 버튼과 시트는 함께 제거했다.
🔑 **항목이 하나뿐인 점 셋 메뉴는 진입점이 아니다** — 열기 전까지 무엇이 있는지 알 수 없다.
→ [[entry-point-stability]]

## 남은 사람 게이트 (코드 잔여 0)

프로덕션 스모크 4종(정산 문구 · QR 출근 직후 재스캔 → "잠시 후" · 댓글 고정 권한 메시지 · #501 UI) ·
실기기 QA(`docs/qa/2026-08-11-device-qa-1.0.7.md`, iOS 우선) · Supabase 콘솔 2건(Leaked Password
Protection · Token refresh rate limit).
