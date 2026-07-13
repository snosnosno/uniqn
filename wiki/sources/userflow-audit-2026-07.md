---
area: sources
updated: 2026-07-14
status: current
sources:
  - docs/analysis/2026-07-10-userflow-audit.md
  - uniqn-mobile/src/repositories/supabase/postingAuthority.ts
  - PR#242
  - memory/project_userflow_audit_20260710
tags: [audit, security, rls, settlement, userflow]
---

# 소스: 코어 유저플로우 실측 감사 → P0~P2 전항 수정 (PR #242, 2026-07-10~13)

## 방법
읽기전용 멀티에이전트 감사(sonnet 15 리더 + opus 8 적대검증) → 결함 후보 39건 → **적대검증이 44% 기각** → 확정 20 → **prod 라이브 실측 재판정** → 최종 24건/8루트원인. 상세 리포트는 `docs/analysis/2026-07-10-userflow-audit.md`(§9 P0·§10 P1·§11 LOW/P2/리뷰).

## P0 요지 (전부 수정·prod 적용)
1. 스태프 자기행 `work_logs` UPDATE 회수 — 🔑기존 pgTAP가 이 취약점을 "ALLOW"로 **고정**하고 있었음(테스트를 뒤집음). 🔑permissive 정책은 OR 합산 — 레포 전용 고아 정책 동시 DROP 필수.
2. 확정 해제 `actor_type` 하드코딩 → RPC에 employer 분기 자체가 없었음(마이그로 추가). owner_id nullable fail-open은 E8 RED 라이브 실증 후 COALESCE 하드닝.
3. **postingAuthority 모듈 신설**(최대 레버리지) — 소유권 판정 3함수 통합. 단일 boolean이 아니라 역량(capability) 판정: admin은 mutate에서 계속 거부(RLS 0행 silent no-op 방지).
4. 완료 건 표시액 `payroll_amount` 동결(소급 재계산 차단) / 5. 대회 `approvalStatus` 지원 게이트 / 6. 레포가 prod보다 위험하던 파리티 구멍(느슨 notifications INSERT·nickname UNIQUE) — [[prod-parity-baseline]]으로 근본 해소.

## prod 실측으로 뒤집힌 전제 (재발견 금지)
notifications INSERT 위조 불가(정책 0 + SECDEF 트리거) · nickname UNIQUE prod 존재 · 취소요청 알림 트리거 prod 활성(갭은 "수신자 1명뿐") · 알림 삭제 unread 이중차감은 진짜(트리거+Edge Function).

## 반복 교훈 (감사 전체를 관통)
- **"테스트 GREEN"은 계약 증거가 아니다** — 테스트가 취약점·로컬 잔상을 고정할 수 있다. RED로 결함을 라이브 실증한 뒤 뒤집는다.
- **SECURITY DEFINER 트리거 안에서 `current_user`는 postgres, `auth.jwt()`는 호출자** — 차단 로직을 트리거에 넣으면 정상 RPC까지 막는다(P0#1에서 RLS 축소를 택한 이유).
- 클라가 넘긴 식별자 불신 — 판정은 서버 보관값(`workLog.jobPostingId`)으로.

## 방어심화·P2 (2026-07-13, §11)
완료건 `custom_*` 동결 트리거 · 미승인 대회 지원 게이트(fail-closed) · anon write REVOKE · 동시확정 레이스 P0001→에러매핑+문구(RPC 커스텀 예외는 `handleSupabaseError` 개별 분기 필수) · 초대 오탐 근본수정. 공유 Docker 스택 함정: 병렬 세션의 prod 스냅샷 재구축이 auth 트리거를 활성화해 pgTAP cleanup을 FK로 죽임 → owner-기준 삭제로 강건화.

관련: [[prod-parity-baseline]] · [[rls-model]] · [[worktime-ssot]] · [[ios-userflow-fixes]] · [[capacity-full]]
