---
name: pattern-pgtap-tight-verification-attacl-and-captured-timestamp
description: pgTAP에서 컬럼단위 GRANT·시각기록 단언을 비공허하게 만드는 두 기법(attacl vs relacl, 캡처된 clock_timestamp 하한)
metadata:
  type: project
---

PR #497 리뷰(2026-09-18~19)에서 실제로 살려낸 두 가지 "실패할 수 없는 검증" 교정 기법.

**1. 컬럼단위 GRANT 검증 = `has_column_privilege` 대신 `pg_attribute.attacl` 직접 질의.**
`jpc_helpers.sql`/`ops_helpers.sql`이 마이그 뒤에 `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`를 실행해 테이블단위 `pg_class.relacl`을 되살린다. `has_column_privilege`는 테이블단위+컬럼단위 OR로 판정하므로 이 블랭킷 GRANT에 항상 오염돼 `post_id` 같은 비허용 컬럼도 `UPDATE=true`로 나온다(실측 확인: `SELECT has_column_privilege('authenticated','public.board_comments','post_id','UPDATE')` → `t`). 반면 컬럼단위 `GRANT UPDATE(col) TO role`은 `pg_attribute.attacl`에만 기록되고 블랭킷 GRANT가 덮지 않는다. 따라서:

```sql
SELECT string_agg(a.attname, ',' ORDER BY a.attname)
FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
WHERE a.attrelid = 'public.board_comments'::regclass
  AND a.attnum > 0 AND NOT a.attisdropped
  AND x.grantee = 'authenticated'::regrole AND x.privilege_type = 'UPDATE';
```

가 픽스처와 무관하게 마이그의 진짜 화이트리스트를 비공허하게 검증한다. `communication_comment_update_hardening.test.sql`에 적용됨.

**2. "방금 기록됐다" 단언 = 고정 과거 상수 하한 대신 캡처된 `clock_timestamp()` 하한.**
`check_out_scanned_at > '2026-01-01'` 같은 단언은 checkOut이 성공하기만 하면 항상 참이라, `check_out_scanned_at`이 실수로 `check_in_ts`(수 시간 전) 같은 엉뚱한 값으로 대입돼도 못 잡는다. 호출 직전 `v_before := clock_timestamp()`를 잡아 `check_out_scanned_at >= v_before`로 바꾸면 그런 회귀를 실제로 잡는다. `work_schedule_qr_container_auto.test.sql`이 이 교정과 함께 "하한이 실제로 조여 있다"는 둘째 단언(`raw_lower_bound_is_tight`)까지 추가해 하한 자체가 다시 느슨해지는 것도 감시한다.

**Why:** 두 사례 모두 "그럴듯한 단언인데 실제로는 통과 조건이 거의 항상 참"이라 회귀를 못 잡는 유형이다. 리뷰에서 지목만 하고 넘어가기 쉬운데, 이 PR에서는 지목 → 실측 재현(오염 확인) → 교정 → Red-Green 재현까지 전 과정이 실제로 일어났다.

**How to apply:** 이후 pgTAP 리뷰에서 (a) 컬럼단위 GRANT/REVOKE를 단언하는 코드를 볼 때는 `has_column_privilege` 단독 사용을 의심하고 픽스처의 블랭킷 GRANT 존재 여부(`jpc_helpers.sql`/`ops_helpers.sql`)를 먼저 확인한다. (b) "시각이 방금 기록됐다"류 단언에서 하한이 고정 상수(특히 먼 과거)인지 확인하고, 캡처된 타임스탬프 대비인지 점검한다.

관련: [[pattern_lightweight_parser_entity_wired_into_strict_document_write_path]] 등 기존 vacuous-verification 계열. wiki `decisions/vacuous-verification`에 유형 카탈로그 있음(단언 미도달·구조적 0·미실행 성공·판정축 오류·도구 사각지대) — 이번 둘은 "판정축 오류"(성공 여부만 보고 정확성은 안 봄)에 해당.
