---
name: pitfall-role-key-two-lineages-bare-other
description: 역할키 정규화가 2계보 — getPostingRoleKey(bare other→'other') vs roleMatchKey/DB _posting_role_key(bare other→'other:'). hydrate 조회 키에 getPostingRoleKey를 쓰면 bare other가 항상 filled=0(fail-open)
metadata:
  type: project
---

역할키 클라 정규화 함수가 2계보로 존재하며 bare `other`(customRole 없음)에서 발산한다.

- **DB 진실원** `_posting_role_key`(baseline_schema_from_prod.sql:511): custom 비어있고 role='other'면 **'other:'**(콜론 포함), custom 있으면 `other:<btrim(custom)>`. custom이 있으면 role 값과 무관하게 other: 접두(비대칭 주의).
- **서버-패리티 계보** `roleMatchKey`(postingSurfaceModel.ts:346): bare other → `'other:'` — DB와 동치. 주석에 "SQL은 'other:'를 만들므로" 명시(과거 미스매치 실측의 산물).
- **표시 키 계보** `getPostingRoleKey`(domains/job-posting/core.ts:21): bare other → `'other'`(콜론 없음).

**Why:** 2026-07-14 count-consistency 리뷰에서 `selectPostingRoleAvailability`의 filledByRole hydrate 조회가 getPostingRoleKey를 사용 → bare other 역할은 DB 집계키 'other:'와 미스매치로 항상 filled=0(마감 미표시, fail-open). 또 클라는 customRole을 btrim하지 않아 공백 엣지도 잠재 미스매치.

**How to apply:** work_logs 집계(`get_posting_filled_counts`) 결과와 매칭하는 조회 키는 반드시 roleMatchKey 계보(`other:` 접두 항상)를 사용. getPostingRoleKey는 표시/dedup 용도로만. 리뷰 시 hydrate 배선이 어느 계보를 쓰는지 반드시 확인. 관련: [[pitfall-filled-counts-global-vs-submap-keyspace]] (메인 레포 메모리).
